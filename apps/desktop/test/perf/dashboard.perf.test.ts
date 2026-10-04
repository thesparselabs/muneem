import { beforeAll, describe, expect, it } from 'vitest';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { addDays, newUlid } from '@muneem/domain';
import { createProduct, dailySummaryDrift, findUomByCode, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';

const SALES = 200_000;
const PRODUCTS = 2_000;
const DAYS = 365;
const BATCH = 10_000;

let app: App;
let db: Db;
let businessId: string;

function seeded(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

// 200k sales over a year, written as rows so the 0018 triggers fill the daily tables exactly as live sales would.
beforeAll(async () => {
  ({ app, db } = await testApp({ file: true }));
  ({ businessId } = await ownerAtTill(app));
  const api = caller(app);
  const pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  const today = new Date().toLocaleDateString('en-CA');
  const products = withTransaction(db, () => Array.from({ length: PRODUCTS }, (_, i) => createProduct(db, businessId, ProductInput.parse({
    name: `Item ${i}`, baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 1000 + i, reorderLevelMilli: i % 50 === 0 ? 1_000_000 : undefined,
  }), actor, today).id));
  const customer = (await api.data<{ id: string }>('customers.create', { name: 'Regular' })).id;
  await api.data('pos.openRegister', { openingCashPaise: 0 });
  app.inventory.setOpeningStock({ lines: [{ productId: products[0]!, qtyMilli: 1000, unitCostPaise: 500 }] });
  const d = SaleDraft.parse({ lines: [{ productId: products[0]!, uomId: pcs, qtyMilli: 1000 }] });
  const first = app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: app.sales.quote(d).totals.totalPaise, tenders: [{ method: 'cash', amountPaise: 1000 }] }));
  const template = db.prepare('SELECT * FROM sale WHERE id = ?').get(first.saleId) as Record<string, unknown>;
  const rand = seeded(8_005);
  const sale = db.prepare(`INSERT INTO sale (id, business_id, branch_id, terminal_id, session_id, command_id, doc_type, series_id, doc_number, doc_seq, doc_date, fy,
      customer_id, customer_snapshot_json, place_of_supply_state, supply_type, gstr1_bucket, tax_scheme, gross_paise, taxable_paise, cgst_paise, sgst_paise,
      total_paise, paid_paise, credit_paise, cogs_paise, created_at, updated_at, created_by, device_id)
    VALUES (@id, @business_id, @branch_id, @terminal_id, @session_id, @id, 'tax_invoice', @series_id, @num, @seq, @date, @fy, @customer, '{}', @place_of_supply_state, 'intra', 'b2cs',
      'regular', @taxable, @taxable, @half, @half, @total, @paid, @credit, @cogs, @date, @date, 'u', 'd')`);
  const item = db.prepare(`INSERT INTO sale_item (id, sale_id, business_id, line_no, product_id, product_name, uom_id, uom_code, qty_milli, base_qty_milli,
      unit_price_paise, price_is_inclusive, gross_paise, taxable_paise, tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, total_paise, cogs_paise)
    VALUES (?, ?, ?, 1, ?, 'x', ?, 'PCS', 1000, 1000, ?, 0, ?, ?, 'taxable', 1800, ?, ?, ?, ?)`);
  const tender = db.prepare('INSERT INTO sale_tender (id, sale_id, business_id, line_no, method, amount_paise) VALUES (?, ?, ?, ?, ?, ?)');
  const entry = db.prepare(`INSERT INTO party_ledger_entry (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, occurred_at,
      created_at, updated_at, created_by, device_id) VALUES (?, ?, 'customer', ?, 'sale', ?, 'post', ?, ?, 'a', 'a', 'a', 'u', 'd')`);
  for (let start = 0; start < SALES; start += BATCH) {
    withTransaction(db, () => {
      for (let i = start; i < Math.min(start + BATCH, SALES); i++) {
        const id = newUlid();
        const taxable = 10_000 + rand(50_000);
        const half = Math.round(taxable * 0.09);
        const total = taxable + 2 * half;
        const credit = i % 10 === 0 ? total : 0;
        const date = addDays(today, -Math.floor((i * DAYS) / SALES));
        sale.run({ ...template, id, num: `P${i}`, seq: 1_000_000 + i, date, customer: credit ? customer : null, taxable, half, total, paid: total - credit, credit, cogs: Math.floor(taxable * 0.7) });
        item.run(`${id}-001`, id, businessId, products[rand(PRODUCTS)]!, pcs, taxable, taxable, taxable, half, half, total, Math.floor(taxable * 0.7));
        if (credit) {
          tender.run(`${id}-T1`, id, businessId, 1, 'credit', total);
          entry.run(newUlid(), businessId, customer, id, total, date);
        } else tender.run(`${id}-T1`, id, businessId, 1, rand(2) === 0 ? 'cash' : 'upi', total);
      }
    });
  }
}, 600_000);

describe('dashboard at 200k sales (LLD §18)', () => {
  it('reads in under 300 ms (median of 5), and the triggers kept the daily tables exact', () => {
    const sales = db.prepare('SELECT COUNT(*) FROM sale WHERE business_id = ?').pluck().get(businessId) as number;
    expect(sales).toBeGreaterThan(SALES);
    const ms = Array.from({ length: 5 }, () => { const t = performance.now(); app.dashboard.get(); return performance.now() - t; }).sort((a, b) => a - b);
    const d = app.dashboard.get();
    console.info(`dashboard at ${sales} sales (median of 5) = ${ms[2]!.toFixed(1)} ms; today ${d.sales.saleCount} bills, ${d.lowStock.count} low-stock items`);
    expect(d.trend).toHaveLength(30);
    expect(d.sales.saleCount).toBeGreaterThan(0);
    expect(ms[2]!).toBeLessThan(300);
    const t0 = performance.now();
    expect(dailySummaryDrift(db, businessId)).toEqual([]);
    const t1 = performance.now();
    expect(dailySummaryDrift(db, businessId, addDays(new Date().toLocaleDateString('en-CA'), -35))).toEqual([]);
    console.info(`daily summary drift check at ${sales} sales: whole history ${(t1 - t0).toFixed(0)} ms, last 35 days ${(performance.now() - t1).toFixed(0)} ms`);
  }, 300_000);
});

describe('reports and exports at 200k sales (8j)', () => {
  it('a year of each main report runs, and exports to CSV and XLSX, within generous ceilings', async () => {
    const to = new Date().toLocaleDateString('en-CA');
    const year = { from: addDays(to, -364), to };
    const runs: [string, Record<string, string>][] = [
      ['sales.byDay', year], ['sales.byProduct', year], ['sales.byPaymentMethod', year], ['parties.receivables', {}],
      ['stock.valuation', {}], ['accounting.trialBalance', {}], ['accounting.profitAndLoss', year],
    ];
    const timings: string[] = [];
    for (const [id, params] of runs) {
      const t = performance.now();
      const r = app.reports.run(id, params);
      const ms = performance.now() - t;
      timings.push(`${id} ${ms.toFixed(0)} ms (${r.rows.length} rows)`);
      expect(ms, id).toBeLessThan(5_000);
    }
    for (const format of ['csv', 'xlsx'] as const) {
      const t = performance.now();
      const r = await app.reports.export('sales.byDay', year, format);
      const ms = performance.now() - t;
      timings.push(`export sales.byDay ${format} ${ms.toFixed(0)} ms (${(r.bytes / 1024).toFixed(0)} KiB)`);
      expect(ms, format).toBeLessThan(10_000);
    }
    console.info(`reports at 200k sales: ${timings.join('; ')}`);
  }, 300_000);
});
