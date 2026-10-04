import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { inRange, rangeParams, type ReportRange } from './range.js';

// ADR-0046 as built: a credit note reduces sales on its own date, never back-dated to the sale it returns, as GSTR-1 and the P&L see it.
const TAX = 'cgst_paise + sgst_paise + igst_paise + cess_paise';

export interface PeriodSales {
  period: string; bills: number; salesPaise: number; notes: number; returnsPaise: number;
  netSalesPaise: number; netTaxablePaise: number; netTaxPaise: number;
}

export function salesByPeriod(db: Db, r: ReportRange, grain: 'day' | 'month'): PeriodSales[] {
  const key = grain === 'day' ? 'doc_date' : 'substr(doc_date, 1, 7)';
  return stmt(db, `WITH s AS (
      SELECT ${key} AS period, COUNT(*) AS bills, SUM(total_paise) AS total, SUM(taxable_paise) AS taxable, SUM(${TAX}) AS tax
      FROM sale x WHERE ${inRange('x')} AND x.status = 'posted' GROUP BY 1),
    n AS (
      SELECT ${key} AS period, COUNT(*) AS notes, SUM(total_paise) AS total, SUM(taxable_paise) AS taxable, SUM(${TAX}) AS tax
      FROM credit_note x WHERE ${inRange('x')} AND x.status = 'posted' GROUP BY 1)
    SELECT p.period, COALESCE(s.bills, 0) AS bills, COALESCE(s.total, 0) AS salesPaise, COALESCE(n.notes, 0) AS notes, COALESCE(n.total, 0) AS returnsPaise,
      COALESCE(s.total, 0) - COALESCE(n.total, 0) AS netSalesPaise, COALESCE(s.taxable, 0) - COALESCE(n.taxable, 0) AS netTaxablePaise,
      COALESCE(s.tax, 0) - COALESCE(n.tax, 0) AS netTaxPaise
    FROM (SELECT period FROM s UNION SELECT period FROM n) p LEFT JOIN s ON s.period = p.period LEFT JOIN n ON n.period = p.period
    ORDER BY p.period`).all(rangeParams(r)) as PeriodSales[];
}

export interface ProductSales {
  productId: string; name: string; uomCode: string; categoryId: string | null; categoryName: string | null;
  soldQtyMilli: number; returnedQtyMilli: number; soldTaxablePaise: number; returnedTaxablePaise: number;
  soldTotalPaise: number; returnedTotalPaise: number; soldCostPaise: number; returnedCostPaise: number;
}

// Quantities are in the product's base unit; cost is what the sale issued and the note took back (ADR-0019, ADR-0043).
export function salesByProduct(db: Db, r: ReportRange): ProductSales[] {
  return stmt(db, `WITH s AS (
      SELECT i.product_id, SUM(i.base_qty_milli) AS qty, SUM(i.taxable_paise) AS taxable, SUM(i.total_paise) AS total, SUM(i.cogs_paise) AS cost
      FROM sale x JOIN sale_item i ON i.sale_id = x.id WHERE ${inRange('x')} AND x.status = 'posted' GROUP BY i.product_id),
    n AS (
      SELECT i.product_id, SUM(i.base_qty_milli) AS qty, SUM(i.taxable_paise) AS taxable, SUM(i.total_paise) AS total, SUM(i.cost_paise) AS cost
      FROM credit_note x JOIN credit_note_item i ON i.credit_note_id = x.id WHERE ${inRange('x')} AND x.status = 'posted' GROUP BY i.product_id)
    SELECT p.id AS productId, p.name, u.code AS uomCode, p.category_id AS categoryId, c.name AS categoryName,
      COALESCE(s.qty, 0) AS soldQtyMilli, COALESCE(n.qty, 0) AS returnedQtyMilli, COALESCE(s.taxable, 0) AS soldTaxablePaise,
      COALESCE(n.taxable, 0) AS returnedTaxablePaise, COALESCE(s.total, 0) AS soldTotalPaise, COALESCE(n.total, 0) AS returnedTotalPaise,
      COALESCE(s.cost, 0) AS soldCostPaise, COALESCE(n.cost, 0) AS returnedCostPaise
    FROM (SELECT product_id FROM s UNION SELECT product_id FROM n) k JOIN product p ON p.id = k.product_id JOIN uom u ON u.id = p.base_uom_id
      LEFT JOIN category c ON c.id = p.category_id LEFT JOIN s ON s.product_id = k.product_id LEFT JOIN n ON n.product_id = k.product_id
    ORDER BY p.name_norm, p.id`).all(rangeParams(r)) as ProductSales[];
}

export interface MethodSales { method: string; receivedPaise: number; refundedPaise: number; netPaise: number }

// What each tender brought in net of change, less what credit notes paid back by that method; the on-account part is 'credit'.
export function salesByPaymentMethod(db: Db, r: ReportRange): MethodSales[] {
  return stmt(db, `SELECT method, SUM(received) AS receivedPaise, SUM(refunded) AS refundedPaise, SUM(received) - SUM(refunded) AS netPaise FROM (
      SELECT t.method, t.amount_paise - t.change_paise AS received, 0 AS refunded FROM sale x JOIN sale_tender t ON t.sale_id = x.id
        WHERE ${inRange('x')} AND x.status = 'posted'
      UNION ALL SELECT x.refund_method, 0, x.refund_paise FROM credit_note x WHERE ${inRange('x')} AND x.status = 'posted' AND x.refund_paise > 0
      UNION ALL SELECT 'credit', 0, x.credit_paise FROM credit_note x WHERE ${inRange('x')} AND x.status = 'posted' AND x.credit_paise > 0)
    GROUP BY method ORDER BY method`).all(rangeParams(r)) as MethodSales[];
}

export interface CreditNoteRow {
  id: string; docDate: string; docNumber: string; saleNumber: string; customerName: string | null; kind: string; refundMethod: string;
  taxablePaise: number; taxPaise: number; totalPaise: number;
}

export function creditNoteRegister(db: Db, r: ReportRange): CreditNoteRow[] {
  return stmt(db, `SELECT x.id, x.doc_date AS docDate, x.doc_number AS docNumber, s.doc_number AS saleNumber,
      json_extract(s.customer_snapshot_json, '$.name') AS customerName, x.kind, x.refund_method AS refundMethod,
      x.taxable_paise AS taxablePaise, x.cgst_paise + x.sgst_paise + x.igst_paise + x.cess_paise AS taxPaise, x.total_paise AS totalPaise
    FROM credit_note x JOIN sale s ON s.id = x.sale_id WHERE ${inRange('x')} AND x.status = 'posted'
    ORDER BY x.doc_date, x.doc_number`).all(rangeParams(r)) as CreditNoteRow[];
}

export interface DayEndRow {
  sessionId: string; closedOn: string; terminalCode: string; sessionNo: number; zReportJson: string;
}

// Closed register sessions by the device's local closing date (FR-099 Z reports).
export function closedSessions(db: Db, r: ReportRange): DayEndRow[] {
  return stmt(db, `SELECT s.id AS sessionId, date(s.closed_at, 'localtime') AS closedOn, t.code AS terminalCode, s.session_no AS sessionNo, s.z_report_json AS zReportJson
    FROM pos_session s JOIN terminal t ON t.id = s.terminal_id
    WHERE s.business_id = @businessId AND s.status = 'closed' AND s.z_report_json IS NOT NULL AND date(s.closed_at, 'localtime') BETWEEN @from AND @to
      AND (@branchId IS NULL OR s.branch_id = @branchId)
    ORDER BY s.closed_at, t.code`).all(rangeParams(r)) as DayEndRow[];
}
