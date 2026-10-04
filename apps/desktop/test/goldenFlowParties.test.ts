import { describe, expect, it } from 'vitest';
import { financialYearOf, fyBounds, newUlid } from '@muneem/domain';
import { reconcilePartiesDb, replayCheck, tieOutFailures } from '@muneem/db-sqlite';
import type {
  AccountView, BalanceSheet, ProfitAndLoss, TrialBalance,
  Customer, DebitNote, Expense, ExpenseCategory, LedgerPage, Outstanding, Payment, Purchase, RegisterReport, SaleQuote, CompleteSaleResult, Supplier,
} from '@muneem/contracts';
import { caller, ownerAtTill, testApp } from './helpers.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Stage 5 golden flow: buying, selling on credit, paying and being paid all work end to end with the cloud unreachable.
describe('golden flow, parties, offline', () => {
  it('supplier opening → purchase with freight → credit sale → receipt → debit note → supplier payment → expense → Z report', async () => {
    const { app, db, server } = await testApp();
    const api = caller(app);
    const { businessId } = await ownerAtTill(app);
    const call = async <T>(channel: string, input: unknown = {}): Promise<T> => { await sleep(510); return api.data<T>(channel, input); };   // stay under the 2/s IPC limit
    const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const rice = await api.data<{ id: string }>('products.create', { name: 'Rice 1kg', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 7000 });

    server.online = false;
    await api.data('auth.logout');
    expect((await api.data<{ mode: string }>('auth.login', { identifier: '9999999999', password: 'correct-horse' })).mode).toBe('offline');

    // Supplier owes nothing yet; we owe ₹500 from before.
    const acme = await call<Supplier>('suppliers.create', { name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', creditDays: 30 });
    await call('suppliers.setOpening', { partyId: acme.id, amountPaise: 50_000, asOfDate: '2026-04-01' });

    // 20 bags at ₹50 + 5% GST, ₹100 freight: ₹1,000 + ₹50 + ₹100 = ₹1,150; landed ₹1,100 (GST claimed) → ₹55 a bag.
    const purchase = await call<Purchase>('purchases.create', {
      supplierId: acme.id, supplierInvoiceNo: 'A-77', supplierInvoiceDate: '2026-09-20', commandId: newUlid(), billTotalPaise: 115_000,
      lines: [{ productId: rice.id, uomId: pcs, qtyMilli: 20_000, unitPricePaise: 5000 }], charges: [{ kind: 'freight', amountPaise: 10_000 }],
    });
    expect(purchase.lines[0]).toMatchObject({ landedValuePaise: 110_000, unitCostPaise: 5500 });

    // A customer buys 10 bags (₹735) and pays ₹235 cash, ₹500 on credit.
    await call('pos.openRegister', { openingCashPaise: 100_000 });
    const meena = await call<Customer>('customers.create', { name: 'Meena', creditDays: 15 });
    await call('customers.setCreditLimit', { id: meena.id, version: meena.version, limitPaise: 100_000 });
    const draft = { customerId: meena.id, lines: [{ productId: rice.id, uomId: pcs, qtyMilli: 10_000 }] };
    const quote = await call<SaleQuote>('sales.quote', draft);
    const total = quote.totals.totalPaise;
    expect(quote.credit).toMatchObject({ availablePaise: 100_000 });
    const sale = await call<CompleteSaleResult>('sales.complete', {
      ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total - 50_000 }, { method: 'credit', amountPaise: 50_000 }],
    });

    // She pays ₹600 in cash: ₹500 settles the sale, ₹100 stays as an advance.
    const receipt = await call<Payment>('payments.create', { partyType: 'customer', partyId: meena.id, amountPaise: 60_000, method: 'cash', commandId: newUlid() });
    expect(receipt).toMatchObject({ allocatedPaise: 50_000, allocations: [expect.objectContaining({ targetId: sale.saleId })] });

    // 2 bags go back to Acme: ₹100 + ₹5 GST off what we owe; stock leaves at ₹55 a bag.
    const note = await call<DebitNote>('purchases.return', { purchaseId: purchase.id, reason: 'torn bags', commandId: newUlid(), lines: [{ purchaseItemId: purchase.lines[0]!.id, qtyMilli: 2000 }] });
    expect(note).toMatchObject({ totalPaise: 10_500, allocatedPaise: 10_500 });

    // We pay Acme ₹1,000 cash from the drawer: the opening first (₹500), then the purchase (₹500 of ₹1,045 left).
    const paid = await call<Payment>('payments.create', { partyType: 'supplier', partyId: acme.id, amountPaise: 100_000, method: 'cash', commandId: newUlid() });
    expect(paid.allocations.map((a) => [a.targetType, a.amountPaise])).toEqual([['opening', 50_000], ['purchase', 50_000]]);

    // ₹200 of tea and snacks from the drawer.
    const category = (await call<ExpenseCategory[]>('expenses.listCategories')).find((c) => c.code === 'OTHER')!;
    await call<Expense>('expenses.create', { categoryId: category.id, method: 'cash', amountPaise: 20_000, description: 'Tea', commandId: newUlid() });

    const cashSale = total - 50_000;
    const x = await call<RegisterReport>('pos.xReport');
    expect(x.expectedCashPaise).toBe(100_000 + cashSale + 60_000 - 100_000 - 20_000);
    const z = await call<RegisterReport>('pos.closeRegister', { countedCashPaise: x.expectedCashPaise });
    expect(z).toMatchObject({ final: true, variancePaise: 0, byTender: expect.arrayContaining([{ method: 'credit', amountPaise: 50_000 }]) });

    // The ledgers: Meena has a ₹100 advance; we still owe Acme ₹1,150 − ₹105 − ₹500 = ₹545.
    expect((await call<LedgerPage>('customers.getLedger', { partyId: meena.id })).closingBalancePaise).toBe(-10_000);
    expect((await call<LedgerPage>('suppliers.getLedger', { partyId: acme.id })).closingBalancePaise).toBe(-54_500);
    expect((await call<Outstanding>('suppliers.getOutstanding', {})).totals).toMatchObject({ netPaise: 54_500 });
    expect((await call<Outstanding>('customers.getOutstanding', {})).totals).toMatchObject({ advancePaise: 10_000, netPaise: -10_000 });

    // Stock: 20 in, 10 sold, 2 returned = 8 bags at ₹55, and the books agree with themselves.
    expect(await call('inventory.valuation')).toMatchObject({ totalValuePaise: 8 * 5500, balanced: true });
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
    expect(replayCheck(db, businessId)).toEqual([]);
    expect(await call('diagnostics.integrityCheck')).toMatchObject({ stock: 'ok', parties: 'ok' });

    // Every document went to the sync queue with its ledger entry.
    const payloads = db.prepare("SELECT entity_type, payload_json FROM sync_outbox WHERE entity_type IN ('sale', 'purchase', 'debit_note', 'payment')").all() as { entity_type: string; payload_json: string }[];
    expect(payloads.map((p) => p.entity_type).sort()).toEqual(['debit_note', 'payment', 'payment', 'purchase', 'sale']);
    for (const p of payloads) expect(p.payload_json).toMatch(/"(entry|partyEntry)":\{/);

    // Stage 6: the books balance, agree with the sub-ledgers and say what the flow did.
    const tb = await call<TrialBalance>('accounting.getTrialBalance');
    expect(tb.balanced).toBe(true);
    const bs = await call<BalanceSheet>('accounting.getBalanceSheet');
    const pl = await call<ProfitAndLoss>('accounting.getProfitAndLoss', { from: fyBounds(financialYearOf(tb.asOf)).start, to: tb.asOf });
    expect(bs).toMatchObject({ balanced: true, currentProfitPaise: pl.netProfitPaise });
    const { taxablePaise, cgstPaise, sgstPaise } = quote.totals;
    expect(pl.netProfitPaise).toBe(taxablePaise - 10 * 5500 - 1000 - 20_000);
    expect(tieOutFailures(db, businessId)).toEqual([]);
    const balances = new Map((await call<AccountView[]>('accounting.listAccounts')).map((a) => [a.code, a.balancePaise]));
    expect(Object.fromEntries(['1100', '1300', '1400', '1510', '1520', '2100', '2210', '2220', '3400', '4100', '5100', '5110', '5900'].map((c) => [c, balances.get(c)]))).toEqual({
      '1100': cashSale + 60_000 - 100_000 - 20_000,   // the ₹1,000 opening float is not a journal, so cash in hand reads ₹400 below zero
      '1300': -10_000,
      '1400': 8 * 5500,
      '1510': 2500 - 250,
      '1520': 2500 - 250,
      '2100': -54_500,
      '2210': -cgstPaise,
      '2220': -sgstPaise,
      '3400': 50_000,
      '4100': -taxablePaise,
      '5100': 10 * 5500,
      '5110': 1000,   // the 2 returned bags' ₹5 freight share each, which Acme keeps
      '5900': 20_000,
    });
  }, 60_000);
});
