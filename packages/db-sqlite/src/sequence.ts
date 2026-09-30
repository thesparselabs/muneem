import type { Db } from './open.js';
import { stmt } from './statements.js';

/** LLD §1.4 — single-row counter bumped inside the caller's transaction. */
export function nextLocalSeq(db: Db): number {
  const row = stmt(db, 'UPDATE local_sequence SET next_seq = next_seq + 1 WHERE id = 1 RETURNING next_seq - 1 AS seq').get() as { seq: number } | undefined;
  if (!row) throw new Error('local_sequence row missing');
  return row.seq;
}
