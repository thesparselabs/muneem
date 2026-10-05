import { cashByDay, expenseRegister, paymentRegister, purchaseRegister, stockMovementSummary, stockValuation } from '@muneem/db-sqlite';
import type { ReportDefinition, Row } from '../definition.js';
import { col, rangeOf, rangeParams, totalsOf } from './params.js';

const KIND = { purchase: 'Purchase', debit_note: 'Debit note' } as const;
const purchaseColumns = [
  col('docDate', 'Date', 'date'), col('kind', 'Document'), col('docNumber', 'Number'), col('supplierName', 'Supplier'), col('invoiceNo', 'Supplier invoice'),
  col('taxablePaise', 'Taxable', 'money'), col('taxPaise', 'GST', 'money'), col('totalPaise', 'Total', 'money'),
];
export const purchasesReport: ReportDefinition = {
  id: 'purchases.register', title: 'Purchases', group: 'Purchases and expenses', permission: 'reports.view', params: rangeParams, columns: purchaseColumns,
  run: (scope, p) => {
    const rows: Row[] = purchaseRegister(scope.db, rangeOf(scope, p)).map((r) => ({ ...r, kind: KIND[r.kind] }));
    return { rows, totals: totalsOf(rows, purchaseColumns, ['taxablePaise', 'taxPaise', 'totalPaise']) };
  },
};

const expenseColumns = [
  col('date', 'Date', 'date'), col('docNumber', 'Number'), col('category', 'Category'), col('vendor', 'Paid to'), col('method', 'Method'),
  col('taxablePaise', 'Amount', 'money'), col('taxPaise', 'GST', 'money'), col('totalPaise', 'Total', 'money'),
];
export const expensesReport: ReportDefinition = {
  id: 'expenses.register', title: 'Expenses', group: 'Purchases and expenses', permission: 'reports.view', params: rangeParams, columns: expenseColumns,
  run: (scope, p) => {
    const rows: Row[] = expenseRegister(scope.db, rangeOf(scope, p)) as unknown as Row[];
    return { rows, totals: totalsOf(rows, expenseColumns, ['taxablePaise', 'taxPaise', 'totalPaise']) };
  },
};

const paymentColumns = [
  col('date', 'Date', 'date'), col('docNumber', 'Number'), col('direction', 'Direction'), col('partyName', 'Party'), col('method', 'Method'),
  col('reference', 'Reference'), col('inPaise', 'Received', 'money'), col('outPaise', 'Paid', 'money'),
];
export const paymentsReport: ReportDefinition = {
  id: 'money.payments', title: 'Payments', group: 'Cash and payments', permission: 'reports.view', params: rangeParams, columns: paymentColumns,
  run: (scope, p) => {
    const rows: Row[] = paymentRegister(scope.db, rangeOf(scope, p)).map((r) => ({
      date: r.date, docNumber: r.docNumber, direction: r.direction === 'in' ? 'Received' : 'Paid', partyName: r.partyName, method: r.method, reference: r.reference,
      inPaise: r.direction === 'in' ? r.amountPaise : null, outPaise: r.direction === 'out' ? r.amountPaise : null,
    }));
    return { rows, totals: totalsOf(rows, paymentColumns, ['inPaise', 'outPaise']) };
  },
};

const cashColumns = [
  col('date', 'Date', 'date'), col('openingPaise', 'Opening', 'money'), col('inPaise', 'Cash in', 'money'), col('outPaise', 'Cash out', 'money'), col('closingPaise', 'Closing', 'money'),
];
export const cashReport: ReportDefinition = {
  id: 'money.cash', title: 'Cash report', group: 'Cash and payments', permission: 'reports.financial', params: rangeParams, columns: cashColumns,
  run: (scope, p) => {
    const rows = cashByDay(scope.db, rangeOf(scope, p)) as unknown as Row[];
    const totals = totalsOf(rows, cashColumns, ['inPaise', 'outPaise']);
    return { rows, totals: { ...totals, openingPaise: rows[0]?.openingPaise ?? null, closingPaise: rows.at(-1)?.closingPaise ?? null } };
  },
};

const valuationColumns = [
  col('name', 'Product'), col('uomCode', 'Unit'), col('qtyMilli', 'On hand', 'qty'), col('avgCostPaise', 'Average cost', 'money'), col('valuePaise', 'Value', 'money'),
];
// The inventory sub-ledger as it stands now (ADR-0018); its total is account 1400's balance.
export const stockValuationReport: ReportDefinition = {
  id: 'stock.valuation', title: 'Stock valuation', group: 'Stock', permission: 'reports.view', params: [], columns: valuationColumns,
  run: ({ db, businessId }) => {
    const v = stockValuation(db, businessId);
    const rows: Row[] = v.rows.map((r) => ({ name: r.name, uomCode: r.uomCode, qtyMilli: r.qtyMilli, avgCostPaise: r.avgCostPaise, valuePaise: r.valuePaise }));
    return { rows, totals: { name: 'Total', uomCode: null, qtyMilli: null, avgCostPaise: null, valuePaise: v.totalValuePaise } };
  },
};

const movementColumns = [
  col('name', 'Product'), col('uomCode', 'Unit'), col('openingQtyMilli', 'Opening', 'qty'), col('inQtyMilli', 'In', 'qty'), col('outQtyMilli', 'Out', 'qty'),
  col('closingQtyMilli', 'Closing', 'qty'), col('closingValuePaise', 'Closing value', 'money'),
];
export const stockMovementReport: ReportDefinition = {
  id: 'stock.movement', title: 'Stock movement', group: 'Stock', permission: 'reports.view', params: rangeParams, columns: movementColumns,
  run: (scope, p) => {
    const rows: Row[] = stockMovementSummary(scope.db, rangeOf(scope, p)) as unknown as Row[];
    return { rows, totals: totalsOf(rows, movementColumns, ['closingValuePaise']) };
  },
};

export const BUSINESS_REPORTS = [purchasesReport, expensesReport, paymentsReport, cashReport, stockValuationReport, stockMovementReport];
