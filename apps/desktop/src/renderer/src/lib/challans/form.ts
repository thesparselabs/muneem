import { CHALLAN_PURPOSE_LABELS, TRANSPORT_MODES, type ChallanDraft, type ChallanPurpose, type ChallanSummary, type SaleDraft } from '@muneem/contracts';
import { stateOfGstin } from '@muneem/domain';
import { parseOptional } from '../money.js';
import type { LineUnit } from '../purchases/form.js';

export interface ChallanFormLine { productId: string; name: string; units: LineUnit[]; uomId: string; qty: string }
export interface ChallanForm {
  purpose: ChallanPurpose; customer: { id: string; name: string } | null; consigneeName: string; consigneeAddress: string; consigneeGstin: string;
  lines: ChallanFormLine[]; mode: (typeof TRANSPORT_MODES)[number]; vehicleNo: string; transporterName: string; transporterId: string;
  distanceKm: string; docNo: string; notes: string;
}

export const emptyChallanForm = (): ChallanForm => ({
  purpose: 'supply', customer: null, consigneeName: '', consigneeAddress: '', consigneeGstin: '', lines: [], mode: 'road', vehicleNo: '',
  transporterName: '', transporterId: '', distanceKm: '', docNo: '', notes: '',
});

type Parsed = { ok: true; draft: ChallanDraft } | { ok: false; errors: Record<string, string> };
const text = (v: string): string | undefined => v.trim() || undefined;

// Strings in, a draft out; formats (vehicle, GSTIN) are checked by the contract and named in its error.
export function formToDraft(f: ChallanForm): Parsed {
  const errors: Record<string, string> = {};
  if (f.lines.length === 0) errors.lines = 'add at least one product';
  if (!f.customer && !f.consigneeName.trim()) errors.consignee = 'choose a customer or type the consignee';
  const lines = f.lines.map((l, i) => {
    const qty = parseOptional(l.qty, 3);
    if (!qty || qty <= 0) errors[`lines.${i}.qty`] = 'quantity above zero';
    return { productId: l.productId, uomId: l.uomId, qtyMilli: qty ?? 0 };
  });
  const distance = f.distanceKm.trim() === '' ? undefined : Number(f.distanceKm);
  if (distance !== undefined && (!Number.isInteger(distance) || distance < 0 || distance > 4000)) errors.distanceKm = 'whole kilometres, 0 to 4000';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const transport = {
    mode: f.mode, ...(text(f.vehicleNo) && { vehicleNo: text(f.vehicleNo) }), ...(text(f.transporterName) && { transporterName: text(f.transporterName) }),
    ...(text(f.transporterId) && { transporterId: text(f.transporterId) }), ...(distance !== undefined && { distanceKm: distance }),
    ...(text(f.docNo) && { docNo: text(f.docNo) }),
  };
  const consignee = f.customer ? undefined : {
    name: f.consigneeName.trim(), ...(text(f.consigneeAddress) && { address: text(f.consigneeAddress) }), ...(text(f.consigneeGstin) && { gstin: text(f.consigneeGstin)!.toUpperCase() }),
  };
  return {
    ok: true,
    draft: { purpose: f.purpose, lines, transport, ...(f.customer ? { customerId: f.customer.id } : { consignee }), ...(text(f.notes) && { notes: text(f.notes) }) },
  };
}

// The sale draft main values a challan with: no discounts, and a consignee's GSTIN decides the place of supply.
export function quoteDraftOf(d: ChallanDraft): SaleDraft {
  const gstin = d.customerId ? undefined : d.consignee?.gstin;
  return {
    lines: d.lines.map((l) => ({ ...l, lineDiscount: { kind: 'amount', value: 0 } })), billDiscount: { kind: 'amount', value: 0 },
    ...(d.customerId && { customerId: d.customerId }),
    ...(gstin && { placeOfSupplyOverride: { stateCode: stateOfGstin(gstin), reason: 'Consignee GSTIN' } }),
  };
}

export const purposeText = (p: ChallanPurpose): string => CHALLAN_PURPOSE_LABELS[p];

export const challanStatusText = (c: Pick<ChallanSummary, 'status' | 'saleDocNumber'>): string =>
  (c.status === 'billed' ? `Invoiced as ${c.saleDocNumber ?? ''}`.trim() : 'Open');
