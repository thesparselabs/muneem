import type { ReportParamField } from '@muneem/contracts';
import type { PartyType } from '@muneem/domain';
import { partyOutstanding, partyStatement } from '@muneem/db-sqlite';
import { dateParam, type ReportDefinition, type Row } from '../definition.js';
import { MAX_ROWS } from '../service.js';
import { col } from './params.js';

const ageingColumns = [
  col('name', 'Party'), col('notDuePaise', 'Not due', 'money'), col('days0to30Paise', '0–30 days', 'money'), col('days31to60Paise', '31–60 days', 'money'),
  col('days61to90Paise', '61–90 days', 'money'), col('over90Paise', 'Over 90 days', 'money'), col('advancePaise', 'Advance', 'money'), col('netPaise', 'Net', 'money'),
];

// As the books stood on the date: documents dated by then, settlements made and not voided by then (Stage 5 carry, 5h #5).
const outstanding = (id: string, title: string, partyType: PartyType): ReportDefinition => ({
  id, title, group: 'Parties', permission: 'reports.view', params: [dateParam('asOf', 'As of', false)], columns: ageingColumns,
  run: ({ db, businessId, today }, p) => {
    const o = partyOutstanding(db, businessId, partyType, p.asOf ?? today, undefined, today);
    return { rows: o.rows as unknown as Row[], totals: { name: 'Total', ...o.totals } };
  },
});

export const receivablesReport = outstanding('parties.receivables', 'Receivables (ageing)', 'customer');
export const payablesReport = outstanding('parties.payables', 'Payables (ageing)', 'supplier');

const ledgerColumns = [
  col('docDate', 'Date', 'date'), col('refType', 'Document'), col('docNumber', 'Number'), col('kind', 'Entry'),
  col('debitPaise', 'Debit', 'money'), col('creditPaise', 'Credit', 'money'), col('balancePaise', 'Balance', 'money'),
];

// Positive = the party owes the business, so a charge is a debit and a settlement a credit, for either kind of party.
const ledger = (id: string, title: string, partyType: PartyType): ReportDefinition => {
  const party: ReportParamField = { key: 'partyId', label: partyType === 'customer' ? 'Customer' : 'Supplier', kind: partyType, required: true };
  return {
    id, title, group: 'Parties', permission: 'reports.view', columns: ledgerColumns,
    params: [party, dateParam('from', 'From', false), dateParam('to', 'To', false)],
    run: ({ db, businessId }, p) => {
      const page = partyStatement(db, { businessId, partyType, partyId: p.partyId! }, { from: p.from, to: p.to, limit: MAX_ROWS });
      const rows: Row[] = [
        { docDate: p.from ?? null, refType: 'Opening balance', docNumber: null, kind: null, debitPaise: null, creditPaise: null, balancePaise: page.openingBalancePaise },
        ...page.items.map((e) => ({
          docDate: e.docDate, refType: e.refType, docNumber: e.docNumber ?? null, kind: e.kind,
          debitPaise: e.amountPaise > 0 ? e.amountPaise : null, creditPaise: e.amountPaise < 0 ? -e.amountPaise : null, balancePaise: e.balancePaise,
        })),
      ];
      const sum = (k: 'debitPaise' | 'creditPaise') => rows.reduce((s, r) => s + (typeof r[k] === 'number' ? r[k] : 0), 0);
      return { rows, totals: { docDate: null, refType: 'Closing balance', docNumber: null, kind: null, debitPaise: sum('debitPaise'), creditPaise: sum('creditPaise'), balancePaise: page.closingBalancePaise } };
    },
  };
};

export const customerLedgerReport = ledger('parties.customerLedger', 'Customer ledger', 'customer');
export const supplierLedgerReport = ledger('parties.supplierLedger', 'Supplier ledger', 'supplier');

export const PARTY_REPORTS = [receivablesReport, payablesReport, customerLedgerReport, supplierLedgerReport];
