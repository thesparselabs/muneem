import type { PrintJobSummary } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';

// Print jobs are device-local bookkeeping: no audit chain, no outbox.
export interface PrintJobInput {
  businessId: string; docType: string; docId: string; doc: unknown; openDrawer: boolean; copyNo: number; isDuplicate: boolean; createdBy: string;
}

export interface PrintJob extends PrintJobSummary { businessId: string; doc: unknown; openDrawer: boolean }

type Row = {
  id: string; business_id: string; doc_type: string; doc_id: string; copy_no: number; is_duplicate: number; doc_json: string; open_drawer: number;
  status: PrintJobSummary['status']; attempt_count: number; error_message: string | null; created_at: string; completed_at: string | null;
};

const toSummary = (r: Row): PrintJobSummary => ({
  id: r.id, docType: r.doc_type, docId: r.doc_id, copyNo: r.copy_no, isDuplicate: r.is_duplicate === 1, status: r.status,
  attemptCount: r.attempt_count, createdAt: r.created_at,
  ...(r.error_message !== null && { errorMessage: r.error_message }),
  ...(r.completed_at !== null && { completedAt: r.completed_at }),
});

export function insertPrintJob(db: Db, id: string, j: PrintJobInput): void {
  stmt(db, `INSERT INTO print_job (id, business_id, doc_type, doc_id, copy_no, is_duplicate, doc_json, open_drawer, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, j.businessId, j.docType, j.docId, j.copyNo, j.isDuplicate ? 1 : 0, JSON.stringify(j.doc),
    j.openDrawer ? 1 : 0, j.createdBy, nowIso());
}

export function getPrintJob(db: Db, id: string): PrintJob | null {
  const r = stmt(db, 'SELECT * FROM print_job WHERE id = ?').get(id) as Row | undefined;
  return r ? { ...toSummary(r), businessId: r.business_id, doc: JSON.parse(r.doc_json) as unknown, openDrawer: r.open_drawer === 1 } : null;
}

export function firstPrintJobFor(db: Db, docId: string): PrintJob | null {
  const id = stmt(db, 'SELECT id FROM print_job WHERE doc_id = ? ORDER BY copy_no LIMIT 1').pluck().get(docId) as string | undefined;
  return id ? getPrintJob(db, id) : null;
}

export function nextCopyNo(db: Db, docId: string): number {
  return stmt(db, 'SELECT COALESCE(MAX(copy_no), 0) + 1 FROM print_job WHERE doc_id = ?').pluck().get(docId) as number;
}

export function markPrintJob(db: Db, id: string, status: PrintJobSummary['status'], errorMessage: string | null = null): void {
  const done = status === 'done' || status === 'failed' ? nowIso() : null;
  stmt(db, `UPDATE print_job SET status = ?, error_message = ?, completed_at = ?,
      attempt_count = attempt_count + CASE WHEN ? = 'printing' THEN 1 ELSE 0 END WHERE id = ?`).run(status, errorMessage, done, status, id);
}

export function listPrintJobs(db: Db, businessId: string, limit: number): PrintJobSummary[] {
  return (stmt(db, 'SELECT * FROM print_job WHERE business_id = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(businessId, limit) as Row[]).map(toSummary);
}

export function unfinishedPrintJobs(db: Db): { id: string; status: 'queued' | 'printing'; createdAt: string }[] {
  return stmt(db, "SELECT id, status, created_at AS createdAt FROM print_job WHERE status IN ('queued', 'printing') ORDER BY created_at")
    .all() as { id: string; status: 'queued' | 'printing'; createdAt: string }[];
}
