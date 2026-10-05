import type { SyncStatus } from '@muneem/contracts';
import { AUDIT_CHECK_KEY } from '../audit.js';
import type { Db } from '../open.js';

/** LLD §8.4 — derived from sync_outbox in one query. */
export function readSyncStatus(db: Db, online: boolean, serverSkewMs: number | null): SyncStatus {
  const c = db.prepare(`SELECT
      SUM(status = 'pending') AS pending, SUM(status = 'in_flight') AS in_flight,
      SUM(status = 'failed') AS failed, SUM(status = 'dead') AS dead FROM sync_outbox WHERE status IN ('pending','in_flight','failed','dead')`).get() as { pending: number | null; in_flight: number | null; failed: number | null; dead: number | null };
  const log = db.prepare('SELECT * FROM sync_log WHERE id = 1').get() as { last_push_at: string | null; last_push_ok: number | null; last_pull_at: string | null; last_error: string | null };
  const device = db.prepare('SELECT status, status_detail FROM sync_device WHERE id = 1').get() as { status: string; status_detail: string | null } | undefined;
  const pending = c.pending ?? 0, inFlight = c.in_flight ?? 0, failed = c.failed ?? 0, dead = c.dead ?? 0;
  const auditChainBroken = auditChainBrokenAnywhere(db);
  const fresh = { deviceStatus: (device?.status ?? null) as SyncStatus['deviceStatus'], ...syncFreshness(db), auditChainBroken };
  let state: SyncStatus['state'] = 'synced';
  if (device && device.status !== 'active') return { state: 'blocked', pending, inFlight, failed, dead, lastPushAt: log.last_push_at, lastPullAt: log.last_pull_at, online, serverSkewMs, detail: device.status_detail ?? device.status, ...fresh };
  if (auditChainBroken) return { state: 'blocked', pending, inFlight, failed, dead, lastPushAt: log.last_push_at, lastPullAt: log.last_pull_at, online, serverSkewMs, detail: 'The audit trail failed its hash-chain check; see Diagnostics', ...fresh };
  if (dead > 0) state = 'blocked';
  else if (failed > 0) state = 'degraded';
  else if (inFlight > 0) state = 'syncing';
  else if (pending > 0) state = 'queued';
  else if (!log.last_push_at) state = 'never';
  return { state, pending, inFlight, failed, dead, lastPushAt: log.last_push_at, lastPullAt: log.last_pull_at, online, serverSkewMs, detail: log.last_error, ...fresh };
}

// FR-087 staleness: how old the queue is, when other terminals' documents last arrived, and whether there are other terminals at all.
function syncFreshness(db: Db): Pick<SyncStatus, 'oldestPendingAt' | 'documentsPulledAt' | 'terminalCount'> {
  const r = db.prepare(`SELECT
      (SELECT MIN(created_at) FROM sync_outbox WHERE status IN ('pending','in_flight','failed')) AS oldest,
      (SELECT MAX(last_pulled_at) FROM sync_cursor WHERE stream = 'documents') AS pulled,
      (SELECT COUNT(*) FROM terminal WHERE deleted_at IS NULL) AS terminals`).get() as { oldest: string | null; pulled: string | null; terminals: number };
  return { oldestPendingAt: r.oldest, documentsPulledAt: r.pulled, terminalCount: r.terminals };
}

// 8g: the last local verification found a break, or the cloud refused an audit row as AUDIT_CHAIN_BROKEN.
function auditChainBrokenAnywhere(db: Db): boolean {
  return (db.prepare(`SELECT
      EXISTS (SELECT 1 FROM app_meta WHERE key = ? AND json_extract(value, '$.ok') = 0)
      OR EXISTS (SELECT 1 FROM sync_outbox WHERE error_code = 'AUDIT_CHAIN_BROKEN' AND status IN ('failed','dead'))`).pluck().get(AUDIT_CHECK_KEY) as number) === 1;
}

export function outboxDepth(db: Db): { depth: number; oldestUnsyncedAt: string | null } {
  const r = db.prepare("SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM sync_outbox WHERE status IN ('pending','in_flight','failed')").get() as { n: number; oldest: string | null };
  return { depth: r.n, oldestUnsyncedAt: r.oldest };
}

/** ADR-0053: what still waits once the batch in flight lands (dead counts: it never drains by itself), and stock below zero. */
export function syncHeartbeat(db: Db, businessId: string, inFlightBatchId: string): { outboxDepth: number; oldestPendingAt: string | null; negativeStockCount: number } {
  const r = db.prepare(`SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM sync_outbox
    WHERE status IN ('pending','in_flight','failed','dead') AND business_id = ? AND batch_id IS NOT ?`).get(businessId, inFlightBatchId) as { n: number; oldest: string | null };
  const negative = db.prepare('SELECT COUNT(*) FROM stock_level WHERE business_id = ? AND qty_milli < 0').pluck().get(businessId) as number;
  return { outboxDepth: r.n, oldestPendingAt: r.oldest, negativeStockCount: negative };
}

/** ADR-0054: raw journal totals and the documents cursor they stand at, for the cloud's device-vs-cloud comparison. */
export function journalTotalsAtCursor(db: Db, businessId: string): { journalCount: number; journalDebitPaise: number; journalCreditPaise: number; documentsSeq: number; outboxDepth: number } {
  const r = db.prepare(`SELECT
      (SELECT COUNT(*) FROM journal_entry WHERE business_id = ?) AS n,
      (SELECT COALESCE(SUM(debit_paise), 0) FROM journal_line WHERE business_id = ?) AS debit,
      (SELECT COALESCE(SUM(credit_paise), 0) FROM journal_line WHERE business_id = ?) AS credit,
      (SELECT COALESCE(MAX(last_seq), 0) FROM sync_cursor WHERE business_id = ? AND stream = 'documents') AS seq,
      (SELECT COUNT(*) FROM sync_outbox WHERE business_id = ? AND status IN ('pending','in_flight','failed','dead')) AS depth`)
    .get(businessId, businessId, businessId, businessId, businessId) as { n: number; debit: number; credit: number; seq: number; depth: number };
  return { journalCount: r.n, journalDebitPaise: r.debit, journalCreditPaise: r.credit, documentsSeq: r.seq, outboxDepth: r.depth };
}
