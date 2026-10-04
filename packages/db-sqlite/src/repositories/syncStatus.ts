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
  let state: SyncStatus['state'] = 'synced';
  if (device && device.status !== 'active') return { state: 'blocked', pending, inFlight, failed, dead, lastPushAt: log.last_push_at, lastPullAt: log.last_pull_at, online, serverSkewMs, detail: device.status_detail ?? device.status };
  if (dead > 0) state = 'blocked';
  else if (failed > 0) state = 'degraded';
  else if (inFlight > 0) state = 'syncing';
  else if (pending > 0) state = 'queued';
  else if (!log.last_push_at) state = 'never';
  return { state, pending, inFlight, failed, dead, lastPushAt: log.last_push_at, lastPullAt: log.last_pull_at, online, serverSkewMs, detail: log.last_error };
}

export function outboxDepth(db: Db): { depth: number; oldestUnsyncedAt: string | null } {
  const r = db.prepare("SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM sync_outbox WHERE status IN ('pending','in_flight','failed')").get() as { n: number; oldest: string | null };
  return { depth: r.n, oldestUnsyncedAt: r.oldest };
}
