import { addDays } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

export const DAILY_SUMMARY_TABLES = ['daily_sales_summary', 'daily_payment_summary', 'product_sales_daily'] as const;
export type DailySummaryTable = (typeof DAILY_SUMMARY_TABLES)[number];

// Rows the triggers wrote that their view (the definition) disagrees with, in either direction (migration 0018); `since` limits it to recent days.
export function dailySummaryDrift(db: Db, businessId: string, since = ''): { table: DailySummaryTable; rows: number }[] {
  const where = 'business_id = @b AND day >= @since';
  return DAILY_SUMMARY_TABLES.map((table) => ({
    table,
    rows: stmt(db, `SELECT (SELECT COUNT(*) FROM (SELECT * FROM ${table} WHERE ${where} EXCEPT SELECT * FROM v_${table} WHERE ${where}))
      + (SELECT COUNT(*) FROM (SELECT * FROM v_${table} WHERE ${where} EXCEPT SELECT * FROM ${table} WHERE ${where}))`).pluck().get({ b: businessId, since }) as number,
  })).filter((d) => d.rows > 0);
}

// The caller holds the transaction, so readers never see a half-rebuilt table.
export function rebuildDailySummaries(db: Db, businessId: string): void {
  for (const table of DAILY_SUMMARY_TABLES) {
    stmt(db, `DELETE FROM ${table} WHERE business_id = ?`).run(businessId);
    stmt(db, `INSERT INTO ${table} SELECT * FROM v_${table} WHERE business_id = ?`).run(businessId);
  }
}

export interface DayFigures {
  saleCount: number; salesPaise: number; returnCount: number; returnsPaise: number; netSalesPaise: number; netTaxablePaise: number; grossProfitPaise: number;
}
export interface DayTrend { day: string; netSalesPaise: number; grossProfitPaise: number }
export interface MethodAmount { method: string; amountPaise: number }
export interface TopProduct { productId: string; name: string; uomCode: string; qtyMilli: number; netSalesPaise: number }

export interface NamedAmount { id: string | null; name: string; amountPaise: number }
export interface PeriodTotals { saleCount: number; netSalesPaise: number; grossProfitPaise: number; purchasesPaise: number; expensesPaise: number }

export interface DashboardFigures {
  today: DayFigures;
  todayTenders: MethodAmount[];
  purchasesPaise: number;
  expensesPaise: number;
  receivablePaise: number;
  payablePaise: number;
  trend: DayTrend[];
  paymentSplit: MethodAmount[];
  topProducts: TopProduct[];
  from: string;
  to: string;
  windowDays: number;
  previous: PeriodTotals;
  newCustomers: number;
  productsSold: number;
  topCategories: NamedAmount[];
  expenseBreakdown: NamedAmount[];
}

const FIGURES = `COALESCE(SUM(sale_count), 0) AS saleCount, COALESCE(SUM(sale_total_paise), 0) AS salesPaise, COALESCE(SUM(return_count), 0) AS returnCount,
  COALESCE(SUM(return_total_paise), 0) AS returnsPaise, COALESCE(SUM(sale_total_paise - return_total_paise), 0) AS netSalesPaise,
  COALESCE(SUM(sale_taxable_paise - return_taxable_paise), 0) AS netTaxablePaise,
  COALESCE(SUM(sale_taxable_paise - return_taxable_paise - sale_cogs_paise + return_cost_paise), 0) AS grossProfitPaise`;

// Net of refunds by method: what each way of paying brought in for sales, the on-account part as 'credit'.
const TENDERS = `SELECT method, SUM(CASE flow WHEN 'sale' THEN amount_paise ELSE -amount_paise END) AS amountPaise FROM daily_payment_summary
  WHERE business_id = @businessId AND day BETWEEN @from AND @to AND flow IN ('sale', 'refund') GROUP BY method HAVING amountPaise <> 0 ORDER BY amountPaise DESC`;

interface Range { businessId: string; from: string; to: string }

function figuresFor(db: Db, r: Range): DayFigures {
  return stmt(db, `SELECT ${FIGURES} FROM daily_sales_summary WHERE business_id = @businessId AND day BETWEEN @from AND @to`).get(r) as DayFigures;
}

function purchasesFor(db: Db, r: Range): number {
  return stmt(db, `SELECT COALESCE(SUM(total_paise), 0) FROM purchase WHERE business_id = @businessId AND doc_date BETWEEN @from AND @to AND status = 'posted'`).pluck().get(r) as number;
}

function expensesFor(db: Db, r: Range): number {
  return stmt(db, `SELECT COALESCE(SUM(amount_paise), 0) FROM daily_payment_summary WHERE business_id = @businessId AND day BETWEEN @from AND @to AND flow = 'expense'`)
    .pluck().get(r) as number;
}

function totalsFor(db: Db, r: Range): PeriodTotals {
  const f = figuresFor(db, r);
  return { saleCount: f.saleCount, netSalesPaise: f.netSalesPaise, grossProfitPaise: f.grossProfitPaise, purchasesPaise: purchasesFor(db, r), expensesPaise: expensesFor(db, r) };
}

// Categories are joined to the per-category sums, not to every product-day; uncategorised products group under a null id.
function topCategories(db: Db, r: Range, n: number): NamedAmount[] {
  return stmt(db, `SELECT t.categoryId AS id, COALESCE(c.name, 'Uncategorised') AS name, t.amountPaise FROM (
      SELECT p.category_id AS categoryId, SUM(s.sold_taxable_paise - s.returned_taxable_paise) AS amountPaise
      FROM product_sales_daily s JOIN product p ON p.id = s.product_id
      WHERE s.business_id = @businessId AND s.day BETWEEN @from AND @to GROUP BY p.category_id HAVING amountPaise > 0 ORDER BY amountPaise DESC LIMIT @n) t
    LEFT JOIN category c ON c.id = t.categoryId ORDER BY t.amountPaise DESC`).all({ ...r, n }) as NamedAmount[];
}

function expenseBreakdown(db: Db, r: Range, n: number): NamedAmount[] {
  return stmt(db, `SELECT t.categoryId AS id, c.name AS name, t.amountPaise FROM (
      SELECT category_id AS categoryId, SUM(total_paise) AS amountPaise FROM expense
      WHERE business_id = @businessId AND expense_date BETWEEN @from AND @to AND status = 'posted' GROUP BY category_id ORDER BY amountPaise DESC LIMIT @n) t
    JOIN expense_category c ON c.id = t.categoryId ORDER BY t.amountPaise DESC`).all({ ...r, n }) as NamedAmount[];
}

// FR-072: everything here reads the daily tables plus small indexed sums, so it stays fast at any history (LLD §18).
// `windowDays` is the selected period (1, 7 or 30 days ending today); `days` is how many days the trend chart shows.
export function dashboardFigures(db: Db, q: { businessId: string; today: string; days: number; topN: number; windowDays?: number }): DashboardFigures {
  const windowDays = q.windowDays ?? 1;
  const from = addDays(q.today, -(q.days - 1));
  const win: Range = { businessId: q.businessId, from: addDays(q.today, -(windowDays - 1)), to: q.today };
  const prev: Range = { businessId: q.businessId, from: addDays(win.from, -windowDays), to: addDays(win.from, -1) };
  const trendRows = stmt(db, `SELECT day, SUM(sale_total_paise - return_total_paise) AS netSalesPaise,
      SUM(sale_taxable_paise - return_taxable_paise - sale_cogs_paise + return_cost_paise) AS grossProfitPaise
    FROM daily_sales_summary WHERE business_id = @businessId AND day BETWEEN @from AND @to GROUP BY day`).all({ businessId: q.businessId, from, to: q.today }) as DayTrend[];
  const byDay = new Map(trendRows.map((r) => [r.day, r]));
  const parties = stmt(db, `SELECT party_type AS t, COALESCE(SUM(amount_paise), 0) AS n FROM party_ledger_entry WHERE business_id = ? GROUP BY party_type`)
    .all(q.businessId) as { t: string; n: number }[];
  const party = (t: string) => parties.find((p) => p.t === t)?.n ?? 0;
  return {
    today: figuresFor(db, win),
    todayTenders: stmt(db, TENDERS).all(win) as MethodAmount[],
    purchasesPaise: purchasesFor(db, win),
    expensesPaise: expensesFor(db, win),
    receivablePaise: party('customer'),
    payablePaise: -party('supplier'),
    trend: Array.from({ length: q.days }, (_, i) => {
      const d = addDays(from, i);
      return byDay.get(d) ?? { day: d, netSalesPaise: 0, grossProfitPaise: 0 };
    }),
    paymentSplit: stmt(db, TENDERS).all(win) as MethodAmount[],
    // Names are joined to the top rows only, not to every product-day in the window (9f: 130 → 48 ms at 500k sales).
    topProducts: stmt(db, `SELECT t.productId, p.name, u.code AS uomCode, t.qtyMilli, t.netSalesPaise FROM (
        SELECT product_id AS productId, SUM(sold_qty_milli - returned_qty_milli) AS qtyMilli, SUM(sold_taxable_paise - returned_taxable_paise) AS netSalesPaise
        FROM product_sales_daily WHERE business_id = @businessId AND day BETWEEN @from AND @to GROUP BY product_id ORDER BY netSalesPaise DESC LIMIT @n) t
      JOIN product p ON p.id = t.productId JOIN uom u ON u.id = p.base_uom_id ORDER BY t.netSalesPaise DESC`).all({ ...win, n: q.topN }) as TopProduct[],
    from: win.from, to: win.to, windowDays,
    previous: totalsFor(db, prev),
    newCustomers: stmt(db, `SELECT COUNT(*) FROM customer WHERE business_id = @businessId AND deleted_at IS NULL AND created_at >= @from AND created_at <= @to || 'T99'`).pluck().get(win) as number,
    productsSold: stmt(db, `SELECT COUNT(*) FROM (SELECT product_id FROM product_sales_daily WHERE business_id = @businessId AND day BETWEEN @from AND @to
      GROUP BY product_id HAVING SUM(sold_qty_milli - returned_qty_milli) > 0)`).pluck().get(win) as number,
    topCategories: topCategories(db, win, q.topN),
    expenseBreakdown: expenseBreakdown(db, win, q.topN),
  };
}
