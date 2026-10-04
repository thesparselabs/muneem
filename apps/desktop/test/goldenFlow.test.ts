import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { financialYearOf, fyBounds, newUlid } from '@muneem/domain';
import { tieOutFailures, verifyAuditChain } from '@muneem/db-sqlite';
import type { AccountView, BalanceSheet, CompleteSaleResult, ProfitAndLoss, ProductHit, RegisterReport, SaleQuote, TrialBalance } from '@muneem/contracts';
import { caller, ownerAtTill, testApp } from './helpers.js';

// PRD §8 golden flow (Stages 3–4): billing and stock work end to end with the cloud unreachable.
describe('golden flow, offline', () => {
  it('opening stock → open register → scan → customer → discount → cash + UPI → receipt → stock and valuation → close with Z report', async () => {
    const { app, db, server, dir } = await testApp();
    const api = caller(app);
    await ownerAtTill(app);
    const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    await api.data('products.create', { name: 'Parle-G 100g', baseUomId: pcs, gstRateBp: 500, mrpPaise: 1000, sellingPricePaise: 1000, barcodes: [{ code: '8901030865275' }] });
    await api.data('products.create', { name: 'Surf Excel 1kg', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 13_500, barcodes: [{ code: 'SURF1KG' }] });
    const parleId = (await api.data<ProductHit>('products.lookupBarcode', { code: '8901030865275' })).productId;
    const surfId = (await api.data<ProductHit>('products.lookupBarcode', { code: 'SURF1KG' })).productId;
    await api.data('inventory.setOpeningStock', { lines: [{ productId: parleId, qtyMilli: 50_000, unitCostPaise: 800 }, { productId: surfId, qtyMilli: 10_000, unitCostPaise: 11_000 }] });

    server.online = false;
    await api.data('auth.logout');
    const session = await api.data<{ mode: string; terminalId: string }>('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    expect(session.mode).toBe('offline');
    expect(session.terminalId).toBeTruthy();

    await api.data('pos.openRegister', { openingCashPaise: 200_000 });
    const parle = await api.data<ProductHit>('products.lookupBarcode', { code: '8901030865275' });
    const surf = await api.data<ProductHit>('products.lookupBarcode', { code: 'SURF1KG' });
    const customer = await api.data<{ id: string }>('customers.create', { name: 'Meena Iyer', phone: '9876500000' });
    const draft = {
      customerId: customer.id,
      lines: [{ productId: parle.productId, uomId: parle.uomId, qtyMilli: 3000 }, { productId: surf.productId, uomId: surf.uomId, qtyMilli: 1000 }],
      billDiscount: { kind: 'amount', value: 500 },
    };
    const quote = await api.data<SaleQuote>('sales.quote', draft);
    const total = quote.totals.totalPaise;
    const sale = await api.data<CompleteSaleResult>('sales.complete', {
      ...draft, commandId: newUlid(), expectedTotalPaise: total,
      tenders: [{ method: 'upi', amountPaise: 10_000, reference: 'UPI-55' }, { method: 'cash', amountPaise: total - 10_000 + 2000 }],
    });
    expect(sale).toMatchObject({ changePaise: 2000, docNumber: expect.stringMatching(/^DE01\/\d{4}\/000001$/) });

    await app.printQueue.idle();
    const receiptFile = readdirSync(join(dir, 'receipts')).find((f) => f.endsWith('.txt'))!;
    const receipt = readFileSync(join(dir, 'receipts', receiptFile), 'utf8');
    expect(receipt).toContain(sale.docNumber);
    expect(receipt).toContain('Meena Iyer');
    expect(receipt).toContain('Change');

    await api.data('pos.cashMovement', { kind: 'cash_out', amountPaise: 5000, reason: 'delivery boy' });
    const cashIn = total - 10_000;
    const z = await api.data<RegisterReport>('pos.closeRegister', { countedCashPaise: 200_000 + cashIn - 5000 });
    expect(z).toMatchObject({ final: true, salesCount: 1, salesTotalPaise: total, variancePaise: 0, cashOutPaise: 5000 });

    // Stage 4: the sale moved stock at average cost and the inventory sub-ledger still balances
    expect(await api.data('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ stockMilli: 47_000 });
    expect(await api.data('inventory.valuation')).toMatchObject({ totalValuePaise: 47 * 800 + 9 * 11_000, balanced: true, negativeCount: 0 });
    expect(db.prepare('SELECT cogs_paise FROM sale WHERE id = ?').pluck().get(sale.saleId)).toBe(3 * 800 + 11_000);

    expect(await api.data('sync.getStatus')).toMatchObject({ state: 'queued' });
    expect(db.prepare("SELECT status FROM sync_outbox WHERE entity_type = 'sale'").pluck().all()).toEqual(['pending']);
    expect(verifyAuditChain(db, app.session.require().businessId!, app.device.localDeviceId()).ok).toBe(true);

    // Stage 6: the same day in the books.
    const tb = await api.data<TrialBalance>('accounting.getTrialBalance');
    expect(tb.balanced).toBe(true);
    const bs = await api.data<BalanceSheet>('accounting.getBalanceSheet');
    const pl = await api.data<ProfitAndLoss>('accounting.getProfitAndLoss', { from: fyBounds(financialYearOf(tb.asOf)).start, to: tb.asOf });
    expect(bs).toMatchObject({ balanced: true, currentProfitPaise: pl.netProfitPaise });
    expect(tieOutFailures(db, app.session.require().businessId!)).toEqual([]);
    const balances = new Map((await api.data<AccountView[]>('accounting.listAccounts')).map((a) => [a.code, a.balancePaise]));
    const { taxablePaise, cgstPaise, sgstPaise, roundOffPaise } = quote.totals;
    expect(Object.fromEntries(['1100', '1199', '1250', '1300', '1400', '2210', '2220', '3400', '4100', '4900', '5100'].map((c) => [c, balances.get(c)]))).toEqual({
      '1100': cashIn - 5000,   // the ₹2,000 opening float is not a journal, so the books hold only what moved after it
      '1199': 5000,   // cash out waits to be classified (ADR-0032)
      '1250': 10_000,
      '1300': 0,
      '1400': 47 * 800 + 9 * 11_000,
      '2210': -cgstPaise,
      '2220': -sgstPaise,
      '3400': -(50 * 800 + 10 * 11_000),
      '4100': -taxablePaise,
      '4900': -roundOffPaise,
      '5100': 3 * 800 + 11_000,
    });
  });
});
