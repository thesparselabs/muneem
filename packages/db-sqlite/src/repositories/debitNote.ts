import type { DebitNote } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';

export interface DebitNoteRecord extends Omit<DebitNote, 'allocatedPaise' | 'lines'> {
  businessId: string; branchId: string; warehouseId: string; seriesId: string; docSeq: number; fy: string; commandId: string;
  lines: readonly (DebitNote['lines'][number] & { id: string })[];
}

export function insertDebitNote(db: Db, r: DebitNoteRecord, actor: Actor): void {
  const t = nowIso();
  stmt(db, `INSERT INTO debit_note (id, business_id, branch_id, warehouse_id, purchase_id, supplier_id, series_id, doc_number, doc_seq, doc_date, fy,
      reason, supply_type, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, charges_paise, round_off_paise, total_paise, itc_reversed_paise, command_id,
      created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @warehouseId, @purchaseId, @supplierId, @seriesId, @docNumber, @docSeq, @docDate, @fy, @reason, @supplyType,
      @taxablePaise, @cgstPaise, @sgstPaise, @igstPaise, @cessPaise, @chargesPaise, @roundOffPaise, @totalPaise, @itcReversedPaise, @commandId, @t, @t, @by, @device)`)
    .run({ ...r, lines: undefined, t, by: actor.userId, device: actor.deviceId });
  const line = stmt(db, `INSERT INTO debit_note_item (id, debit_note_id, business_id, line_no, purchase_item_id, product_id, qty_milli, base_qty_milli,
      taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, total_paise, landed_value_paise)
    VALUES (@id, @noteId, @businessId, @lineNo, @purchaseItemId, @productId, @qtyMilli, @baseQtyMilli, @taxablePaise, @cgstPaise, @sgstPaise,
      @igstPaise, @cessPaise, @totalPaise, @landedValuePaise)`);
  r.lines.forEach((l, i) => line.run({ ...l, noteId: r.id, businessId: r.businessId, lineNo: i + 1 }));
}

export const debitNoteIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM debit_note WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;

export const debitNoteCount = (db: Db, purchaseId: string): number =>
  stmt(db, "SELECT COUNT(*) FROM debit_note WHERE purchase_id = ? AND status = 'posted'").pluck().get(purchaseId) as number;

type NoteRow = Omit<DebitNote, 'lines'> & { businessId: string };

export function getDebitNote(db: Db, id: string): (DebitNote & { businessId: string }) | null {
  const r = stmt(db, `SELECT id, business_id AS businessId, doc_number AS docNumber, doc_date AS docDate, purchase_id AS purchaseId,
      supplier_id AS supplierId, reason, supply_type AS supplyType, taxable_paise AS taxablePaise, cgst_paise AS cgstPaise, sgst_paise AS sgstPaise,
      igst_paise AS igstPaise, cess_paise AS cessPaise, charges_paise AS chargesPaise, round_off_paise AS roundOffPaise, total_paise AS totalPaise, itc_reversed_paise AS itcReversedPaise,
      allocated_paise AS allocatedPaise FROM debit_note WHERE id = ?`).get(id) as NoteRow | undefined;
  if (!r) return null;
  const lines = stmt(db, `SELECT purchase_item_id AS purchaseItemId, product_id AS productId, qty_milli AS qtyMilli, base_qty_milli AS baseQtyMilli,
      taxable_paise AS taxablePaise, cgst_paise AS cgstPaise, sgst_paise AS sgstPaise, igst_paise AS igstPaise, cess_paise AS cessPaise,
      total_paise AS totalPaise, landed_value_paise AS landedValuePaise FROM debit_note_item WHERE debit_note_id = ? ORDER BY line_no`).all(id) as DebitNote['lines'];
  return { ...r, lines };
}
