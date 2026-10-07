import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import type { Db } from '@muneem/db-sqlite';
import type { Outstanding, PartyImportPreview, ReportResult } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { parseBusinessDate } from '../src/main/services/parties/partyRowParser.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  await ownerAtTill(app);
});

const b64 = (s: string) => Buffer.from(s).toString('base64');
const errorsAt = (p: PartyImportPreview, line: number) => p.rows.find((r) => r.line === line)?.errors;

const CUSTOMERS = [
  'Customer Name,Mobile,Email,GSTIN,State,Address,City,PIN Code,Credit Days,Opening Balance,Opening Date',
  'Ramesh Traders,98765 43210,ramesh@example.com,07AAACR5055K1Z5,,12 Main Bazaar,Delhi,110006,30,"₹1,250.50",01/04/2026',
  'Sunita Devi,9811122233,,,7,,Delhi,,,-200,',
  ',9000000001,,,,,,,,,',
  'Bad Phone,98-76,,,,,,,,,',
  'Wrong State,9000000002,,07AAACW1111K1Z1,27,,,,,,',
  'Same Phone,9811122233,,,,,,,,,',
  'Bad Amount,9000000003,,,,,,,,ten,',
  'Future Date,9000000004,,,,,,,,100,2999-01-01',
  'Plain Walk-in,,,,,,,,,,',
].join('\n');

describe('customer import', () => {
  it('maps headers, reports bad rows and creates the rest with opening balances', async () => {
    const p = await api.data<PartyImportPreview>('customers.importPreview', { fileName: 'customers.csv', contentBase64: b64(CUSTOMERS) });
    expect(p.mapping).toEqual({ name: 0, phone: 1, email: 2, gstin: 3, stateCode: 4, addressLine1: 5, city: 6, pinCode: 7, creditDays: 8, openingBalance: 9, openingDate: 10 });
    expect(p.counts).toEqual({ total: 9, ok: 3, errors: 6, duplicates: 0, openings: 2 });
    expect(errorsAt(p, 4)).toMatchObject({ name: 'name is required' });
    expect(errorsAt(p, 5)).toMatchObject({ phone: 'digits only, 6–15 long' });
    expect(errorsAt(p, 6)).toMatchObject({ stateCode: 'the GSTIN is from state 07' });
    expect(errorsAt(p, 7)).toMatchObject({ phone: 'same phone as row 3' });
    expect(errorsAt(p, 8)).toMatchObject({ openingBalance: '"ten" is not a valid amount' });
    expect(errorsAt(p, 9)).toMatchObject({ openingDate: 'the opening date is in the future' });

    const commandId = newUlid();
    const s = app.customerImport.commit({ importId: p.importId, commandId });
    expect(s).toEqual({ created: 3, openingsSet: 2, skippedDuplicates: 0, skippedErrors: 6, skippedAtCommit: [] });
    expect(app.customerImport.commit({ importId: p.importId, commandId })).toEqual(s);

    const [ramesh] = app.customers.search('Ramesh', 5);
    expect(ramesh).toMatchObject({ phone: '9876543210', gstin: '07AAACR5055K1Z5', stateCode: '07', pinCode: '110006', creditDays: 30 });
    const [sunita] = app.customers.search('Sunita', 5);
    expect(sunita).toMatchObject({ stateCode: '07' });
    const owed = await api.data<Outstanding>('customers.getOutstanding', {});
    expect(owed.rows.find((r) => r.partyId === ramesh!.id)?.netPaise).toBe(125_050);
    expect(owed.rows.find((r) => r.partyId === sunita!.id)?.netPaise).toBe(-20_000);
    expect(db.prepare("SELECT as_of_date FROM party_opening WHERE party_id = ?").pluck().get(ramesh!.id)).toBe('2026-04-01');
  });

  it('skips a customer already on file by phone or GSTIN', async () => {
    const first = await api.data<PartyImportPreview>('customers.importPreview', { fileName: 'customers.csv', contentBase64: b64(CUSTOMERS) });
    app.customerImport.commit({ importId: first.importId, commandId: newUlid() });
    const again = await app.customerImport.preview({ fileName: 'customers.csv', contentBase64: b64(CUSTOMERS) });
    expect(again.counts).toMatchObject({ ok: 1, duplicates: 2 });
    expect(app.customerImport.commit({ importId: again.importId, commandId: newUlid() })).toMatchObject({ created: 1, skippedDuplicates: 2 });
  });

  it('refuses opening balances from a user who cannot edit customers', async () => {
    grantRole(db, app, 'cashier');
    const p = await app.customerImport.preview({ fileName: 'c.csv', contentBase64: b64('Name,Opening Balance\nAsha,500\nBina,') });
    expect(errorsAt(p, 2)).toMatchObject({ openingBalance: 'you are not allowed to set opening balances' });
    expect(p.counts).toMatchObject({ ok: 1, errors: 1 });
  });
});

describe('supplier import', () => {
  it('infers the tax scheme and state, and needs a state when there is no GSTIN', async () => {
    const csv = [
      'Supplier,Phone,GST No,State Code,Tax Scheme,Dues',
      'Gupta Distributors,9111111111,07AAACG2222K1Z3,,,5000',
      'Local Mandi,9222222222,,07,,',
      'No State,9333333333,,,,',
      'Odd Scheme,9444444444,,07,exempted,',
      'Composition Co,9555555555,27AAACC3333K1Z9,,Composition,',
    ].join('\n');
    const p = await api.data<PartyImportPreview>('suppliers.importPreview', { fileName: 'suppliers.csv', contentBase64: b64(csv) });
    expect(p.counts).toEqual({ total: 5, ok: 3, errors: 2, duplicates: 0, openings: 1 });
    expect(errorsAt(p, 4)).toHaveProperty('stateCode');
    expect(errorsAt(p, 5)).toMatchObject({ taxScheme: 'use regular, composition, unregistered' });
    expect(app.supplierImport.commit({ importId: p.importId, commandId: newUlid() })).toMatchObject({ created: 3, openingsSet: 1, skippedAtCommit: [] });
    expect(app.suppliers.search('Gupta', 5)[0]).toMatchObject({ taxScheme: 'regular', stateCode: '07' });
    expect(app.suppliers.search('Local', 5)[0]).toMatchObject({ taxScheme: 'unregistered' });
    expect(app.suppliers.search('Composition', 5)[0]).toMatchObject({ taxScheme: 'composition', stateCode: '27' });
    const owed = await api.data<Outstanding>('suppliers.getOutstanding', {});
    expect(Math.abs(owed.totals.netPaise)).toBe(500_000);
  });
});

describe('list exports', () => {
  it('lists customers, suppliers, products and accounts as reports', async () => {
    const p = await app.customerImport.preview({ fileName: 'c.csv', contentBase64: b64('Name,Phone\nAsha,9000000009') });
    app.customerImport.commit({ importId: p.importId, commandId: newUlid() });
    const customers = await api.data<ReportResult>('reports.run', { id: 'parties.customers', params: {} });
    expect(customers.rows).toEqual([expect.objectContaining({ name: 'Asha', phone: '9000000009' })]);
    for (const id of ['parties.suppliers', 'catalog.products', 'accounting.chartOfAccounts', 'sales.register']) {
      expect((await api.data<ReportResult>('reports.run', { id, params: {} })).truncated, id).toBe(false);
    }
  });
});

describe('import dates', () => {
  it('accepts ISO and day-first dates and refuses impossible ones', () => {
    expect(parseBusinessDate('2026-04-01')).toBe('2026-04-01');
    expect(parseBusinessDate('1/4/2026')).toBe('2026-04-01');
    expect(parseBusinessDate('31-12-2025')).toBe('2025-12-31');
    expect(parseBusinessDate('31/02/2026')).toBeNull();
    expect(parseBusinessDate('April 1')).toBeNull();
  });
});
