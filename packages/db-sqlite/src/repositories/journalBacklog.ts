import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { documentJournal, postDocumentJournal, queueJournal, reverseDocumentJournal, type JournalDocKind, type Poster } from './documentJournals.js';

export interface PendingJournal { kind: JournalDocKind; id: string; reversalOn?: string }

const localDate = (iso: string): string => new Date(iso).toLocaleDateString('en-CA');
const hasJournal = (sources: string) =>
  `NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.business_id = d.business_id AND j.ref_id = d.id AND j.source IN (${sources}) AND j.is_reversal_of IS NULL)`;
const hasReversal = (sources: string) =>
  `EXISTS (SELECT 1 FROM journal_entry j WHERE j.business_id = d.business_id AND j.ref_id = d.id AND j.source IN (${sources}) AND j.is_reversal_of IS NOT NULL)`;

// Each kind: its unposted documents in date order, and — for kinds that can be cancelled — cancelled ones still unreversed.
// A document whose journal would be empty (a register that closed exact, a stock document with no value) is left out here.
const KINDS: readonly { kind: JournalDocKind; entityType: string; sources: string; unposted: string; cancelled?: string }[] = [
  { kind: 'sale', entityType: 'sale', sources: "'sale'", unposted: 'SELECT d.id FROM sale d WHERE d.business_id = ? AND {none} ORDER BY d.doc_date, d.id' },
  { kind: 'purchase', entityType: 'purchase', sources: "'purchase'", unposted: 'SELECT d.id FROM purchase d WHERE d.business_id = ? AND {none} ORDER BY d.supplier_invoice_date, d.id',
    cancelled: "SELECT d.id, d.cancelled_at AS at FROM purchase d WHERE d.business_id = ? AND d.status = 'cancelled' AND NOT {rev}" },
  { kind: 'debit_note', entityType: 'debit_note', sources: "'purchase_return'", unposted: 'SELECT d.id FROM debit_note d WHERE d.business_id = ? AND {none} ORDER BY d.doc_date, d.id' },
  { kind: 'payment', entityType: 'payment', sources: "'receipt','payment'", unposted: 'SELECT d.id FROM payment d WHERE d.business_id = ? AND {none} ORDER BY d.payment_date, d.id',
    cancelled: "SELECT d.id, d.cancelled_at AS at FROM payment d WHERE d.business_id = ? AND d.status = 'cancelled' AND NOT {rev}" },
  { kind: 'write_off', entityType: 'write_off', sources: "'write_off'", unposted: 'SELECT d.id FROM write_off d WHERE d.business_id = ? AND {none} ORDER BY d.doc_date, d.id' },
  { kind: 'expense', entityType: 'expense', sources: "'expense'", unposted: 'SELECT d.id FROM expense d WHERE d.business_id = ? AND {none} ORDER BY d.expense_date, d.id',
    cancelled: "SELECT d.id, d.cancelled_at AS at FROM expense d WHERE d.business_id = ? AND d.status = 'cancelled' AND NOT {rev}" },
  { kind: 'stock_document', entityType: 'stock_adjustment', sources: "'opening','stock_adjustment'",
    unposted: `SELECT d.id FROM stock_adjustment d WHERE d.business_id = ? AND {none} AND EXISTS (SELECT 1 FROM stock_movement m
      WHERE m.business_id = d.business_id AND m.ref_type = d.kind AND m.ref_id = d.id AND m.movement_type <> 'cost_correction' AND m.value_paise <> 0)
      ORDER BY d.created_at, d.id` },
  { kind: 'cost_correction', entityType: 'stock_movement', sources: "'stock_adjustment'",
    unposted: "SELECT d.id FROM stock_movement d WHERE d.business_id = ? AND d.movement_type = 'cost_correction' AND d.value_paise <> 0 AND {none} ORDER BY d.rowid" },
  { kind: 'party_opening', entityType: 'party_opening', sources: "'opening'", unposted: 'SELECT d.id FROM party_opening d WHERE d.business_id = ? AND {none} ORDER BY d.as_of_date, d.id',
    cancelled: "SELECT d.id, d.cancelled_at AS at FROM party_opening d WHERE d.business_id = ? AND d.status = 'cancelled' AND NOT {rev}" },
  { kind: 'register_close', entityType: 'pos_session', sources: "'register_close'",
    unposted: "SELECT d.id FROM pos_session d WHERE d.business_id = ? AND d.status = 'closed' AND COALESCE(d.variance_paise, 0) <> 0 AND {none} ORDER BY d.closed_at, d.id" },
  { kind: 'cash_movement', entityType: 'cash_movement', sources: "'cash_movement'",
    unposted: "SELECT d.id FROM cash_movement d WHERE d.business_id = ? AND d.ref_id IS NULL AND d.kind IN ('cash_in','cash_out') AND {none} ORDER BY d.created_at, d.id" },
];

// ADR-0034: every document that should have a journal and does not, then every cancelled document still unreversed.
export function unpostedDocuments(db: Db, businessId: string): PendingJournal[] {
  const out: PendingJournal[] = [];
  for (const k of KINDS) {
    for (const id of stmt(db, k.unposted.replace('{none}', hasJournal(k.sources))).pluck().all(businessId) as string[]) {
      if ((documentJournal(db, k.kind, id)?.lines.length ?? 0) > 0) out.push({ kind: k.kind, id });
    }
  }
  for (const k of KINDS) {
    if (!k.cancelled) continue;
    const rows = stmt(db, k.cancelled.replace('{rev}', hasReversal(k.sources))).all(businessId) as { id: string; at: string | null }[];
    for (const r of rows) if ((documentJournal(db, k.kind, r.id)?.lines.length ?? 0) > 0) out.push({ kind: k.kind, id: r.id, reversalOn: localDate(r.at ?? new Date().toISOString()) });
  }
  return out;
}

const ENTITY_TYPE = new Map(KINDS.map((k) => [k.kind, k.entityType]));

// Posts a batch of the backlog in one transaction, each journal queued for sync after its document; returns how many it wrote.
export function postBacklogBatch(db: Db, businessId: string, batch: readonly PendingJournal[], poster: Poster, actor: Actor): number {
  return withTransaction(db, () => batch.reduce((n, p) => {
    const posted = p.reversalOn ? reverseDocumentJournal(db, p.kind, p.id, p.reversalOn, actor) : postDocumentJournal(db, p.kind, p.id, poster, actor);
    queueJournal(db, businessId, actor, posted, { entityType: ENTITY_TYPE.get(p.kind)!, entityId: p.id });
    return n + (posted ? 1 : 0);
  }, 0));
}

// Rebuilds the balance cache from the journal lines; returns the number of account-period rows that had drifted.
export function rebuildAccountBalances(db: Db, businessId: string): number {
  return withTransaction(db, () => {
    const drift = balanceDrift(db, businessId);
    if (drift === 0) return 0;
    stmt(db, 'DELETE FROM account_balance WHERE business_id = ?').run(businessId);
    stmt(db, `INSERT INTO account_balance (business_id, account_id, period_id, debit_paise, credit_paise)
      SELECT j.business_id, l.account_id, j.period_id, SUM(l.debit_paise), SUM(l.credit_paise)
      FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id WHERE j.business_id = ? GROUP BY l.account_id, j.period_id`).run(businessId);
    return drift;
  });
}

export function balanceDrift(db: Db, businessId: string): number {
  return stmt(db, `SELECT COUNT(*) FROM (
      SELECT l.account_id, j.period_id, SUM(l.debit_paise) AS dr, SUM(l.credit_paise) AS cr
      FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id WHERE j.business_id = @b GROUP BY l.account_id, j.period_id) x
    FULL OUTER JOIN (SELECT account_id, period_id, debit_paise AS dr, credit_paise AS cr FROM account_balance WHERE business_id = @b) c
      ON c.account_id = x.account_id AND c.period_id = x.period_id
    WHERE COALESCE(x.dr, 0) <> COALESCE(c.dr, 0) OR COALESCE(x.cr, 0) <> COALESCE(c.cr, 0)`).pluck().get({ b: businessId }) as number;
}

export function journalsNotMatchingLines(db: Db, businessId: string): number {
  return stmt(db, `SELECT COUNT(*) FROM journal_entry j WHERE j.business_id = ? AND (
      j.debit_total_paise <> (SELECT COALESCE(SUM(debit_paise), 0) FROM journal_line l WHERE l.entry_id = j.id)
      OR j.credit_total_paise <> (SELECT COALESCE(SUM(credit_paise), 0) FROM journal_line l WHERE l.entry_id = j.id))`).pluck().get(businessId) as number;
}
