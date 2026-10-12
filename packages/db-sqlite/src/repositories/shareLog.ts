import type { ShareChannel, ShareDocType, ShareRecord, ShareStatus } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';

// FR-085 (ADR-0067): this device's record of shared documents, and the queue its emails wait in.
export interface NewShare {
  id: string; businessId: string; docType: ShareDocType; docId: string; docLabel: string; channel: ShareChannel; recipient: string;
  subject: string; message: string; fileName: string; pdf: Buffer | null; status: 'opened' | 'queued'; createdBy: string;
}
export interface QueuedEmail {
  id: string; businessId: string; recipient: string; subject: string; message: string; fileName: string; pdf: Buffer; attempts: number;
}
export type ShareOutcome =
  | { status: 'sent'; sentAt: string }
  | { status: 'queued'; nextAttemptAt: string; error: string }
  | { status: 'failed'; error: string };

type Row = {
  id: string; doc_type: ShareDocType; doc_id: string; doc_label: string; channel: ShareChannel; recipient: string; status: ShareStatus;
  file_name: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null;
};
const toRecord = (r: Row): ShareRecord => ({
  id: r.id, docType: r.doc_type, docId: r.doc_id, docLabel: r.doc_label, channel: r.channel, to: r.recipient, status: r.status,
  fileName: r.file_name, attempts: r.attempts, createdAt: r.created_at, ...(r.last_error && { lastError: r.last_error }), ...(r.sent_at && { sentAt: r.sent_at }),
});

export function insertShare(db: Db, s: NewShare, at: string): void {
  stmt(db, `INSERT INTO share_log (id, business_id, doc_type, doc_id, doc_label, channel, recipient, subject, message, file_name, pdf, status,
      next_attempt_at, created_by, created_at, updated_at)
    VALUES (@id, @businessId, @docType, @docId, @docLabel, @channel, @recipient, @subject, @message, @fileName, @pdf, @status,
      CASE WHEN @status = 'queued' THEN @at END, @createdBy, @at, @at)`).run({ ...s, at });
}

export function getShare(db: Db, businessId: string, id: string): ShareRecord | null {
  const r = stmt(db, 'SELECT * FROM share_log WHERE business_id = ? AND id = ?').get(businessId, id) as Row | undefined;
  return r ? toRecord(r) : null;
}

export function listShares(db: Db, businessId: string, docType: ShareDocType, docId: string): ShareRecord[] {
  return (stmt(db, 'SELECT * FROM share_log WHERE business_id = ? AND doc_type = ? AND doc_id = ? ORDER BY created_at DESC, id DESC')
    .all(businessId, docType, docId) as Row[]).map(toRecord);
}

type QueuedRow = { id: string; business_id: string; recipient: string; subject: string; message: string; file_name: string; pdf: Buffer; attempts: number };
const QUEUED = 'SELECT id, business_id, recipient, subject, message, file_name, pdf, attempts FROM share_log';

// Marks the email sending, so no other drain sends it too.
function claim(db: Db, r: QueuedRow | undefined, at: string): QueuedEmail | null {
  if (!r) return null;
  stmt(db, `UPDATE share_log SET status = 'sending', updated_at = ? WHERE id = ?`).run(at, r.id);
  return { id: r.id, businessId: r.business_id, recipient: r.recipient, subject: r.subject, message: r.message, fileName: r.file_name, pdf: r.pdf, attempts: r.attempts };
}

export function claimDueEmail(db: Db, businessId: string, at: string): QueuedEmail | null {
  return withTransaction(db, () => claim(db, stmt(db, `${QUEUED} WHERE business_id = ? AND status = 'queued' AND next_attempt_at <= ? ORDER BY next_attempt_at, id LIMIT 1`)
    .get(businessId, at) as QueuedRow | undefined, at));
}

export function claimEmail(db: Db, businessId: string, id: string, at: string): QueuedEmail | null {
  return withTransaction(db, () => claim(db, stmt(db, `${QUEUED} WHERE id = ? AND business_id = ? AND status = 'queued'`).get(id, businessId) as QueuedRow | undefined, at));
}

// One attempt's result; a share that is done no longer keeps its PDF.
export function settleShare(db: Db, id: string, o: ShareOutcome, at: string): void {
  stmt(db, `UPDATE share_log SET status = @status, attempts = attempts + 1, updated_at = @at,
      sent_at = @sentAt, next_attempt_at = @nextAttemptAt, last_error = @error, pdf = CASE WHEN @status = 'queued' THEN pdf END
    WHERE id = @id AND status = 'sending'`).run({
    id, at, status: o.status, sentAt: o.status === 'sent' ? o.sentAt : null,
    nextAttemptAt: o.status === 'queued' ? o.nextAttemptAt : null, error: o.status === 'sent' ? null : o.error,
  });
}

// An email left sending by a crash goes back to the queue; the cloud answers a resend of a delivered one without a second email.
export function requeueSending(db: Db, at: string): number {
  return stmt(db, `UPDATE share_log SET status = 'queued', next_attempt_at = @at, updated_at = @at WHERE status = 'sending'`).run({ at }).changes;
}
