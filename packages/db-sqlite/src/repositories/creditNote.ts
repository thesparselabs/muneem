import type { CreditNote, CreditNoteListInput, CreditNotePage, CustomerSnapshot, RefundMethod } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';

type Heads = { cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number };

export interface CreditNoteLineRecord extends Heads {
  id: string; saleItemId: string; productId: string; qtyMilli: number; baseQtyMilli: number; returnedBeforeMilli: number;
  taxablePaise: number; totalPaise: number; costPaise: number;
}

export interface CreditNoteRecord extends Heads {
  id: string; businessId: string; branchId: string; terminalId: string; sessionId: string | null; warehouseId: string; saleId: string;
  customerId: string | null; seriesId: string; docNumber: string; docSeq: number; docDate: string; fy: string; kind: 'return' | 'cancel'; reason: string;
  supplyType: 'intra' | 'inter'; stateTaxKind: 'sgst' | 'utgst'; placeOfSupplyState: string; gstr1Bucket: 'cdnr' | 'cdnur' | 'na';
  taxablePaise: number; roundOffPaise: number; totalPaise: number; costPaise: number;
  refundMethod: RefundMethod; refundPaise: number; creditPaise: number; commandId: string;
  lines: readonly CreditNoteLineRecord[]; createdAt?: string;
}

export function insertCreditNote(db: Db, r: CreditNoteRecord, actor: Actor): void {
  const t = r.createdAt ?? nowIso();
  stmt(db, `INSERT INTO credit_note (id, business_id, branch_id, terminal_id, session_id, warehouse_id, sale_id, customer_id, series_id, doc_number, doc_seq,
      doc_date, fy, kind, reason, supply_type, state_tax_kind, place_of_supply_state, gstr1_bucket, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise,
      round_off_paise, total_paise, cost_paise, refund_method, refund_paise, credit_paise, command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @sessionId, @warehouseId, @saleId, @customerId, @seriesId, @docNumber, @docSeq,
      @docDate, @fy, @kind, @reason, @supplyType, @stateTaxKind, @placeOfSupplyState, @gstr1Bucket, @taxablePaise, @cgstPaise, @sgstPaise, @igstPaise, @cessPaise,
      @roundOffPaise, @totalPaise, @costPaise, @refundMethod, @refundPaise, @creditPaise, @commandId, @t, @t, @by, @device)`)
    .run({ ...r, lines: undefined, createdAt: undefined, t, by: actor.userId, device: actor.deviceId });
  const line = stmt(db, `INSERT INTO credit_note_item (id, credit_note_id, business_id, line_no, sale_item_id, product_id, qty_milli, base_qty_milli,
      returned_before_milli, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, total_paise, cost_paise)
    VALUES (@id, @noteId, @businessId, @lineNo, @saleItemId, @productId, @qtyMilli, @baseQtyMilli, @returnedBeforeMilli, @taxablePaise, @cgstPaise, @sgstPaise,
      @igstPaise, @cessPaise, @totalPaise, @costPaise)`);
  r.lines.forEach((l, i) => line.run({ ...l, noteId: r.id, businessId: r.businessId, lineNo: i + 1 }));
}

export const creditNoteIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM credit_note WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;

// What the posted credit notes of a sale have taken back so far.
export interface ReturnedSoFar { qtyBySaleItem: Map<string, number>; roundOffPaise: number; notes: number }
export function returnedSoFar(db: Db, saleId: string): ReturnedSoFar {
  const rows = stmt(db, `SELECT i.sale_item_id AS id, SUM(i.qty_milli) AS qty FROM credit_note_item i JOIN credit_note n ON n.id = i.credit_note_id
      WHERE n.sale_id = ? AND n.status = 'posted' GROUP BY i.sale_item_id`).all(saleId) as { id: string; qty: number }[];
  const notes = stmt(db, "SELECT COUNT(*) AS n, COALESCE(SUM(round_off_paise), 0) AS r FROM credit_note WHERE sale_id = ? AND status = 'posted'").get(saleId) as { n: number; r: number };
  return { qtyBySaleItem: new Map(rows.map((r) => [r.id, r.qty])), roundOffPaise: notes.r, notes: notes.n };
}

// What the customer still owes on the credit part of a sale.
export const saleOutstanding = (db: Db, saleId: string): number =>
  (stmt(db, 'SELECT credit_paise - settled_paise FROM sale WHERE id = ?').pluck().get(saleId) as number | undefined) ?? 0;

// Each sale line's stored cost and tax snapshot, keyed by line number, for pricing a return.
export interface SoldItem {
  id: string; lineNo: number; productId: string; name: string; uomCode: string; qtyMilli: number; baseQtyMilli: number; taxablePaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number; cogsPaise: number;
}
export const soldItems = (db: Db, saleId: string): SoldItem[] =>
  stmt(db, `SELECT id, line_no AS lineNo, product_id AS productId, product_name AS name, uom_code AS uomCode, qty_milli AS qtyMilli, base_qty_milli AS baseQtyMilli,
      taxable_paise AS taxablePaise, cgst_paise AS cgstPaise, sgst_paise AS sgstPaise, igst_paise AS igstPaise, cess_paise AS cessPaise, cogs_paise AS cogsPaise
    FROM sale_item WHERE sale_id = ? ORDER BY line_no`).all(saleId) as SoldItem[];

type NoteRow = {
  id: string; business_id: string; terminal_id: string; session_id: string | null; sale_id: string; customer_id: string | null; doc_number: string; doc_date: string;
  kind: CreditNote['kind']; reason: string; supply_type: CreditNote['supplyType']; state_tax_kind: CreditNote['stateTaxKind']; place_of_supply_state: string;
  gstr1_bucket: CreditNote['gstr1Bucket']; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_paise: number;
  round_off_paise: number; total_paise: number; cost_paise: number; refund_method: RefundMethod; refund_paise: number; credit_paise: number;
  allocated_paise: number; status: CreditNote['status']; created_at: string; created_by: string; sale_doc_number: string; sale_doc_date: string; customer_snapshot_json: string;
};

export function getCreditNote(db: Db, id: string): (CreditNote & { businessId: string }) | null {
  const r = stmt(db, `SELECT n.*, s.doc_number AS sale_doc_number, s.doc_date AS sale_doc_date, s.customer_snapshot_json
    FROM credit_note n JOIN sale s ON s.id = n.sale_id WHERE n.id = ?`).get(id) as NoteRow | undefined;
  if (!r) return null;
  const customer = JSON.parse(r.customer_snapshot_json) as CustomerSnapshot;
  const lines = (stmt(db, `SELECT c.id, c.line_no AS lineNo, c.sale_item_id AS saleItemId, i.line_no AS saleLineNo, c.product_id AS productId, i.product_name AS name, i.uom_code AS uomCode,
      i.hsn_code AS hsnCode, i.gst_rate_bp AS gstRateBp, c.qty_milli AS qtyMilli, c.base_qty_milli AS baseQtyMilli, c.returned_before_milli AS returnedBeforeMilli,
      c.taxable_paise AS taxablePaise, c.cgst_paise AS cgstPaise, c.sgst_paise AS sgstPaise, c.igst_paise AS igstPaise, c.cess_paise AS cessPaise,
      c.total_paise AS totalPaise, c.cost_paise AS costPaise
    FROM credit_note_item c JOIN sale_item i ON i.id = c.sale_item_id WHERE c.credit_note_id = ? ORDER BY c.line_no`).all(id) as (CreditNote['lines'][number] & { hsnCode: string | null })[])
    .map(({ hsnCode, ...l }) => ({ ...l, ...(hsnCode !== null && { hsnCode }) }));
  return {
    id: r.id, businessId: r.business_id, docNumber: r.doc_number, docDate: r.doc_date, kind: r.kind, reason: r.reason, saleId: r.sale_id,
    saleDocNumber: r.sale_doc_number, saleDocDate: r.sale_doc_date, terminalId: r.terminal_id, supplyType: r.supply_type, stateTaxKind: r.state_tax_kind,
    placeOfSupplyState: r.place_of_supply_state, gstr1Bucket: r.gstr1_bucket, taxablePaise: r.taxable_paise, cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise,
    igstPaise: r.igst_paise, cessPaise: r.cess_paise, roundOffPaise: r.round_off_paise, totalPaise: r.total_paise, costPaise: r.cost_paise,
    refundMethod: r.refund_method, refundPaise: r.refund_paise, creditPaise: r.credit_paise, allocatedPaise: r.allocated_paise, status: r.status, lines,
    createdAt: r.created_at, createdBy: r.created_by,
    ...(r.customer_id !== null && { customerId: r.customer_id }),
    ...(r.session_id !== null && { sessionId: r.session_id }),
    ...(customer.name && { customerName: customer.name }),
    ...(customer.gstin && { customerGstin: customer.gstin }),
  };
}

type ListCursor = { t: string; id: string };
const encodeCursor = (c: ListCursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): ListCursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as ListCursor;
    return typeof c.t === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

// Newest first, keyed on (created_at, id) like the sale list.
export function listCreditNotes(db: Db, businessId: string, f: CreditNoteListInput): CreditNotePage {
  const after = decodeCursor(f.cursor);
  const rows = stmt(db, `SELECT n.id, n.doc_number, n.doc_date, n.kind, n.sale_id, s.doc_number AS sale_doc_number, s.customer_snapshot_json, n.total_paise,
      n.refund_method, n.created_at
    FROM credit_note n JOIN sale s ON s.id = n.sale_id
    WHERE n.business_id = @businessId AND (@saleId IS NULL OR n.sale_id = @saleId) AND (@t IS NULL OR (n.created_at, n.id) < (@t, @id))
    ORDER BY n.created_at DESC, n.id DESC LIMIT @limit`).all({
    businessId, saleId: f.saleId ?? null, t: after?.t ?? null, id: after?.id ?? null, limit: f.limit + 1,
  }) as { id: string; doc_number: string; doc_date: string; kind: CreditNote['kind']; sale_id: string; sale_doc_number: string; customer_snapshot_json: string;
    total_paise: number; refund_method: RefundMethod; created_at: string }[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => {
      const c = JSON.parse(r.customer_snapshot_json) as CustomerSnapshot;
      return {
        id: r.id, docNumber: r.doc_number, docDate: r.doc_date, kind: r.kind, saleId: r.sale_id, saleDocNumber: r.sale_doc_number, totalPaise: r.total_paise,
        refundMethod: r.refund_method, createdAt: r.created_at, ...(c.name && { customerName: c.name }),
      };
    }),
    nextCursor: rows.length > f.limit && last ? encodeCursor({ t: last.created_at, id: last.id }) : null,
  };
}
