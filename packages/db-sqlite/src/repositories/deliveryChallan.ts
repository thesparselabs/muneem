import type { Challan, ChallanListInput, ChallanPage, ChallanPurpose, Consignee, CustomerSnapshot, QuoteLine, SaleDraft, SaleTotals, Transport } from '@muneem/contracts';
import { stateOfGstin } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';
import { customerSnapshot, getCustomer } from './customer.js';
import { insertPricedLines, pricedLines, totalsOf, totalsParams, type TotalsRow } from './pricedLines.js';

// FR-087 (ADR-0069): a delivery challan is stored as valued, like an estimate, and never posts.
export interface ChallanRecord {
  id: string; businessId: string; branchId: string; terminalId: string; commandId: string; seriesId: string; docNumber: string; docSeq: number;
  docDate: string; fy: string; purpose: ChallanPurpose; customerId: string | null; consignee: Consignee | null; placeOfSupplyReason: string | null;
  totals: SaleTotals; lines: readonly QuoteLine[]; transport: Transport; notes: string | null; createdAt?: string;
}
export interface ChallanBilling { saleId: string; saleDocNumber: string; billedAt: string }

export function insertChallan(db: Db, r: ChallanRecord, actor: Actor): void {
  const at = r.createdAt ?? nowIso();
  const t = r.transport;
  stmt(db, `INSERT INTO delivery_challan (id, business_id, branch_id, terminal_id, command_id, series_id, doc_number, doc_seq, doc_date, fy, purpose,
      customer_id, consignee_name, consignee_address, consignee_gstin, doc_type, place_of_supply_state, place_of_supply_reason, supply_type,
      state_tax_kind, gstr1_bucket, gross_paise, line_discount_paise, bill_discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise,
      cess_paise, round_off_paise, total_paise, transport_mode, vehicle_no, transporter_name, transporter_id, distance_km, transport_doc_no, notes,
      created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @commandId, @seriesId, @docNumber, @docSeq, @docDate, @fy, @purpose,
      @customerId, @consigneeName, @consigneeAddress, @consigneeGstin, @docType, @posState, @posReason, @supplyType,
      @stateTaxKind, @bucket, @gross, @lineDisc, @billDisc, @taxable, @cgst, @sgst, @igst,
      @cess, @roundOff, @total, @mode, @vehicleNo, @transporterName, @transporterId, @distanceKm, @docNo, @notes,
      @at, @at, @createdBy, @deviceId)`).run({
    id: r.id, businessId: r.businessId, branchId: r.branchId, terminalId: r.terminalId, commandId: r.commandId, seriesId: r.seriesId,
    docNumber: r.docNumber, docSeq: r.docSeq, docDate: r.docDate, fy: r.fy, purpose: r.purpose, customerId: r.customerId,
    consigneeName: r.consignee?.name ?? null, consigneeAddress: r.consignee?.address ?? null, consigneeGstin: r.consignee?.gstin ?? null,
    posReason: r.placeOfSupplyReason, ...totalsParams(r.totals), mode: t.mode, vehicleNo: t.vehicleNo ?? null, transporterName: t.transporterName ?? null,
    transporterId: t.transporterId ?? null, distanceKm: t.distanceKm ?? null, docNo: t.docNo ?? null, notes: r.notes, at,
    createdBy: actor.userId, deviceId: actor.deviceId,
  });
  insertPricedLines(db, 'delivery_challan_item', r.id, r.businessId, r.lines);
}

export function markChallanBilled(db: Db, id: string, b: ChallanBilling): void {
  stmt(db, `UPDATE delivery_challan SET status = 'billed', sale_id = @saleId, sale_doc_number = @saleDocNumber, billed_at = @billedAt,
      updated_at = @billedAt, version = version + 1 WHERE id = @id`).run({ id, ...b });
}

export function challanIdByCommand(db: Db, businessId: string, commandId: string): string | null {
  return (stmt(db, 'SELECT id FROM delivery_challan WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;
}

type Row = TotalsRow & {
  id: string; business_id: string; doc_number: string; doc_date: string; purpose: ChallanPurpose; customer_id: string | null;
  consignee_name: string | null; consignee_address: string | null; consignee_gstin: string | null; place_of_supply_reason: string | null;
  transport_mode: Transport['mode']; vehicle_no: string | null; transporter_name: string | null; transporter_id: string | null;
  distance_km: number | null; transport_doc_no: string | null; notes: string | null; status: 'open' | 'billed'; sale_id: string | null;
  sale_doc_number: string | null; billed_at: string | null; created_at: string; created_by: string;
};

// A customer is shown as on file today; any other consignee as typed on the challan.
function consigneeOf(db: Db, r: Row): CustomerSnapshot {
  if (r.customer_id) return customerSnapshot(getCustomer(db, r.customer_id));
  return {
    walkIn: false, name: r.consignee_name ?? '',
    ...(r.consignee_address && { address: r.consignee_address }),
    ...(r.consignee_gstin && { gstin: r.consignee_gstin, stateCode: stateOfGstin(r.consignee_gstin) }),
  };
}

const transportOf = (r: Row): Transport => ({
  mode: r.transport_mode,
  ...(r.vehicle_no && { vehicleNo: r.vehicle_no }), ...(r.transporter_name && { transporterName: r.transporter_name }),
  ...(r.transporter_id && { transporterId: r.transporter_id }), ...(r.distance_km !== null && { distanceKm: r.distance_km }),
  ...(r.transport_doc_no && { docNo: r.transport_doc_no }),
});

function draftOf(r: Row, lines: readonly QuoteLine[]): SaleDraft {
  return {
    lines: lines.map((l) => ({ productId: l.productId, uomId: l.uomId, qtyMilli: l.qtyMilli, lineDiscount: l.lineDiscount })),
    billDiscount: { kind: 'amount', value: 0 },
    ...(r.customer_id && { customerId: r.customer_id }),
    ...(r.place_of_supply_reason && { placeOfSupplyOverride: { stateCode: r.place_of_supply_state, reason: r.place_of_supply_reason } }),
  };
}

export function getChallan(db: Db, id: string): (Challan & { businessId: string }) | null {
  const r = stmt(db, 'SELECT * FROM delivery_challan WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  const lines = pricedLines(db, 'delivery_challan_item', id);
  return {
    id: r.id, businessId: r.business_id, docNumber: r.doc_number, docDate: r.doc_date, purpose: r.purpose, status: r.status,
    consignee: consigneeOf(db, r), transport: transportOf(r), totals: totalsOf(r, lines), lines, draft: draftOf(r, lines),
    createdAt: r.created_at, createdBy: r.created_by,
    ...(r.customer_id && { customerId: r.customer_id }), ...(r.notes && { notes: r.notes }),
    ...(r.sale_id && { saleId: r.sale_id }), ...(r.sale_doc_number && { saleDocNumber: r.sale_doc_number }), ...(r.billed_at && { billedAt: r.billed_at }),
  };
}

type ListCursor = { d: string; id: string };
const encodeCursor = (c: ListCursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): ListCursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as ListCursor;
    return typeof c.d === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

export function listChallans(db: Db, businessId: string, f: ChallanListInput): ChallanPage {
  const after = decodeCursor(f.cursor);
  const rows = stmt(db, `SELECT d.id, d.doc_number, d.doc_date, d.purpose, d.vehicle_no, d.total_paise, d.status, d.sale_doc_number,
      COALESCE(c.name, d.consignee_name) AS consignee
    FROM delivery_challan d LEFT JOIN customer c ON c.id = d.customer_id
    WHERE d.business_id = @businessId AND (@status IS NULL OR d.status = @status) AND (@d IS NULL OR (d.doc_date, d.id) < (@d, @id))
    ORDER BY d.doc_date DESC, d.id DESC LIMIT @limit`).all({
    businessId, status: f.status ?? null, d: after?.d ?? null, id: after?.id ?? null, limit: f.limit + 1,
  }) as (Pick<Row, 'id' | 'doc_number' | 'doc_date' | 'purpose' | 'vehicle_no' | 'total_paise' | 'status' | 'sale_doc_number'> & { consignee: string })[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id, docNumber: r.doc_number, docDate: r.doc_date, purpose: r.purpose, consigneeName: r.consignee, totalPaise: r.total_paise, status: r.status,
      ...(r.vehicle_no && { vehicleNo: r.vehicle_no }), ...(r.sale_doc_number && { saleDocNumber: r.sale_doc_number }),
    })),
    nextCursor: rows.length > f.limit && last ? encodeCursor({ d: last.doc_date, id: last.id }) : null,
  };
}
