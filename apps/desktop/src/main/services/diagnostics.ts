import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { newUlid } from '@muneem/domain';
import { AppError, type AuditVerification, type Health, type IntegrityReport } from '@muneem/contracts';
import {
  AUDIT_CHECK_KEY, auditRejections, recordAuditCheck, dbSizeBytes, getMeta, META_KEYS, outboxDepth, setMeta, currentSchemaVersion, rebuildDailySummaries, withTransaction,
  rebuildAccountBalances, rewriteLevels, journalTotalsAtCursor, integrityReportKey, type AuditChainReport, type AuditChainResult, type Db, type StockDrift } from '@muneem/db-sqlite';
import { DEVICE_AUDIT_SCOPE } from '../ipc/gateway.js';
import type { BackgroundReads } from '../background/backgroundReads.js';

const STOCK_CHECK_BATCH = 200;
const STOCK_CHECK_SLICE = 2000;
const STOCK_CHECK_CURSOR = 'stock.check.cursor';
import type { Loggers } from '../infra/logger.js';
import type { SessionService } from './session.js';
import type { DeviceService } from './device.js';

export interface DiagnosticsDeps {
  db: () => Db; reads: BackgroundReads; dbFile: string; bundlesDir: string; loggers: Loggers; session: SessionService; device: DeviceService;
  appVersion: string; secretStoreAvailable: boolean; connectivity: () => { serverSkewMs: number | null };
}

const QUICK_CHECK_AT = 'quick_check.background_at';
const QUICK_CHECK_EVERY_MS = 24 * 3600_000;

export class DiagnosticsService {
  private handles = new Map<string, string>();
  private findings = { replayMismatches: 0, tieOutFailures: 0 };
  private lastQuickCheck: Health['quickCheck'] = 'not_run';
  constructor(private readonly d: DiagnosticsDeps) {}

  async getHealth(): Promise<Health> {
    const db = this.d.db();
    const ob = outboxDepth(db);
    const s = this.d.session.get();
    const chain = await this.lastChainCheck(s?.businessId ?? DEVICE_AUDIT_SCOPE, this.d.device.localDeviceId());
    return {
      dbPath: this.d.dbFile, dbSizeBytes: this.d.dbFile === ':memory:' ? 0 : dbSizeBytes(this.d.dbFile), schemaVersion: currentSchemaVersion(db), appVersion: this.d.appVersion,
      quickCheck: this.lastQuickCheck, outboxDepth: ob.depth, oldestUnsyncedAt: ob.oldestUnsyncedAt,
      lastBackupAt: getMeta(db, META_KEYS.lastBackupAt), clockSkewMs: this.d.connectivity().serverSkewMs,
      auditChainOk: chain.count === 0 ? null : chain.ok, secretStoreAvailable: this.d.secretStoreAvailable,
    };
  }

  // replay = projection (ADR-0018) in the read worker, batch by batch; scheduled runs take a rotating slice (LLD §4.2).
  async checkStock(opts: { slice?: boolean; batchSize?: number; sliceSize?: number } = {}): Promise<'ok' | 'healed' | 'not_run'> {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const db = this.d.db();
    let keys = await this.d.reads.run('stockKeys', { businessId });
    if (opts.slice && keys.length > 0) {
      const all = keys;
      const size = Math.min(opts.sliceSize ?? STOCK_CHECK_SLICE, all.length);
      const start = Number(getMeta(db, STOCK_CHECK_CURSOR) ?? 0) % all.length;
      keys = Array.from({ length: size }, (_, i) => all[(start + i) % all.length]!);
      setMeta(db, STOCK_CHECK_CURSOR, String((start + size) % all.length));
    }
    const drift: StockDrift[] = [];
    const batch = opts.batchSize ?? STOCK_CHECK_BATCH;
    for (let i = 0; i < keys.length; i += batch) {
      drift.push(...await this.d.reads.run('stockReplay', { businessId, keys: keys.slice(i, i + batch) }));
      await new Promise((r) => setImmediate(r));
    }
    const miscosted = drift.filter((d) => d.badMovementIds.length > 0);
    this.findings.replayMismatches = drift.filter((d) => d.levelDrift || d.badMovementIds.length > 0).length;
    if (miscosted.length > 0) {
      this.d.loggers.app.warn({ code: 'STOCK_COST_MISMATCH', movements: miscosted.map((d) => ({ productId: d.productId, ids: d.badMovementIds })) }, 'movements costed from a drifted stock level; review them');
    }
    const levels = drift.filter((d) => d.levelDrift);
    if (levels.length === 0) return 'ok';
    this.d.loggers.app.error({ code: 'STOCK_PROJECTION_DRIFT', drift: levels }, 'stock levels disagreed with their movements; rebuilding');
    rewriteLevels(db, businessId, levels.map((d) => ({ warehouseId: d.warehouseId, productId: d.productId })));
    return 'healed';
  }

  // The 6-hourly device checks (HLD §12): the heavy reads run in the read worker, so none of them holds up billing (ADR-0058);
  // each runs alone so one failing never skips the rest, and the findings go out on the next push (ADR-0054).
  async scheduledChecks(since = new Date(Date.now() - 35 * 86_400_000).toLocaleDateString('en-CA')): Promise<void> {
    const log = (name: string) => (e: unknown) => { this.d.loggers.app.error({ err: String(e) }, `scheduled ${name} check failed`); };
    const [stock, , journals, , audit] = await Promise.all([
      this.checkStock({ slice: true }).catch((e) => { log('stock')(e); return 'not_run' as const; }),
      this.checkParties().catch(log('party')),
      this.checkJournals().catch((e) => { log('journal')(e); return 'not_run' as const; }),
      this.checkSummaries(since).catch(log('summary')),
      this.verifyAudit().catch((e) => { log('audit chain')(e); return null; }),
    ]);
    const businessId = this.d.session.get()?.businessId;
    if (!businessId || stock === 'not_run' || journals === 'not_run' || !audit) return;
    try { this.recordIntegrity(businessId, audit.ok); } catch (e) { log('integrity report')(e); }
  }

  // ADR-0058: start-up skips quick_check after a clean exit, so the read worker runs it at most once a day; a failure is DB_CORRUPT.
  async backgroundQuickCheck(now = Date.now()): Promise<Health['quickCheck']> {
    const last = Number(getMeta(this.d.db(), QUICK_CHECK_AT) ?? 0);
    if (now - last < QUICK_CHECK_EVERY_MS) return this.lastQuickCheck;
    const r = await this.d.reads.run('quickCheck', undefined);
    this.lastQuickCheck = r.ok ? 'ok' : 'failed';
    if (r.ok) setMeta(this.d.db(), QUICK_CHECK_AT, String(now));
    else this.d.loggers.app.error({ code: 'DB_CORRUPT', detail: r.detail }, 'the background quick_check failed; the next start checks again and offers a restore');
    return this.lastQuickCheck;
  }

  // ADR-0058: the last verification stands for the chain; verifying a long chain on every Diagnostics poll would cost seconds each time.
  private async lastChainCheck(businessId: string, deviceId: string): Promise<AuditChainResult> {
    const last = getMeta(this.d.db(), AUDIT_CHECK_KEY);
    const recorded = last ? (JSON.parse(last) as { chains: AuditChainReport[] }).chains.find((c) => c.businessId === businessId && c.deviceId === deviceId) : undefined;
    return recorded ?? this.d.reads.run('auditChain', { businessId, deviceId });
  }

  // ADR-0022: party entries are the record, not a cache, so a mismatch is reported for review and never rewritten.
  async checkParties(): Promise<'ok' | 'mismatch' | 'not_run'> {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const r = await this.d.reads.run('partyReconciliation', { businessId });
    if (r.mismatches.length === 0 && r.faults.length === 0) return 'ok';
    this.d.loggers.app.error({ code: 'PARTY_LEDGER_MISMATCH', mismatches: r.mismatches, faults: r.faults }, 'party ledger does not match its documents');
    return 'mismatch';
  }

  // ADR-0034: a drifted balance cache is rebuilt; journals and documents are the record, so anything else is reported.
  async checkJournals(): Promise<'ok' | 'healed' | 'mismatch' | 'not_run'> {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    let checks = await this.d.reads.run('journalChecks', { businessId });
    const healed = checks.balanceDrift > 0 && rebuildAccountBalances(this.d.db(), businessId) > 0;
    if (healed) {
      this.d.loggers.app.error({ code: 'JOURNAL_BALANCE_DRIFT' }, 'account balances disagreed with the journal lines; rebuilt');
      checks = await this.d.reads.run('journalChecks', { businessId });
    }
    const { tieOuts, unposted, badJournals } = checks;
    this.findings.tieOutFailures = tieOuts.length + unposted.length + badJournals;
    if (tieOuts.length === 0 && unposted.length === 0 && badJournals === 0) return healed ? 'healed' : 'ok';
    this.d.loggers.app.error({ code: 'JOURNAL_MISMATCH', tieOuts, unposted: unposted.slice(0, 50), badJournals }, 'the books do not agree with their documents');
    return 'mismatch';
  }

  // 8e: the dashboard's daily tables are a cache of the documents, so drift is logged and rebuilt from them; `since` keeps a scheduled run short.
  async checkSummaries(since?: string): Promise<'ok' | 'healed' | 'not_run'> {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const drift = await this.d.reads.run('summaryDrift', { businessId, ...(since && { since }) });
    if (drift.length === 0) return 'ok';
    this.d.loggers.app.error({ code: 'SUMMARY_DRIFT', drift }, 'the daily summaries disagreed with their documents; rebuilding');
    const db = this.d.db();
    withTransaction(db, () => rebuildDailySummaries(db, businessId));
    return 'healed';
  }

  // 8g (ADR-0048): every audit chain held here, and any row the cloud refused as a broken chain; a break blocks the sync badge.
  async verifyAudit(): Promise<AuditVerification> {
    const db = this.d.db();
    const checkedAt = new Date().toISOString();
    const chains = await this.d.reads.run('auditChains', undefined);
    recordAuditCheck(db, chains, checkedAt);
    const cloudRejections = auditRejections(db);
    const broken = chains.filter((c) => !c.ok);
    if (broken.length > 0 || cloudRejections.length > 0) {
      this.d.loggers.app.error({ code: 'AUDIT_CHAIN_BROKEN', broken, cloudRejections }, 'the audit trail failed its hash-chain check');
    }
    return {
      checkedAt, ok: broken.length === 0 && cloudRejections.length === 0, cloudRejections,
      chains: chains.map((c) => ({ businessId: c.businessId, deviceId: c.deviceId, count: c.count, ok: c.ok, brokenAtSeq: c.brokenAtSeq, reason: c.reason })),
    };
  }

  private recordIntegrity(businessId: string, auditChainOk: boolean): void {
    const db = this.d.db();
    const report: IntegrityReport = { checkedAt: new Date().toISOString(), ...this.findings, auditChainOk, ...journalTotalsAtCursor(db, businessId) };
    setMeta(db, integrityReportKey(businessId), JSON.stringify(report));
  }

  async integrityCheck() {
    const { quick: qc, foreignKeys: fk } = await this.d.reads.run('storage', undefined);
    const audit = await this.verifyAudit();
    const broken = audit.chains.filter((c) => !c.ok);
    const detail = [...qc.detail.filter((x) => x !== 'ok'), ...fk.detail, ...broken.map((c) => `audit chain ${c.businessId}/${c.deviceId} broken at seq ${c.brokenAtSeq} (${c.reason})`),
      ...audit.cloudRejections.map((r) => `the cloud refused audit seq ${r.seq}: ${r.detail}`)];
    if (!qc.ok) this.d.loggers.app.error({ detail }, 'DB_CORRUPT detected by integrity check');
    const stock = await this.checkStock();
    if (stock === 'healed') detail.push('stock levels disagreed with their movements and were rebuilt');
    const parties = await this.checkParties();
    if (parties === 'mismatch') detail.push('a party ledger does not match its documents; see the app log (PARTY_LEDGER_MISMATCH)');
    const journals = await this.checkJournals();
    if (journals === 'healed') detail.push('account balances disagreed with the journal lines and were rebuilt');
    if (journals === 'mismatch') detail.push('the books do not agree with their documents; see the app log (JOURNAL_MISMATCH)');
    const summaries = await this.checkSummaries();
    if (summaries === 'healed') detail.push('the dashboard summaries disagreed with their documents and were rebuilt');
    return { quickCheck: qc.ok ? 'ok' : 'failed', foreignKeys: fk.ok ? 'ok' : 'failed', auditChain: audit.ok ? 'ok' : 'broken', stock, parties, journals, summaries, detail } as const;
  }

  /** Logs + health JSON + schema version + row counts. No invoice contents. Returns an opaque handle, never a path. */
  async exportSupportBundle() {
    const id = newUlid();
    const dir = join(this.d.bundlesDir, id);
    mkdirSync(dir, { recursive: true });
    const db = this.d.db();
    const counts: Record<string, number> = {};
    for (const t of ['business', 'branch', 'terminal', 'user', 'sync_outbox', 'audit_log', 'backup_log']) {
      counts[t] = (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    }
    writeFileSync(join(dir, 'health.json'), JSON.stringify({ health: await this.getHealth(), integrity: await this.integrityCheck(), counts, device: this.d.device.info(), exportedAt: new Date().toISOString() }, null, 2));
    let bytes = 0;
    for (const name of ['app.log', 'sync.log', 'hardware.log']) {
      const src = join(this.d.loggers.dir, name);
      if (this.d.loggers.dir && existsSync(src)) { copyFileSync(src, join(dir, name)); bytes += readFileSync(src).length; }
    }
    this.handles.set(id, dir);
    return { handle: id, bytes };
  }
  resolveHandle(handle: string): string {
    const p = this.handles.get(handle);
    if (!p) throw new AppError('NOT_FOUND', 'Unknown bundle');
    return p;
  }

  getLogsTail(log: 'app' | 'sync' | 'sql-slow' | 'hardware', lines: number): string[] {
    const file = join(this.d.loggers.dir, `${log}.log`);
    if (!this.d.loggers.dir || !existsSync(file)) return [];
    const all = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return all.slice(-lines);
  }
}
