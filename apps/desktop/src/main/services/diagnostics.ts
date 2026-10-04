import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { newUlid } from '@muneem/domain';
import { AppError, type Health } from '@muneem/contracts';
import {
  dbSizeBytes, foreignKeyCheck, getMeta, META_KEYS, outboxDepth, quickCheck, setMeta, verifyAuditChain,
  currentSchemaVersion, journalsNotMatchingLines, rebuildAccountBalances, reconcilePartiesDb, replayKeys, tieOutFailures, unpostedDocuments, rewriteLevels, stockKeys, type Db, type StockDrift } from '@muneem/db-sqlite';
import { DEVICE_AUDIT_SCOPE } from '../ipc/gateway.js';

const STOCK_CHECK_BATCH = 200;
const STOCK_CHECK_SLICE = 2000;
const STOCK_CHECK_CURSOR = 'stock.check.cursor';
import type { Loggers } from '../infra/logger.js';
import type { SessionService } from './session.js';
import type { DeviceService } from './device.js';

export interface DiagnosticsDeps {
  db: () => Db; dbFile: string; bundlesDir: string; loggers: Loggers; session: SessionService; device: DeviceService;
  appVersion: string; secretStoreAvailable: boolean; connectivity: () => { serverSkewMs: number | null };
}

export class DiagnosticsService {
  private handles = new Map<string, string>();
  constructor(private readonly d: DiagnosticsDeps) {}

  getHealth(): Health {
    const db = this.d.db();
    const ob = outboxDepth(db);
    const s = this.d.session.get();
    const chain = verifyAuditChain(db, s?.businessId ?? DEVICE_AUDIT_SCOPE, this.d.device.localDeviceId());
    return {
      dbPath: this.d.dbFile, dbSizeBytes: this.d.dbFile === ':memory:' ? 0 : dbSizeBytes(this.d.dbFile), schemaVersion: currentSchemaVersion(db), appVersion: this.d.appVersion,
      quickCheck: 'not_run', outboxDepth: ob.depth, oldestUnsyncedAt: ob.oldestUnsyncedAt,
      lastBackupAt: getMeta(db, META_KEYS.lastBackupAt), clockSkewMs: this.d.connectivity().serverSkewMs,
      auditChainOk: chain.count === 0 ? null : chain.ok, secretStoreAvailable: this.d.secretStoreAvailable,
    };
  }

  // replay = projection (ADR-0018) in batches that yield to the UI; scheduled runs take a rotating slice (LLD §4.2).
  async checkStock(opts: { slice?: boolean; batchSize?: number; sliceSize?: number } = {}): Promise<'ok' | 'healed' | 'not_run'> {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const db = this.d.db();
    let keys = stockKeys(db, businessId);
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
      drift.push(...replayKeys(db, businessId, keys.slice(i, i + batch)));
      await new Promise((r) => setImmediate(r));
    }
    const miscosted = drift.filter((d) => d.badMovementIds.length > 0);
    if (miscosted.length > 0) {
      this.d.loggers.app.warn({ code: 'STOCK_COST_MISMATCH', movements: miscosted.map((d) => ({ productId: d.productId, ids: d.badMovementIds })) }, 'movements costed from a drifted stock level; review them');
    }
    const levels = drift.filter((d) => d.levelDrift);
    if (levels.length === 0) return 'ok';
    this.d.loggers.app.error({ code: 'STOCK_PROJECTION_DRIFT', drift: levels }, 'stock levels disagreed with their movements; rebuilding');
    rewriteLevels(db, businessId, levels.map((d) => ({ warehouseId: d.warehouseId, productId: d.productId })));
    return 'healed';
  }

  // ADR-0022: party entries are the record, not a cache, so a mismatch is reported for review and never rewritten.
  checkParties(): 'ok' | 'mismatch' | 'not_run' {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const r = reconcilePartiesDb(this.d.db(), businessId);
    if (r.mismatches.length === 0 && r.faults.length === 0) return 'ok';
    this.d.loggers.app.error({ code: 'PARTY_LEDGER_MISMATCH', mismatches: r.mismatches, faults: r.faults }, 'party ledger does not match its documents');
    return 'mismatch';
  }

  // ADR-0034: a drifted balance cache is rebuilt; journals and documents are the record, so anything else is reported.
  checkJournals(): 'ok' | 'healed' | 'mismatch' | 'not_run' {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const db = this.d.db();
    const healed = rebuildAccountBalances(db, businessId) > 0;
    if (healed) this.d.loggers.app.error({ code: 'JOURNAL_BALANCE_DRIFT' }, 'account balances disagreed with the journal lines; rebuilt');
    const tieOuts = tieOutFailures(db, businessId);
    const unposted = unpostedDocuments(db, businessId);
    const badJournals = journalsNotMatchingLines(db, businessId);
    if (tieOuts.length === 0 && unposted.length === 0 && badJournals === 0) return healed ? 'healed' : 'ok';
    this.d.loggers.app.error({ code: 'JOURNAL_MISMATCH', tieOuts, unposted: unposted.slice(0, 50), badJournals }, 'the books do not agree with their documents');
    return 'mismatch';
  }

  async integrityCheck() {
    const db = this.d.db();
    const qc = quickCheck(db);
    const fk = foreignKeyCheck(db);
    const s = this.d.session.get();
    const scopes = [DEVICE_AUDIT_SCOPE, ...(s?.businessId ? [s.businessId] : [])];
    const chains = scopes.map((b) => ({ b, r: verifyAuditChain(db, b, this.d.device.localDeviceId()) }));
    const broken = chains.filter((c) => !c.r.ok);
    const detail = [...qc.detail.filter((x) => x !== 'ok'), ...fk.detail, ...broken.map((c) => `audit chain ${c.b} broken at seq ${c.r.brokenAtSeq}`)];
    if (!qc.ok) this.d.loggers.app.error({ detail }, 'DB_CORRUPT detected by integrity check');
    const stock = await this.checkStock();
    if (stock === 'healed') detail.push('stock levels disagreed with their movements and were rebuilt');
    const parties = this.checkParties();
    if (parties === 'mismatch') detail.push('a party ledger does not match its documents; see the app log (PARTY_LEDGER_MISMATCH)');
    const journals = this.checkJournals();
    if (journals === 'healed') detail.push('account balances disagreed with the journal lines and were rebuilt');
    if (journals === 'mismatch') detail.push('the books do not agree with their documents; see the app log (JOURNAL_MISMATCH)');
    return { quickCheck: qc.ok ? 'ok' : 'failed', foreignKeys: fk.ok ? 'ok' : 'failed', auditChain: broken.length ? 'broken' : 'ok', stock, parties, journals, detail } as const;
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
    writeFileSync(join(dir, 'health.json'), JSON.stringify({ health: this.getHealth(), integrity: await this.integrityCheck(), counts, device: this.d.device.info(), exportedAt: new Date().toISOString() }, null, 2));
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
