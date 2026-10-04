import type { RegisterReport } from '@muneem/contracts';
import { closedSessions, creditNoteRegister, salesByPaymentMethod, salesByPeriod, salesByProduct, type ProductSales } from '@muneem/db-sqlite';
import type { ReportDefinition, Row } from '../definition.js';
import { col, rangeOf, rangeParams, totalsOf } from './params.js';

const PERIOD_COLUMNS = (label: string) => [
  col('period', label, label === 'Date' ? 'date' : 'text'), col('bills', 'Bills', 'number'), col('salesPaise', 'Sales', 'money'),
  col('notes', 'Credit notes', 'number'), col('returnsPaise', 'Returns', 'money'), col('netSalesPaise', 'Net sales', 'money'),
  col('netTaxablePaise', 'Net taxable', 'money'), col('netTaxPaise', 'Net GST', 'money'),
];
const PERIOD_SUMS = ['bills', 'salesPaise', 'notes', 'returnsPaise', 'netSalesPaise', 'netTaxablePaise', 'netTaxPaise'];

const byPeriod = (id: string, title: string, grain: 'day' | 'month'): ReportDefinition => {
  const columns = PERIOD_COLUMNS(grain === 'day' ? 'Date' : 'Month');
  return {
    id, title, group: 'Sales', permission: 'reports.view', params: rangeParams, columns,
    run: (scope, p) => {
      const rows = salesByPeriod(scope.db, rangeOf(scope, p), grain) as unknown as Row[];
      return { rows, totals: totalsOf(rows, columns, PERIOD_SUMS) };
    },
  };
};

export const salesByDayReport = byPeriod('sales.byDay', 'Sales by day', 'day');
export const monthlySalesReport = byPeriod('sales.monthly', 'Monthly sales', 'month');

const netQty = (r: ProductSales) => r.soldQtyMilli - r.returnedQtyMilli;
const netTaxable = (r: ProductSales) => r.soldTaxablePaise - r.returnedTaxablePaise;
const netCost = (r: ProductSales) => r.soldCostPaise - r.returnedCostPaise;

const productColumns = [
  col('name', 'Product'), col('uomCode', 'Unit'), col('soldQtyMilli', 'Sold', 'qty'), col('returnedQtyMilli', 'Returned', 'qty'),
  col('netQtyMilli', 'Net qty', 'qty'), col('netTaxablePaise', 'Net sales (excl. GST)', 'money'), col('netTotalPaise', 'Net sales (incl. GST)', 'money'),
];
export const salesByProductReport: ReportDefinition = {
  id: 'sales.byProduct', title: 'Sales by product', group: 'Sales', permission: 'reports.view', params: rangeParams, columns: productColumns,
  run: (scope, p) => {
    const rows: Row[] = salesByProduct(scope.db, rangeOf(scope, p)).map((r) => ({
      name: r.name, uomCode: r.uomCode, soldQtyMilli: r.soldQtyMilli, returnedQtyMilli: r.returnedQtyMilli, netQtyMilli: netQty(r),
      netTaxablePaise: netTaxable(r), netTotalPaise: r.soldTotalPaise - r.returnedTotalPaise,
    }));
    return { rows, totals: totalsOf(rows, productColumns, ['netTaxablePaise', 'netTotalPaise']) };
  },
};

const categoryColumns = [
  col('category', 'Category'), col('products', 'Products', 'number'), col('netTaxablePaise', 'Net sales (excl. GST)', 'money'),
  col('netTotalPaise', 'Net sales (incl. GST)', 'money'), col('sharePercent', 'Share', 'percent'),
];
export const salesByCategoryReport: ReportDefinition = {
  id: 'sales.byCategory', title: 'Sales by category', group: 'Sales', permission: 'reports.view', params: rangeParams, columns: categoryColumns,
  run: (scope, p) => {
    const groups = new Map<string, { category: string; products: number; netTaxablePaise: number; netTotalPaise: number }>();
    for (const r of salesByProduct(scope.db, rangeOf(scope, p))) {
      const name = r.categoryName ?? 'Uncategorised';
      const g = groups.get(name) ?? { category: name, products: 0, netTaxablePaise: 0, netTotalPaise: 0 };
      g.products += 1;
      g.netTaxablePaise += netTaxable(r);
      g.netTotalPaise += r.soldTotalPaise - r.returnedTotalPaise;
      groups.set(name, g);
    }
    const all = [...groups.values()].sort((a, b) => b.netTaxablePaise - a.netTaxablePaise);
    const whole = all.reduce((s, g) => s + g.netTaxablePaise, 0);
    const rows: Row[] = all.map((g) => ({ ...g, sharePercent: whole === 0 ? 0 : Math.round((g.netTaxablePaise * 10_000) / whole) }));
    return { rows, totals: totalsOf(rows, categoryColumns, ['products', 'netTaxablePaise', 'netTotalPaise']) };
  },
};

const methodColumns = [col('method', 'Method'), col('receivedPaise', 'Received', 'money'), col('refundedPaise', 'Refunded', 'money'), col('netPaise', 'Net', 'money')];
export const salesByPaymentMethodReport: ReportDefinition = {
  id: 'sales.byPaymentMethod', title: 'Sales by payment method', group: 'Sales', permission: 'reports.view', params: rangeParams, columns: methodColumns,
  run: (scope, p) => {
    const rows = salesByPaymentMethod(scope.db, rangeOf(scope, p)) as unknown as Row[];
    return { rows, totals: totalsOf(rows, methodColumns, ['receivedPaise', 'refundedPaise', 'netPaise']) };
  },
};

const profitColumns = [
  col('name', 'Product'), col('netQtyMilli', 'Net qty', 'qty'), col('revenuePaise', 'Revenue (excl. GST)', 'money'), col('cogsPaise', 'Cost of goods', 'money'),
  col('profitPaise', 'Gross profit', 'money'), col('marginPercent', 'Margin', 'percent'),
];
export const productProfitReport: ReportDefinition = {
  id: 'sales.productProfit', title: 'Product profit', group: 'Sales', permission: 'reports.financial', params: rangeParams, columns: profitColumns,
  run: (scope, p) => {
    const rows: Row[] = salesByProduct(scope.db, rangeOf(scope, p)).map((r) => {
      const revenuePaise = netTaxable(r);
      const profitPaise = revenuePaise - netCost(r);
      return {
        name: r.name, netQtyMilli: netQty(r), revenuePaise, cogsPaise: netCost(r), profitPaise,
        marginPercent: revenuePaise === 0 ? 0 : Math.round((profitPaise * 10_000) / revenuePaise),
      };
    });
    return { rows, totals: totalsOf(rows, profitColumns, ['revenuePaise', 'cogsPaise', 'profitPaise']) };
  },
};

const noteColumns = [
  col('docDate', 'Date', 'date'), col('docNumber', 'Credit note'), col('saleNumber', 'Against sale'), col('customerName', 'Customer'), col('kind', 'Kind'),
  col('refundMethod', 'Refund'), col('taxablePaise', 'Taxable', 'money'), col('taxPaise', 'GST', 'money'), col('totalPaise', 'Total', 'money'),
];
export const creditNotesReport: ReportDefinition = {
  id: 'sales.creditNotes', title: 'Credit notes', group: 'Sales', permission: 'reports.view', params: rangeParams, columns: noteColumns,
  run: (scope, p) => {
    const rows: Row[] = creditNoteRegister(scope.db, rangeOf(scope, p)) as unknown as Row[];
    return { rows, totals: totalsOf(rows, noteColumns, ['taxablePaise', 'taxPaise', 'totalPaise']) };
  },
};

const dayEndColumns = [
  col('closedOn', 'Closed on', 'date'), col('terminalCode', 'Terminal'), col('sessionNo', 'Session', 'number'), col('salesCount', 'Bills', 'number'),
  col('salesTotalPaise', 'Sales', 'money'), col('returnsTotalPaise', 'Returns', 'money'), col('expectedCashPaise', 'Expected cash', 'money'),
  col('countedCashPaise', 'Counted cash', 'money'), col('variancePaise', 'Variance', 'money'),
];
export const dayEndReport: ReportDefinition = {
  id: 'sales.dayEnd', title: 'Day-end (Z) reports', group: 'Sales', permission: 'reports.view', params: rangeParams, columns: dayEndColumns,
  run: (scope, p) => {
    const rows: Row[] = closedSessions(scope.db, rangeOf(scope, p)).map((s) => {
      const z = JSON.parse(s.zReportJson) as RegisterReport;
      return {
        closedOn: s.closedOn, terminalCode: s.terminalCode, sessionNo: s.sessionNo, salesCount: z.salesCount, salesTotalPaise: z.salesTotalPaise,
        returnsTotalPaise: z.returnsTotalPaise ?? 0, expectedCashPaise: z.expectedCashPaise, countedCashPaise: z.countedCashPaise ?? null, variancePaise: z.variancePaise ?? null,
      };
    });
    return { rows, totals: totalsOf(rows, dayEndColumns, ['salesCount', 'salesTotalPaise', 'returnsTotalPaise', 'variancePaise']) };
  },
};

export const SALES_REPORTS = [
  salesByDayReport, monthlySalesReport, salesByProductReport, salesByCategoryReport, salesByPaymentMethodReport, productProfitReport, creditNotesReport, dayEndReport,
];
