import type { SyncStatus } from '@muneem/contracts';
import type { Db } from '../open.js';

/** LLD §8.4 — derived from sync_outbox in one query. */
export function readSyncStatus(db: Db, online: boolean, serverSkewMs: number | null): SyncStatus {
  const c = db.prepare(`SELECT
      SUM(status = 'pending') AS pending, SUM(status = 'in_flight') AS in_flight,
      SUM(status = 'failed') AS failed, SUM(status = 'dead') AS dead FROM sync_outbox`).get() as { pending: number | null; in_flight: number | null; failed: number | null; dead: number | null };
  const log = db.prepare('SELECT * FROM sync_log WHERE id = 1').get() as { last_push_at: string | null; last_push_ok: number | null; last_pull_at: string | null; last_error: string | null };
  const device = db.prepare('SELECT status, status_detail FROM sync_device WHERE id = 1').get() as { status: string; status_detail: string | null } | undefined;
  const pending = c.pending ?? 0, inFlight = c.in_flight ?? 0, failed = c.failed ?? 0, dead = c.dead ?? 0;
  const fresh = { deviceStatus: (device?.status ?? null) as SyncStatus['deviceStatus'], ...syncFreshness(db) };
  let state: SyncStatus['state'] = 'synced';
  if (device && device.status !== 'active') return { state: 'blocked', pending, inFlight, failed, dead, lastPushAt: log.last_push_at, lastPullAt: log.last_pull_at, online, serverSkewMs, detail: device.status_detail ?? device.status, ...fresh };
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

export function outboxDepth(db: Db): { depth: number; oldestUnsyncedAt: string | null } {
  const r = db.prepare("SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM sync_outbox WHERE status IN ('pending','in_flight','failed')").get() as { n: number; oldest: string | null };
  return { depth: r.n, oldestUnsyncedAt: r.oldest };
}
