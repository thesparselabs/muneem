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
}

const FIGURES = `COALESCE(SUM(sale_count), 0) AS saleCount, COALESCE(SUM(sale_total_paise), 0) AS salesPaise, COALESCE(SUM(return_count), 0) AS returnCount,
  COALESCE(SUM(return_total_paise), 0) AS returnsPaise, COALESCE(SUM(sale_total_paise - return_total_paise), 0) AS netSalesPaise,
  COALESCE(SUM(sale_taxable_paise - return_taxable_paise), 0) AS netTaxablePaise,
  COALESCE(SUM(sale_taxable_paise - return_taxable_paise - sale_cogs_paise + return_cost_paise), 0) AS grossProfitPaise`;

// Net of refunds by method: what each way of paying brought in for sales, the on-account part as 'credit'.
const TENDERS = `SELECT method, SUM(CASE flow WHEN 'sale' THEN amount_paise ELSE -amount_paise END) AS amountPaise FROM daily_payment_summary
  WHERE business_id = @businessId AND day BETWEEN @from AND @to AND flow IN ('sale', 'refund') GROUP BY method HAVING amountPaise <> 0 ORDER BY amountPaise DESC`;

// FR-072: everything here reads the daily tables plus two small indexed sums, so it stays fast at any history (LLD §18).
export function dashboardFigures(db: Db, q: { businessId: string; today: string; days: number; topN: number }): DashboardFigures {
  const from = addDays(q.today, -(q.days - 1));
  const day = { businessId: q.businessId, from: q.today, to: q.today };
  const window = { businessId: q.businessId, from, to: q.today };
  const trendRows = stmt(db, `SELECT day, SUM(sale_total_paise - return_total_paise) AS netSalesPaise,
      SUM(sale_taxable_paise - return_taxable_paise - sale_cogs_paise + return_cost_paise) AS grossProfitPaise
    FROM daily_sales_summary WHERE business_id = @businessId AND day BETWEEN @from AND @to GROUP BY day`).all(window) as DayTrend[];
  const byDay = new Map(trendRows.map((r) => [r.day, r]));
  const parties = stmt(db, `SELECT party_type AS t, COALESCE(SUM(amount_paise), 0) AS n FROM party_ledger_entry WHERE business_id = ? GROUP BY party_type`)
    .all(q.businessId) as { t: string; n: number }[];
  const party = (t: string) => parties.find((p) => p.t === t)?.n ?? 0;
  return {
    today: stmt(db, `SELECT ${FIGURES} FROM daily_sales_summary WHERE business_id = @businessId AND day BETWEEN @from AND @to`).get(day) as DayFigures,
    todayTenders: stmt(db, TENDERS).all(day) as MethodAmount[],
    purchasesPaise: stmt(db, `SELECT COALESCE(SUM(total_paise), 0) FROM purchase WHERE business_id = ? AND doc_date = ? AND status = 'posted'`).pluck().get(q.businessId, q.today) as number,
    expensesPaise: stmt(db, `SELECT COALESCE(SUM(amount_paise), 0) FROM daily_payment_summary WHERE business_id = @businessId AND day BETWEEN @from AND @to AND flow = 'expense'`)
      .pluck().get(day) as number,
    receivablePaise: party('customer'),
    payablePaise: -party('supplier'),
    trend: Array.from({ length: q.days }, (_, i) => {
      const d = addDays(from, i);
      return byDay.get(d) ?? { day: d, netSalesPaise: 0, grossProfitPaise: 0 };
    }),
    paymentSplit: stmt(db, TENDERS).all(window) as MethodAmount[],
    topProducts: stmt(db, `SELECT d.product_id AS productId, p.name, u.code AS uomCode, SUM(d.sold_qty_milli - d.returned_qty_milli) AS qtyMilli,
        SUM(d.sold_taxable_paise - d.returned_taxable_paise) AS netSalesPaise
      FROM product_sales_daily d JOIN product p ON p.id = d.product_id JOIN uom u ON u.id = p.base_uom_id
      WHERE d.business_id = @businessId AND d.day BETWEEN @from AND @to GROUP BY d.product_id ORDER BY netSalesPaise DESC LIMIT @n`).all({ ...window, n: q.topN }) as TopProduct[],
  };
}
