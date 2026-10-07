import { customerMaster, listAccounts, productMaster, salesRegister, supplierMaster, type Db, type PartyMasterRow } from '@muneem/db-sqlite';
import type { ReportColumn } from '@muneem/contracts';
import type { ReportDefinition, Row } from '../definition.js';
import { MAX_ROWS } from '../service.js';
import { col, rangeOf, rangeParams, totalsOf } from './params.js';

// Headers match the product import's, so this file can be edited and imported back.
const productColumns = [
  col('name', 'Item Name'), col('sku', 'Item Code'), col('barcodes', 'Barcode'), col('hsnCode', 'HSN'), col('categoryName', 'Category'), col('brandName', 'Brand'),
  col('uomCode', 'Unit'), col('mrpPaise', 'MRP', 'money'), col('pricePaise', 'Sale Price', 'money'), col('purchasePricePaise', 'Purchase Price', 'money'),
  col('gstRateBp', 'GST %', 'percent'), col('reorderLevelMilli', 'Reorder Level', 'qty'), col('active', 'Active'),
];
export const productListReport: ReportDefinition = {
  id: 'catalog.products', title: 'Product list', group: 'Lists', permission: 'reports.view', params: [], columns: productColumns,
  run: ({ db, businessId, today }) => ({
    rows: productMaster(db, businessId, today, MAX_ROWS).map((p) => ({
      name: p.name, sku: p.sku ?? null, barcodes: p.barcodes, hsnCode: p.hsnCode ?? null, categoryName: p.categoryName ?? null, brandName: p.brandName ?? null,
      uomCode: p.baseUomCode, mrpPaise: p.mrpPaise ?? null, pricePaise: p.pricePaise, purchasePricePaise: p.purchasePricePaise,
      gstRateBp: p.gstRateBp, reorderLevelMilli: p.reorderLevelMilli, active: p.isActive ? 'Yes' : 'No',
    })),
  }),
};

const partyColumns = [
  col('name', 'Name'), col('phone', 'Phone'), col('email', 'Email'), col('gstin', 'GSTIN'), col('stateCode', 'State Code'), col('addressLine1', 'Address'),
  col('city', 'City'), col('pinCode', 'PIN Code'), col('creditDays', 'Credit Days', 'number'),
];
const partyList = (id: string, title: string, extra: ReportColumn, rows: (db: Db, businessId: string) => PartyMasterRow[]): ReportDefinition => ({
  id, title, group: 'Lists', permission: 'reports.view', params: [], columns: [...partyColumns, extra],
  run: ({ db, businessId }) => ({ rows: rows(db, businessId) as unknown as Row[] }),
});
export const customerListReport = partyList('parties.customers', 'Customer list', col('creditLimitPaise', 'Credit Limit', 'money'), customerMaster);
export const supplierListReport = partyList('parties.suppliers', 'Supplier list', col('taxScheme', 'Tax Scheme'), supplierMaster);

const accountColumns = [col('code', 'Code'), col('name', 'Account'), col('type', 'Type'), col('parentCode', 'Under'), col('kind', 'Kind')];
export const chartOfAccountsReport: ReportDefinition = {
  id: 'accounting.chartOfAccounts', title: 'Chart of accounts', group: 'Lists', permission: 'reports.financial', params: [], columns: accountColumns,
  run: ({ db, businessId }) => {
    const accounts = listAccounts(db, businessId);
    const codeOf = new Map(accounts.map((a) => [a.id, a.code]));
    return { rows: accounts.map((a) => ({ code: a.code, name: a.name, type: a.type, parentCode: a.parentId ? codeOf.get(a.parentId) ?? null : null, kind: a.isGroup ? 'Group' : 'Ledger' })) };
  },
};

const salesColumns = [
  col('docDate', 'Date', 'date'), col('docNumber', 'Invoice'), col('customerName', 'Customer'), col('customerGstin', 'GSTIN'), col('status', 'Status'),
  col('taxablePaise', 'Taxable', 'money'), col('taxPaise', 'GST', 'money'), col('totalPaise', 'Total', 'money'), col('paidPaise', 'Paid', 'money'), col('creditPaise', 'On credit', 'money'),
];
export const salesRegisterReport: ReportDefinition = {
  id: 'sales.register', title: 'Sales register', group: 'Sales', permission: 'reports.view', params: rangeParams, columns: salesColumns,
  run: (scope, p) => {
    const rows = salesRegister(scope.db, rangeOf(scope, p)) as unknown as Row[];
    return { rows, totals: totalsOf(rows, salesColumns, ['taxablePaise', 'taxPaise', 'totalPaise', 'paidPaise', 'creditPaise']) };
  },
};

export const MASTER_REPORTS = [salesRegisterReport, productListReport, customerListReport, supplierListReport, chartOfAccountsReport];
