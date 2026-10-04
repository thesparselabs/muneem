import {
  buildJournal, CASH_MOVEMENT_RULE, COST_CORRECTION_RULE, DEBIT_NOTE_RULE, EXPENSE_RULE, OPENING_STOCK_RULE, PARTY_OPENING_RULE, PURCHASE_RULE, RECEIPT_RULE,
  REGISTER_VARIANCE_RULE, SALE_RULE, STOCK_ADJUSTMENT_RULE, SUPPLIER_PAYMENT_RULE, WRITE_OFF_RULE, type JournalLine, type TaxHeads,
} from '@muneem/domain';
import type { Db } from '../open.js';
import { appendOutbox } from '../outbox.js';
import { stmt } from '../statements.js';
import type { Actor } from './business.js';
import { journalForRef, postJournal, reverseJournal, type JournalInput, type PostedJournal } from './journal.js';

// Every journal is built from the document as stored, so live posting and the backfill can never differ (ADR-0030/0034).
export type JournalDocKind =
  | 'sale' | 'purchase' | 'debit_note' | 'payment' | 'write_off' | 'expense' | 'stock_document' | 'cost_correction' | 'party_opening'
  | 'register_close' | 'cash_movement';
// Who numbers a journal whose document has no number, and the branch it falls under when the document has none.
export interface Poster { branchId: string; terminalId: string }


const localDate = (iso: string): string => new Date(iso).toLocaleDateString('en-CA');
const heads = (r: { cgst: number; sgst: number; igst: number; cess: number }): TaxHeads => ({ cgstPaise: r.cgst, sgstPaise: r.sgst, igstPaise: r.igst, cessPaise: r.cess });
const get = <T>(db: Db, sql: string, ...args: unknown[]): T | undefined => stmt(db, sql).get(...args) as T | undefined;

interface Built { input: Omit<JournalInput, 'businessId'>; businessId: string }

function sale(db: Db, id: string): Built | null {
  const s = get<{ business_id: string; branch_id: string; terminal_id: string; doc_number: string; doc_date: string; customer_id: string | null;
    taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_paise: number; round_off_paise: number; credit_paise: number;
    cogs_paise: number }>(db, 'SELECT * FROM sale WHERE id = ?', id);
  if (!s) return null;
  const t = get<{ cash: number; clearing: number }>(db, `SELECT COALESCE(SUM(CASE WHEN method = 'cash' THEN amount_paise - change_paise END), 0) AS cash,
      COALESCE(SUM(CASE WHEN method NOT IN ('cash','credit') THEN amount_paise END), 0) AS clearing FROM sale_tender WHERE sale_id = ?`, id)!;
  const lines = buildJournal(SALE_RULE, {
    cashPaise: t.cash, clearingPaise: t.clearing, creditPaise: s.credit_paise, customerId: s.customer_id, taxablePaise: s.taxable_paise,
    tax: heads({ cgst: s.cgst_paise, sgst: s.sgst_paise, igst: s.igst_paise, cess: s.cess_paise }), roundOffPaise: s.round_off_paise, cogsPaise: s.cogs_paise,
  });
  return { businessId: s.business_id, input: { branchId: s.branch_id, terminalId: s.terminal_id, source: 'sale', refType: 'sale', refId: id, entryNo: s.doc_number, docDate: s.doc_date, lines } };
}

function purchase(db: Db, id: string): Built | null {
  const p = get<{ business_id: string; branch_id: string; supplier_id: string; doc_number: string; supplier_invoice_date: string; supplier_invoice_no: string;
    round_off_paise: number; total_paise: number }>(db, 'SELECT * FROM purchase WHERE id = ?', id);
  if (!p) return null;
  const i = get<{ landed: number; cgst: number; sgst: number; igst: number; cess: number }>(db, `SELECT COALESCE(SUM(landed_value_paise), 0) AS landed,
      COALESCE(SUM(CASE WHEN itc_eligible = 1 THEN cgst_paise END), 0) AS cgst, COALESCE(SUM(CASE WHEN itc_eligible = 1 THEN sgst_paise END), 0) AS sgst,
      COALESCE(SUM(CASE WHEN itc_eligible = 1 THEN igst_paise END), 0) AS igst, COALESCE(SUM(CASE WHEN itc_eligible = 1 THEN cess_paise END), 0) AS cess
    FROM purchase_item WHERE purchase_id = ?`, id)!;
  const lines = buildJournal(PURCHASE_RULE, { supplierId: p.supplier_id, inventoryPaise: i.landed, itc: heads(i), roundOffPaise: p.round_off_paise, totalPaise: p.total_paise });
  // ADR-0033: posted on the supplier's bill date — the accrual date and the ITC period.
  return { businessId: p.business_id, input: { branchId: p.branch_id, source: 'purchase', refType: 'purchase', refId: id, entryNo: p.doc_number,
    docDate: p.supplier_invoice_date, narration: `Bill ${p.supplier_invoice_no}`, lines } };
}

function debitNote(db: Db, id: string): Built | null {
  const n = get<{ business_id: string; branch_id: string; supplier_id: string; doc_number: string; doc_date: string; total_paise: number; charges_paise: number;
    round_off_paise: number }>(db, 'SELECT * FROM debit_note WHERE id = ?', id);
  if (!n) return null;
  // The goods' landed value is taxable + their freight share + tax that could not be claimed, so the freight share is recoverable.
  const i = get<{ landed: number; share: number; cgst: number; sgst: number; igst: number; cess: number }>(db, `SELECT COALESCE(SUM(d.landed_value_paise), 0) AS landed,
      COALESCE(SUM(d.landed_value_paise - d.taxable_paise - CASE WHEN p.itc_eligible = 1 THEN 0 ELSE d.cgst_paise + d.sgst_paise + d.igst_paise + d.cess_paise END), 0) AS share,
      COALESCE(SUM(CASE WHEN p.itc_eligible = 1 THEN d.cgst_paise END), 0) AS cgst, COALESCE(SUM(CASE WHEN p.itc_eligible = 1 THEN d.sgst_paise END), 0) AS sgst,
      COALESCE(SUM(CASE WHEN p.itc_eligible = 1 THEN d.igst_paise END), 0) AS igst, COALESCE(SUM(CASE WHEN p.itc_eligible = 1 THEN d.cess_paise END), 0) AS cess
    FROM debit_note_item d JOIN purchase_item p ON p.id = d.purchase_item_id WHERE d.debit_note_id = ?`, id)!;
  const lines = buildJournal(DEBIT_NOTE_RULE, {
    supplierId: n.supplier_id, totalPaise: n.total_paise, inventoryPaise: i.landed, itcReversed: heads(i), lossPaise: i.share - n.charges_paise, roundOffPaise: n.round_off_paise,
  });
  return { businessId: n.business_id, input: { branchId: n.branch_id, source: 'purchase_return', refType: 'debit_note', refId: id, entryNo: n.doc_number, docDate: n.doc_date, lines } };
}

function payment(db: Db, id: string): Built | null {
  const p = get<{ business_id: string; branch_id: string; terminal_id: string | null; party_type: 'customer' | 'supplier'; party_id: string; doc_number: string;
    payment_date: string; method: string; amount_paise: number }>(db, 'SELECT * FROM payment WHERE id = ?', id);
  if (!p) return null;
  const facts = { partyType: p.party_type, partyId: p.party_id, method: p.method, amountPaise: p.amount_paise };
  const lines = buildJournal(p.party_type === 'customer' ? RECEIPT_RULE : SUPPLIER_PAYMENT_RULE, facts);
  return { businessId: p.business_id, input: { branchId: p.branch_id, terminalId: p.terminal_id, source: p.party_type === 'customer' ? 'receipt' : 'payment',
    refType: 'payment', refId: id, entryNo: p.doc_number, docDate: p.payment_date, lines } };
}

function writeOff(db: Db, id: string): Built | null {
  const w = get<{ business_id: string; customer_id: string; doc_date: string; amount_paise: number; reason: string }>(db, 'SELECT * FROM write_off WHERE id = ?', id);
  if (!w) return null;
  return { businessId: w.business_id, input: { source: 'write_off', refType: 'write_off', refId: id, docDate: w.doc_date, narration: w.reason,
    lines: buildJournal(WRITE_OFF_RULE, { customerId: w.customer_id, amountPaise: w.amount_paise }) } };
}

function expense(db: Db, id: string): Built | null {
  const e = get<{ business_id: string; branch_id: string; terminal_id: string | null; supplier_id: string | null; doc_number: string; expense_date: string;
    method: string; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_paise: number; itc_paise: number; round_off_paise: number;
    total_paise: number; account_code: string; description: string | null }>(db,
    'SELECT e.*, c.account_code FROM expense e JOIN expense_category c ON c.id = e.category_id WHERE e.id = ?', id);
  if (!e) return null;
  const tax = heads({ cgst: e.cgst_paise, sgst: e.sgst_paise, igst: e.igst_paise, cess: e.cess_paise });
  const claimed = e.itc_paise > 0;
  const lines = buildJournal(EXPENSE_RULE, {
    expenseAccount: { code: e.account_code }, method: e.method, supplierId: e.supplier_id, roundOffPaise: e.round_off_paise, totalPaise: e.total_paise,
    expensePaise: e.taxable_paise + (claimed ? 0 : tax.cgstPaise + tax.sgstPaise + tax.igstPaise + tax.cessPaise),
    itc: claimed ? tax : { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0 },
  });
  return { businessId: e.business_id, input: { branchId: e.branch_id, terminalId: e.terminal_id, source: 'expense', refType: 'expense', refId: id,
    entryNo: e.doc_number, docDate: e.expense_date, narration: e.description, lines } };
}

// Opening stock, adjustments and stock takes post their movements' values, not a recomputation (ADR-0018).
function stockDocument(db: Db, id: string): Built | null {
  const d = get<{ business_id: string; kind: 'opening' | 'adjustment' | 'stock_take'; created_at: string; note: string | null; branch_id: string }>(db,
    'SELECT a.*, w.branch_id FROM stock_adjustment a JOIN warehouse w ON w.id = a.warehouse_id WHERE a.id = ?', id);
  if (!d) return null;
  const v = get<{ gain: number; loss: number }>(db, `SELECT COALESCE(SUM(CASE WHEN value_paise > 0 THEN value_paise END), 0) AS gain,
      COALESCE(-SUM(CASE WHEN value_paise < 0 THEN value_paise END), 0) AS loss
    FROM stock_movement WHERE ref_type = ? AND ref_id = ? AND movement_type <> 'cost_correction'`, d.kind, id)!;
  const lines = d.kind === 'opening'
    ? buildJournal(OPENING_STOCK_RULE, { valuePaise: v.gain - v.loss })
    : buildJournal(STOCK_ADJUSTMENT_RULE, { lossPaise: v.loss, gainPaise: v.gain });
  return { businessId: d.business_id, input: { branchId: d.branch_id, source: d.kind === 'opening' ? 'opening' : 'stock_adjustment', refType: d.kind,
    refId: id, docDate: localDate(d.created_at), narration: d.note, lines } };
}

function costCorrection(db: Db, id: string): Built | null {
  const m = get<{ business_id: string; value_paise: number; occurred_at: string; branch_id: string }>(db,
    "SELECT m.*, w.branch_id FROM stock_movement m JOIN warehouse w ON w.id = m.warehouse_id WHERE m.id = ? AND m.movement_type = 'cost_correction'", id);
  if (!m) return null;
  return { businessId: m.business_id, input: { branchId: m.branch_id, source: 'stock_adjustment', refType: 'cost_correction', refId: id,
    docDate: localDate(m.occurred_at), narration: 'Cost of units sold below zero corrected', lines: buildJournal(COST_CORRECTION_RULE, { valuePaise: m.value_paise }) } };
}

function partyOpening(db: Db, id: string): Built | null {
  const o = get<{ business_id: string; party_type: 'customer' | 'supplier'; party_id: string; side: string; amount_paise: number; as_of_date: string }>(db,
    'SELECT * FROM party_opening WHERE id = ?', id);
  if (!o) return null;
  const signedPaise = o.side === 'receivable' ? o.amount_paise : -o.amount_paise;
  return { businessId: o.business_id, input: { source: 'opening', refType: 'party_opening', refId: id, docDate: o.as_of_date, narration: 'Opening balance',
    lines: buildJournal(PARTY_OPENING_RULE, { partyType: o.party_type, partyId: o.party_id, signedPaise }) } };
}

function registerClose(db: Db, id: string): Built | null {
  const s = get<{ business_id: string; branch_id: string; terminal_id: string; session_no: number; status: string; closed_at: string | null; variance_paise: number | null }>(db,
    'SELECT * FROM pos_session WHERE id = ?', id);
  if (!s || s.status !== 'closed' || !s.closed_at) return null;
  return { businessId: s.business_id, input: { branchId: s.branch_id, terminalId: s.terminal_id, source: 'register_close', refType: 'pos_session', refId: id,
    docDate: localDate(s.closed_at), narration: `Register ${s.session_no} closed`, lines: buildJournal(REGISTER_VARIANCE_RULE, { variancePaise: s.variance_paise ?? 0 }) } };
}

// Only cash moved without a document: a payment or expense through the drawer posts with its own document (ADR-0032).
function cashMovement(db: Db, id: string): Built | null {
  const c = get<{ business_id: string; kind: string; amount_paise: number; reason: string; created_at: string; ref_id: string | null; branch_id: string; terminal_id: string }>(db,
    'SELECT c.*, s.branch_id, s.terminal_id FROM cash_movement c JOIN pos_session s ON s.id = c.session_id WHERE c.id = ?', id);
  if (!c || c.ref_id !== null || (c.kind !== 'cash_in' && c.kind !== 'cash_out')) return null;
  return { businessId: c.business_id, input: { branchId: c.branch_id, terminalId: c.terminal_id, source: 'cash_movement', refType: 'cash_movement', refId: id,
    docDate: localDate(c.created_at), narration: c.reason,
    lines: buildJournal(CASH_MOVEMENT_RULE, { direction: c.kind === 'cash_in' ? 'in' : 'out', amountPaise: c.amount_paise }) } };
}

const BUILDERS: Record<JournalDocKind, (db: Db, id: string) => Built | null> = {
  sale, purchase, debit_note: debitNote, payment, write_off: writeOff, expense, stock_document: stockDocument, cost_correction: costCorrection,
  party_opening: partyOpening, register_close: registerClose, cash_movement: cashMovement,
};

export function documentJournal(db: Db, kind: JournalDocKind, id: string): (JournalInput & { lines: readonly JournalLine[] }) | null {
  const b = BUILDERS[kind](db, id);
  return b ? { ...b.input, businessId: b.businessId } : null;
}

// Posts a document's journal; a document that is already posted (a retried command, the backfill) posts nothing.
export function postDocumentJournal(db: Db, kind: JournalDocKind, id: string, poster: Poster, actor: Actor, dateOverride?: string): PostedJournal | null {
  const j = documentJournal(db, kind, id);
  if (!j || journalForRef(db, j.businessId, j.source, j.refId)) return null;
  return postJournal(db, { ...j, branchId: j.branchId ?? poster.branchId, terminalId: j.terminalId ?? poster.terminalId, ...(dateOverride && { docDate: dateOverride }) }, actor);
}

// A cancellation reverses the document's journal on the day of the cancel.
export function reverseDocumentJournal(db: Db, kind: JournalDocKind, id: string, date: string, poster: Poster, actor: Actor): PostedJournal | null {
  const j = documentJournal(db, kind, id);
  if (!j) return null;
  return reverseJournal(db, { businessId: j.businessId, branchId: j.branchId ?? poster.branchId, terminalId: j.terminalId ?? poster.terminalId,
    source: j.source, refType: j.refType, refId: j.refId, docDate: date, narration: 'Cancelled' }, actor);
}

// Every cost correction a document's receipts or returns caused gets its own journal (6b details).
export function postCorrections(db: Db, refType: string, refId: string, poster: Poster, actor: Actor): PostedJournal[] {
  const ids = stmt(db, `SELECT c.id FROM stock_movement m JOIN stock_movement c ON c.ref_type = 'correction' AND c.ref_id = m.id
    WHERE m.ref_type = ? AND m.ref_id = ? ORDER BY c.rowid`).pluck().all(refType, refId) as string[];
  return ids.flatMap((id) => postDocumentJournal(db, 'cost_correction', id, poster, actor) ?? []);
}

// For documents whose repository records them: the journal follows as its own sync row, after the document's (6b details).
export function queueJournal(db: Db, businessId: string, actor: Actor, journal: PostedJournal | null, documentEntityId: string): void {
  if (!journal) return;
  const dependsOn = stmt(db, 'SELECT operation_id FROM sync_outbox WHERE entity_id = ? ORDER BY seq DESC LIMIT 1').pluck().get(documentEntityId) as string | undefined;
  appendOutbox(db, { businessId, deviceId: actor.deviceId, entityType: 'journal_entry', entityId: journal.id, operationType: 'create', payload: journal,
    ...(dependsOn && { dependsOnOperationId: dependsOn }) });
}
