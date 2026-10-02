import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { newUlid } from '@muneem/domain';
import { AppError, type Health } from '@muneem/contracts';
import {
  backupDatabase, dbSizeBytes, foreignKeyCheck, getMeta, META_KEYS, outboxDepth, quickCheck, setMeta, verifyAuditChain,
  currentSchemaVersion, type Db,
 rebuildStockLevels, replayCheck } from '@muneem/db-sqlite';
import { DEVICE_AUDIT_SCOPE } from '../ipc/gateway.js';
import type { Loggers } from '../infra/logger.js';
import type { SessionService } from './session.js';
import type { DeviceService } from './device.js';

export interface DiagnosticsDeps {
  db: () => Db; dbFile: string; backupsDir: string; bundlesDir: string; loggers: Loggers; session: SessionService; device: DeviceService;
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

  // replay = projection (ADR-0018): any cached level the movements disagree with is logged and rebuilt from the movements.
  checkStock(): 'ok' | 'healed' | 'not_run' {
    const businessId = this.d.session.get()?.businessId;
    if (!businessId) return 'not_run';
    const drift = replayCheck(this.d.db(), businessId);
    if (drift.length === 0) return 'ok';
    this.d.loggers.app.error({ code: 'STOCK_PROJECTION_DRIFT', drift }, 'stock levels disagreed with their movements; rebuilding');
    rebuildStockLevels(this.d.db(), businessId, drift.map((d) => d.productId));
    return 'healed';
  }

  integrityCheck() {
    const db = this.d.db();
    const qc = quickCheck(db);
    const fk = foreignKeyCheck(db);
    const s = this.d.session.get();
    const scopes = [DEVICE_AUDIT_SCOPE, ...(s?.businessId ? [s.businessId] : [])];
    const chains = scopes.map((b) => ({ b, r: verifyAuditChain(db, b, this.d.device.localDeviceId()) }));
    const broken = chains.filter((c) => !c.r.ok);
    const detail = [...qc.detail.filter((x) => x !== 'ok'), ...fk.detail, ...broken.map((c) => `audit chain ${c.b} broken at seq ${c.r.brokenAtSeq}`)];
    if (!qc.ok) this.d.loggers.app.error({ detail }, 'DB_CORRUPT detected by integrity check');
    const stock = this.checkStock();
    if (stock === 'healed') detail.push('stock levels disagreed with their movements and were rebuilt');
    return { quickCheck: qc.ok ? 'ok' : 'failed', foreignKeys: fk.ok ? 'ok' : 'failed', auditChain: broken.length ? 'broken' : 'ok', stock, detail } as const;
  }

  async backupNow(kind: 'manual' | 'scheduled' = 'manual') {
    const db = this.d.db();
    mkdirSync(this.d.backupsDir, { recursive: true });
    const path = join(this.d.backupsDir, `muneem-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    const r = await backupDatabase(db, path);
    db.prepare('INSERT INTO backup_log (id, path, bytes, verified, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(newUlid(), path, r.bytes, r.verified ? 1 : 0, kind, new Date().toISOString());
    if (r.verified) setMeta(db, META_KEYS.lastBackupAt, new Date().toISOString());
    else this.d.loggers.app.error({ path }, 'backup failed verification');
    return { path, bytes: r.bytes, verified: r.verified };
  }

  /** Logs + health JSON + schema version + row counts. No invoice contents. Returns an opaque handle, never a path. */
  exportSupportBundle() {
    const id = newUlid();
    const dir = join(this.d.bundlesDir, id);
    mkdirSync(dir, { recursive: true });
    const db = this.d.db();
    const counts: Record<string, number> = {};
    for (const t of ['business', 'branch', 'terminal', 'user', 'sync_outbox', 'audit_log', 'backup_log']) {
      counts[t] = (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    }
    writeFileSync(join(dir, 'health.json'), JSON.stringify({ health: this.getHealth(), integrity: this.integrityCheck(), counts, device: this.d.device.info(), exportedAt: new Date().toISOString() }, null, 2));
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
