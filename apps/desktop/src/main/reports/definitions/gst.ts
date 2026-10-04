import type { ReportColumn, ReportColumnKind } from '@muneem/contracts';
import { buildItcRegister, monthStart, placeOfSupplyLabel, uqcLabel, type Gstr1, type InwardKind, type TaxAmounts } from '@muneem/domain';
import { getBusiness, gstMonthReturn, productsMissingHsn, type GstMonthReturn } from '@muneem/db-sqlite';
import { dateParam, type ReportDefinition, type ReportScope, type Row } from '../definition.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// The offline tool's date form, e.g. "03-May-2026".
export const gstDate = (d: string): string => `${d.slice(8, 10)}-${MONTHS[Number(d.slice(5, 7)) - 1]}-${d.slice(0, 4)}`;
const rate = (bp: number): number => bp / 100;
const col = (key: string, label: string, kind: ReportColumnKind = 'text'): ReportColumn => ({ key, label, kind });

const monthParam = dateParam('month', 'Month (first day)');

function monthReturn(scope: ReportScope, month: string): GstMonthReturn {
  return gstMonthReturn(scope.db, scope.businessId, monthStart(month), getBusiness(scope.db, scope.businessId)?.taxScheme === 'regular');
}

const sum = (rows: readonly Row[], keys: readonly string[], label: Row): Row =>
  ({ ...label, ...Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + (typeof r[k] === 'number' ? r[k] : 0), 0)])) });

// GSTR-1 sections in the GST offline tool's column order; the CSV carries no header lines so the tool can import it (ADR-0044).
function section(key: string, title: string, columns: ReportColumn[], rows: (g: Gstr1) => Row[], totalKeys: string[]): ReportDefinition {
  return {
    id: `gst.gstr1.${key}`, title: `GSTR-1 ${title}`, group: 'GST', permission: 'gst.view', params: [monthParam], columns, bare: true,
    run: (scope, p) => {
      const out = rows(monthReturn(scope, p.month!).gstr1);
      return { rows: out, totals: out.length > 0 ? sum(out, totalKeys, { [columns[0]!.key]: 'Total' }) : null };
    },
  };
}

const RATE_TAIL = [col('applicable', 'Applicable % of Tax Rate'), col('rate', 'Rate', 'number'), col('taxablePaise', 'Taxable Value', 'money'), col('cessPaise', 'Cess Amount', 'money')];
const amounts = (a: TaxAmounts & { rateBp: number }) => ({ applicable: '', rate: rate(a.rateBp), taxablePaise: a.taxablePaise, cessPaise: a.cessPaise });

const b2b = section('b2b', 'B2B', [
  col('gstin', 'GSTIN/UIN of Recipient'), col('name', 'Receiver Name'), col('number', 'Invoice Number'), col('date', 'Invoice date'),
  col('valuePaise', 'Invoice Value', 'money'), col('pos', 'Place Of Supply'), col('rc', 'Reverse Charge'), RATE_TAIL[0]!, col('type', 'Invoice Type'),
  col('ecom', 'E-Commerce GSTIN'), ...RATE_TAIL.slice(1),
], (g) => g.b2b.map((r) => ({
  gstin: r.gstin, name: r.name, number: r.invoiceNumber, date: gstDate(r.invoiceDate), valuePaise: r.invoiceValuePaise, pos: placeOfSupplyLabel(r.placeOfSupply),
  rc: 'N', type: 'Regular B2B', ecom: '', ...amounts(r),
})), ['taxablePaise', 'cessPaise']);

const b2cl = section('b2cl', 'B2CL', [
  col('number', 'Invoice Number'), col('date', 'Invoice date'), col('valuePaise', 'Invoice Value', 'money'), col('pos', 'Place Of Supply'), ...RATE_TAIL,
  col('ecom', 'E-Commerce GSTIN'),
], (g) => g.b2cl.map((r) => ({
  number: r.invoiceNumber, date: gstDate(r.invoiceDate), valuePaise: r.invoiceValuePaise, pos: placeOfSupplyLabel(r.placeOfSupply), ...amounts(r), ecom: '',
})), ['taxablePaise', 'cessPaise']);

const b2cs = section('b2cs', 'B2CS', [col('type', 'Type'), col('pos', 'Place Of Supply'), ...RATE_TAIL, col('ecom', 'E-Commerce GSTIN')],
  (g) => g.b2cs.map((r) => ({ type: 'OE', pos: placeOfSupplyLabel(r.placeOfSupply), ...amounts(r), ecom: '' })), ['taxablePaise', 'cessPaise']);

const cdnr = section('cdnr', 'CDNR', [
  col('gstin', 'GSTIN/UIN of Recipient'), col('name', 'Receiver Name'), col('number', 'Note Number'), col('date', 'Note Date'), col('noteType', 'Note Type'),
  col('pos', 'Place Of Supply'), col('rc', 'Reverse Charge'), col('supplyType', 'Note Supply Type'), col('valuePaise', 'Note Value', 'money'), ...RATE_TAIL,
], (g) => g.cdnr.map((r) => ({
  gstin: r.gstin, name: r.name, number: r.noteNumber, date: gstDate(r.noteDate), noteType: 'C', pos: placeOfSupplyLabel(r.placeOfSupply), rc: 'N',
  supplyType: 'Regular B2B', valuePaise: r.noteValuePaise, ...amounts(r),
})), ['taxablePaise', 'cessPaise']);

const cdnur = section('cdnur', 'CDNUR', [
  col('urType', 'UR Type'), col('number', 'Note Number'), col('date', 'Note Date'), col('noteType', 'Note Type'), col('pos', 'Place Of Supply'),
  col('valuePaise', 'Note Value', 'money'), ...RATE_TAIL,
], (g) => g.cdnur.map((r) => ({
  urType: r.urType, number: r.noteNumber, date: gstDate(r.noteDate), noteType: 'C', pos: placeOfSupplyLabel(r.placeOfSupply), valuePaise: r.noteValuePaise, ...amounts(r),
})), ['taxablePaise', 'cessPaise']);

const exp = section('exp', 'EXP', [
  col('exportType', 'Export Type'), col('number', 'Invoice Number'), col('date', 'Invoice date'), col('valuePaise', 'Invoice Value', 'money'), col('port', 'Port Code'),
  col('sbNumber', 'Shipping Bill Number'), col('sbDate', 'Shipping Bill Date'), col('rate', 'Rate', 'number'), col('taxablePaise', 'Taxable Value', 'money'),
  col('cessPaise', 'Cess Amount', 'money'),
], (g) => g.exp.map((r) => ({
  exportType: r.exportType, number: r.invoiceNumber, date: gstDate(r.invoiceDate), valuePaise: r.invoiceValuePaise, port: '', sbNumber: '', sbDate: '',
  rate: rate(r.rateBp), taxablePaise: r.taxablePaise, cessPaise: r.cessPaise,
})), ['taxablePaise', 'cessPaise']);

const EXEMP_LABEL = {
  inter_registered: 'Inter-State supplies to registered persons', intra_registered: 'Intra-State supplies to registered persons',
  inter_unregistered: 'Inter-State supplies to unregistered persons', intra_unregistered: 'Intra-State supplies to unregistered persons',
} as const;
const exemp = section('exemp', 'EXEMP', [
  col('description', 'Description'), col('nilPaise', 'Nil Rated Supplies', 'money'), col('exemptPaise', 'Exempted(other than nil rated/non GST supply)', 'money'),
  col('nonGstPaise', 'Non-GST Supplies', 'money'),
], (g) => g.exemp.map((r) => ({ description: EXEMP_LABEL[r.kind], nilPaise: r.nilPaise, exemptPaise: r.exemptPaise, nonGstPaise: r.nonGstPaise })),
['nilPaise', 'exemptPaise', 'nonGstPaise']);

const HSN_COLUMNS = [
  col('hsn', 'HSN'), col('description', 'Description'), col('uqc', 'UQC'), col('qtyMilli', 'Total Quantity', 'qty'), col('totalValuePaise', 'Total Value', 'money'),
  col('rate', 'Rate', 'number'), col('taxablePaise', 'Taxable Value', 'money'), col('igstPaise', 'Integrated Tax Amount', 'money'),
  col('cgstPaise', 'Central Tax Amount', 'money'), col('sgstPaise', 'State/UT Tax Amount', 'money'), col('cessPaise', 'Cess Amount', 'money'),
];
const hsn = (recipient: 'b2b' | 'b2c') => section(`hsn_${recipient}`, `HSN summary (${recipient.toUpperCase()})`, HSN_COLUMNS, (g) => g.hsn
  .filter((r) => r.recipient === recipient)
  .map((r) => ({
    hsn: r.hsn, description: '', uqc: uqcLabel(r.uqc), qtyMilli: r.qtyMilli, totalValuePaise: r.totalValuePaise, rate: rate(r.rateBp), taxablePaise: r.taxablePaise,
    igstPaise: r.igstPaise, cgstPaise: r.cgstPaise, sgstPaise: r.sgstPaise, cessPaise: r.cessPaise,
  })), ['totalValuePaise', 'taxablePaise', 'igstPaise', 'cgstPaise', 'sgstPaise', 'cessPaise']);

const docs = section('docs', 'Documents issued', [
  col('nature', 'Nature of Document'), col('from', 'Sr. No. From'), col('to', 'Sr. No. To'), col('total', 'Total Number', 'number'), col('cancelled', 'Cancelled', 'number'),
], (g) => g.docs.map((r) => ({
  nature: r.nature === 'invoice' ? 'Invoices for outward supply' : 'Credit Note', from: r.from, to: r.to, total: r.total, cancelled: r.cancelled,
})), ['total', 'cancelled']);

const HEAD_COLUMNS = [
  col('taxablePaise', 'Taxable Value', 'money'), col('igstPaise', 'Integrated Tax', 'money'), col('cgstPaise', 'Central Tax', 'money'),
  col('sgstPaise', 'State/UT Tax', 'money'), col('cessPaise', 'Cess', 'money'),
];

const gstr3b: ReportDefinition = {
  id: 'gst.gstr3b', title: 'GSTR-3B summary', group: 'GST', permission: 'gst.view', params: [monthParam],
  columns: [col('code', 'Table'), col('description', 'Description'), ...HEAD_COLUMNS],
  run: (scope, p) => {
    const r = monthReturn(scope, p.month!).gstr3b;
    const inward = r.inward.flatMap((x) => [
      { code: '5', description: `${x.description} — inter-state`, taxablePaise: x.interPaise, igstPaise: null, cgstPaise: null, sgstPaise: null, cessPaise: null },
      { code: '5', description: `${x.description} — intra-state`, taxablePaise: x.intraPaise, igstPaise: null, cgstPaise: null, sgstPaise: null, cessPaise: null },
    ]);
    return { rows: [...r.rows.map((x) => ({ code: x.code, description: x.description, taxablePaise: x.taxablePaise, igstPaise: x.igstPaise,
      cgstPaise: x.cgstPaise, sgstPaise: x.sgstPaise, cessPaise: x.cessPaise })), ...inward] };
  },
};

const REVERSAL: ReadonlySet<InwardKind> = new Set(['debit_note', 'purchase_cancel', 'expense_cancel']);
const KIND_LABEL: Record<InwardKind, string> = {
  purchase: 'Purchase', expense: 'Expense', debit_note: 'Debit note', purchase_cancel: 'Purchase cancelled', expense_cancel: 'Expense cancelled',
};
const itcRegister: ReportDefinition = {
  id: 'gst.itcRegister', title: 'ITC register', group: 'GST', permission: 'gst.view', params: [monthParam],
  columns: [
    col('kind', 'Document'), col('docNumber', 'Number'), col('docDate', 'Date', 'date'), col('supplierName', 'Supplier'), col('supplierGstin', 'GSTIN'),
    col('supplierInvoiceNo', 'Supplier invoice'), col('supplierInvoiceDate', 'Invoice date', 'date'), ...HEAD_COLUMNS,
    col('eligibleIgstPaise', 'ITC IGST', 'money'), col('eligibleCgstPaise', 'ITC CGST', 'money'), col('eligibleSgstPaise', 'ITC SGST/UTGST', 'money'),
    col('eligibleCessPaise', 'ITC Cess', 'money'), col('ineligiblePaise', 'Ineligible tax', 'money'),
  ],
  run: (scope, p) => {
    const rows: Row[] = buildItcRegister(monthReturn(scope, p.month!).inward).map((r) => {
      const s = REVERSAL.has(r.kind) ? -1 : 1;
      return {
        kind: KIND_LABEL[r.kind], docNumber: r.docNumber, docDate: r.docDate, supplierName: r.supplierName, supplierGstin: r.supplierGstin,
        supplierInvoiceNo: r.supplierInvoiceNo, supplierInvoiceDate: r.supplierInvoiceDate, taxablePaise: s * r.taxablePaise, igstPaise: s * r.igstPaise,
        cgstPaise: s * r.cgstPaise, sgstPaise: s * r.sgstPaise, cessPaise: s * r.cessPaise, eligibleIgstPaise: s * r.eligible.igstPaise,
        eligibleCgstPaise: s * r.eligible.cgstPaise, eligibleSgstPaise: s * r.eligible.sgstPaise, eligibleCessPaise: s * r.eligible.cessPaise,
        ineligiblePaise: s * r.ineligiblePaise,
      };
    });
    const keys = ['taxablePaise', 'igstPaise', 'cgstPaise', 'sgstPaise', 'cessPaise', 'eligibleIgstPaise', 'eligibleCgstPaise', 'eligibleSgstPaise', 'eligibleCessPaise', 'ineligiblePaise'];
    return { rows, totals: rows.length > 0 ? sum(rows, keys, { kind: 'Total' }) : null };
  },
};

const missingHsn: ReportDefinition = {
  id: 'gst.productsMissingHsn', title: 'Products missing HSN', group: 'GST', permission: 'gst.view', params: [],
  columns: [col('name', 'Product'), col('sku', 'SKU'), col('soldLines', 'Bill lines sold', 'number')],
  run: ({ db, businessId }) => ({ rows: productsMissingHsn(db, businessId).map((r) => ({ name: r.name, sku: r.sku, soldLines: r.soldLines })) }),
};

export const GSTR1_SECTIONS = [b2b, b2cl, b2cs, cdnr, cdnur, exp, exemp, hsn('b2b'), hsn('b2c'), docs] as const;
export const GST_REPORTS: readonly ReportDefinition[] = [...GSTR1_SECTIONS, gstr3b, itcRegister, missingHsn];
