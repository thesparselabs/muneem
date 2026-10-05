import type { GstBooks, GstHeads, InwardKind, InwardLine, NoteLine, OutwardLine, SeriesIssued } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

// ADR-0044 as built: a document belongs to the month its journal posted to, so a late arrival into a locked month is
// reported in the next open one, and every month's return ties to that month's tax-account movements exactly.
export interface GstRange { businessId: string; from: string; to: string }

const TAX = 'taxable_paise AS taxablePaise, igst_paise AS igstPaise, cgst_paise AS cgstPaise, sgst_paise AS sgstPaise, cess_paise AS cessPaise';
const taxOf = (alias: string): string => TAX.replace(/(\w+_paise) AS/gu, `${alias}.$1 AS`);

// Documents whose original journal posted in the range, plus any that never needed a journal (all zero), by their own date.
const inMonth = (table: string, source: string, dateCol: string): string => `(
  ${table}.id IN (SELECT j.ref_id FROM journal_entry j WHERE j.business_id = @businessId AND j.source = '${source}' AND j.entry_date BETWEEN @from AND @to
    AND j.is_reversal_of IS NULL)
  OR (${table}.${dateCol} BETWEEN @from AND @to AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.business_id = @businessId AND j.source = '${source}'
    AND j.ref_id = ${table}.id))
)`;

type Raw<T> = Omit<T, 'customerGstin' | 'customerName'> & { snapshot: string };
const withCustomer = <T extends OutwardLine>(r: Raw<T>): T => {
  const c = JSON.parse(r.snapshot) as { name?: string; gstin?: string };
  return { ...r, snapshot: undefined, customerGstin: c.gstin ?? null, customerName: c.name ?? null } as unknown as T;
};

export function outwardLines(db: Db, r: GstRange): OutwardLine[] {
  return (stmt(db, `SELECT s.id AS docId, s.doc_number AS docNumber, s.doc_date AS docDate, s.total_paise AS docValuePaise, s.gstr1_bucket AS docBucket,
      s.customer_snapshot_json AS snapshot, s.place_of_supply_state AS placeOfSupply, s.supply_type AS supplyType, i.hsn_code AS hsnCode, i.uom_code AS uomCode,
      i.qty_milli AS qtyMilli, i.tax_treatment AS taxTreatment, i.gst_rate_bp AS gstRateBp, ${taxOf('i')}
    FROM sale s JOIN sale_item i ON i.sale_id = s.id
    WHERE s.business_id = @businessId AND s.status = 'posted' AND ${inMonth('s', 'sale', 'doc_date')}
    ORDER BY s.doc_date, s.doc_number, i.line_no`).all(r) as Raw<OutwardLine>[]).map(withCustomer);
}

export function noteLines(db: Db, r: GstRange): NoteLine[] {
  return (stmt(db, `SELECT n.id AS docId, n.doc_number AS docNumber, n.doc_date AS docDate, n.total_paise AS docValuePaise, n.gstr1_bucket AS docBucket,
      s.customer_snapshot_json AS snapshot, n.place_of_supply_state AS placeOfSupply, n.supply_type AS supplyType, i.hsn_code AS hsnCode, i.uom_code AS uomCode,
      c.qty_milli AS qtyMilli, i.tax_treatment AS taxTreatment, i.gst_rate_bp AS gstRateBp, ${taxOf('c')},
      s.gstr1_bucket AS saleBucket, s.doc_number AS saleNumber, s.doc_date AS saleDate
    FROM credit_note n JOIN credit_note_item c ON c.credit_note_id = n.id JOIN sale_item i ON i.id = c.sale_item_id JOIN sale s ON s.id = n.sale_id
    WHERE n.business_id = @businessId AND n.status = 'posted' AND ${inMonth('n', 'sale_return', 'doc_date')}
    ORDER BY n.doc_date, n.doc_number, c.line_no`).all(r) as Raw<NoteLine>[]).map(withCustomer);
}

// Numbers issued in the month by date, per series: invoices and credit notes of the regular scheme.
export function seriesIssued(db: Db, r: GstRange): SeriesIssued[] {
  const per = (nature: SeriesIssued['nature'], table: string, scheme: string) => stmt(db, `SELECT '${nature}' AS nature, MIN(doc_number) AS firstNumber,
      MAX(doc_number) AS lastNumber, MIN(doc_seq) AS firstSeq, MAX(doc_seq) AS lastSeq, COUNT(*) AS issued, SUM(status = 'cancelled') AS cancelled
    FROM ${table} WHERE business_id = @businessId AND doc_date BETWEEN @from AND @to AND ${scheme} GROUP BY series_id`).all(r) as SeriesIssued[];
  return [...per('invoice', 'sale', "tax_scheme = 'regular'"), ...per('credit_note', 'credit_note', "gstr1_bucket <> 'na'")];
}

const SUPPLIER = `json_extract(p.supplier_snapshot_json, '$.name') AS supplierName, json_extract(p.supplier_snapshot_json, '$.gstin') AS supplierGstin,
  p.supplier_invoice_no AS supplierInvoiceNo, p.supplier_invoice_date AS supplierInvoiceDate, p.supplier_tax_scheme AS supplierScheme`;

const reversedIn = (source: string): string => `IN (SELECT j.ref_id FROM journal_entry j WHERE j.business_id = @businessId AND j.source = '${source}'
  AND j.entry_date BETWEEN @from AND @to AND j.is_reversal_of IS NOT NULL)`;

type InwardRaw = Omit<InwardLine, 'itcEligible'> & { itcEligible: number };
const inwardOf = (rows: InwardRaw[]): InwardLine[] => rows.map((x) => ({ ...x, itcEligible: x.itcEligible === 1 }));

function purchaseLines(db: Db, r: GstRange, kind: InwardKind, where: string): InwardLine[] {
  return inwardOf(stmt(db, `SELECT '${kind}' AS kind, p.id AS docId, p.doc_number AS docNumber, p.supplier_invoice_date AS docDate, ${SUPPLIER},
      p.supply_type AS supplyType, i.tax_treatment AS taxTreatment, i.itc_eligible AS itcEligible, ${taxOf('i')}
    FROM purchase p JOIN purchase_item i ON i.purchase_id = p.id WHERE p.business_id = @businessId AND ${where} ORDER BY p.supplier_invoice_date, p.id, i.line_no`)
    .all(r) as InwardRaw[]);
}

function debitNoteLines(db: Db, r: GstRange): InwardLine[] {
  return inwardOf(stmt(db, `SELECT 'debit_note' AS kind, n.id AS docId, n.doc_number AS docNumber, n.doc_date AS docDate, ${SUPPLIER},
      n.supply_type AS supplyType, i.tax_treatment AS taxTreatment, i.itc_eligible AS itcEligible, ${taxOf('d')}
    FROM debit_note n JOIN debit_note_item d ON d.debit_note_id = n.id JOIN purchase_item i ON i.id = d.purchase_item_id JOIN purchase p ON p.id = n.purchase_id
    WHERE n.business_id = @businessId AND n.status = 'posted' AND ${inMonth('n', 'purchase_return', 'doc_date')} ORDER BY n.doc_date, n.id, d.line_no`)
    .all(r) as InwardRaw[]);
}

function expenseLines(db: Db, r: GstRange, kind: InwardKind, where: string): InwardLine[] {
  return inwardOf(stmt(db, `SELECT '${kind}' AS kind, e.id AS docId, e.doc_number AS docNumber, e.expense_date AS docDate,
      COALESCE(s.name, e.vendor_name) AS supplierName, COALESCE(s.gstin, e.vendor_gstin) AS supplierGstin, e.reference AS supplierInvoiceNo,
      e.expense_date AS supplierInvoiceDate, CASE WHEN COALESCE(s.gstin, e.vendor_gstin) IS NULL THEN 'unregistered' ELSE 'regular' END AS supplierScheme,
      e.supply_type AS supplyType, 'taxable' AS taxTreatment, e.itc_paise > 0 AS itcEligible, ${taxOf('e')}
    FROM expense e LEFT JOIN supplier s ON s.id = e.supplier_id WHERE e.business_id = @businessId AND ${where} ORDER BY e.expense_date, e.id`)
    .all(r) as InwardRaw[]);
}

// Purchases on their bill's journal month, debit notes, expenses, and the cancels whose reversal posted in the month.
export function inwardLines(db: Db, r: GstRange): InwardLine[] {
  return [
    ...purchaseLines(db, r, 'purchase', inMonth('p', 'purchase', 'supplier_invoice_date')),
    ...purchaseLines(db, r, 'purchase_cancel', `p.id ${reversedIn('purchase')}`),
    ...debitNoteLines(db, r),
    ...expenseLines(db, r, 'expense', inMonth('e', 'expense', 'expense_date')),
    ...expenseLines(db, r, 'expense_cancel', `e.id ${reversedIn('expense')}`),
  ];
}

const TAX_ROLES = ['output_igst', 'output_cgst', 'output_sgst', 'output_cess', 'input_igst', 'input_cgst', 'input_sgst', 'input_cess'] as const;
const ROLE_LIST = TAX_ROLES.map((x) => `'${x}'`).join(', ');
// `0 +` turns a negated zero into a plain zero.
const headsBy = (net: (role: string) => number, side: 'output' | 'input', sign: number): GstHeads => ({
  igstPaise: 0 + sign * net(`${side}_igst`), cgstPaise: 0 + sign * net(`${side}_cgst`), sgstPaise: 0 + sign * net(`${side}_sgst`),
  cessPaise: 0 + sign * net(`${side}_cess`),
});

function roleNets(rows: { role: string; net: number }[]): (role: string) => number {
  const by = new Map(rows.map((x) => [x.role, x.net]));
  return (role) => by.get(role) ?? 0;
}

// The month's movements on the tax accounts, set-off journals left out: what the return must equal.
export function gstBooksForMonth(db: Db, r: GstRange): GstBooks {
  const net = roleNets(stmt(db, `SELECT a.role, SUM(l.debit_paise - l.credit_paise) AS net
    FROM journal_entry j JOIN journal_line l ON l.entry_id = j.id JOIN account a ON a.id = l.account_id
    WHERE j.business_id = @businessId AND j.entry_date BETWEEN @from AND @to AND a.role IN (${ROLE_LIST}) AND COALESCE(j.ref_type, '') <> 'gst_setoff'
    GROUP BY a.role`).all(r) as { role: string; net: number }[]);
  return { output: headsBy(net, 'output', -1), input: headsBy(net, 'input', 1) };
}

// Balances of the tax accounts at the end of a day, set-offs included: what a set-off for that month works from.
export function gstBalancesAt(db: Db, businessId: string, through: string): GstBooks {
  const net = roleNets(stmt(db, `SELECT a.role, SUM(l.debit_paise - l.credit_paise) AS net
    FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id JOIN account a ON a.id = l.account_id
    WHERE l.business_id = ? AND a.role IN (${ROLE_LIST}) AND j.entry_date <= ? GROUP BY a.role`).all(businessId, through) as { role: string; net: number }[]);
  return { output: headsBy(net, 'output', -1), input: headsBy(net, 'input', 1) };
}

// 2300 GST Payable as a liability: credit − debit.
export const gstPayableBalance = (db: Db, businessId: string): number =>
  stmt(db, `SELECT COALESCE(SUM(l.credit_paise - l.debit_paise), 0) FROM journal_line l JOIN account a ON a.id = l.account_id
    WHERE l.business_id = ? AND a.role = 'gst_payable'`).pluck().get(businessId) as number;

// Products a regular business sells without an HSN code (FR-094's HSN summary needs one on every line).
export interface ProductMissingHsn { id: string; name: string; sku: string | null; soldLines: number }
export const productsMissingHsn = (db: Db, businessId: string): ProductMissingHsn[] =>
  stmt(db, `SELECT p.id, p.name, p.sku, (SELECT COUNT(*) FROM sale_item i WHERE i.business_id = p.business_id AND i.product_id = p.id) AS soldLines
    FROM product p WHERE p.business_id = ? AND p.deleted_at IS NULL AND (p.hsn_code IS NULL OR p.hsn_code = '') ORDER BY p.name`).all(businessId) as ProductMissingHsn[];
