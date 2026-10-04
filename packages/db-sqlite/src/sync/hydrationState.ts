import { STREAM_ORDER } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';
import { setCursor } from './syncState.js';

export type HydrationPhase = 'pending' | 'downloading' | 'importing' | 'ready' | 'failed';

export interface Hydration {
  businessId: string; snapshotId: string | null; asOfSeq: number | null; bytesTotal: number | null; bytesDownloaded: number; linesImported: number;
  status: HydrationPhase; error: string | null; updatedAt: string;
}

type HydrationRow = {
  business_id: string; snapshot_id: string | null; as_of_seq: number | null; bytes_total: number | null; bytes_downloaded: number; lines_imported: number;
  status: HydrationPhase; error: string | null; updated_at: string;
};

const toHydration = (r: HydrationRow): Hydration => ({
  businessId: r.business_id, snapshotId: r.snapshot_id, asOfSeq: r.as_of_seq, bytesTotal: r.bytes_total, bytesDownloaded: r.bytes_downloaded,
  linesImported: r.lines_imported, status: r.status, error: r.error, updatedAt: r.updated_at,
});

export function getHydration(db: Db, businessId: string): Hydration | null {
  const r = stmt(db, 'SELECT * FROM hydration_state WHERE business_id = ?').get(businessId) as HydrationRow | undefined;
  return r ? toHydration(r) : null;
}

// Imports a killed run left part-way; a failed one waits for the user to try again.
export function unfinishedHydrations(db: Db): Hydration[] {
  return (stmt(db, "SELECT * FROM hydration_state WHERE status IN ('pending','downloading','importing') ORDER BY updated_at").all() as HydrationRow[]).map(toHydration);
}

const COLUMNS = {
  snapshotId: 'snapshot_id', asOfSeq: 'as_of_seq', bytesTotal: 'bytes_total', bytesDownloaded: 'bytes_downloaded', linesImported: 'lines_imported', status: 'status',
  error: 'error',
} as const;

export type HydrationPatch = Partial<Pick<Hydration, keyof typeof COLUMNS>>;

// 7f progress: one row per business being added to this device, written as each step completes.
export function saveHydration(db: Db, businessId: string, patch: HydrationPatch, at: string): Hydration {
  const set = Object.entries(patch).filter(([, v]) => v !== undefined).map(([k]) => k as keyof typeof COLUMNS);
  stmt(db, "INSERT INTO hydration_state (business_id, status, updated_at) VALUES (?, 'pending', ?) ON CONFLICT (business_id) DO NOTHING").run(businessId, at);
  stmt(db, `UPDATE hydration_state SET ${[...set.map((k) => `${COLUMNS[k]} = @${k}`), 'updated_at = @at'].join(', ')} WHERE business_id = @businessId`)
    .run({ ...Object.fromEntries(set.map((k) => [k, patch[k]])), at, businessId });
  return getHydration(db, businessId)!;
}

// The import is done: every stream continues from the bundle's seq, and the business is ready to bill offline.
export function finishHydration(db: Db, businessId: string, asOfSeq: number, at: string): Hydration {
  return withTransaction(db, () => {
    for (const stream of STREAM_ORDER) setCursor(db, businessId, stream, asOfSeq, at);
    return saveHydration(db, businessId, { status: 'ready', error: null }, at);
  });
}
