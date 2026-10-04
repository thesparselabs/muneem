import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { financialYearOf } from '@muneem/domain';
import { ProductInput } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import { caller } from '../helpers.js';
import { referenceHarness } from '../sync/cloudHarness.js';
import { sell } from '../sync/scenario37.js';
import { books, healthy, syncUntilQuiet } from '../sync/syncHelpers.js';
import { checkDocuments } from './checkDocuments.js';

const DAY = 86_400_000;
const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };

interface Billed { doc_number: string; doc_date: string; fy: string; entry_date: string; late_posting: number }
const billed = (db: Db, saleId: string) => db.prepare(`SELECT s.doc_number, s.doc_date, s.fy, j.entry_date, j.late_posting FROM sale s
  JOIN journal_entry j ON j.ref_type = 'sale' AND j.ref_id = s.id WHERE s.id = ?`).get(saleId) as Billed;

describe('device clock jumps (9g, NFR-018)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('a clock a week fast and then a day slow across 31 March keeps every series whole, dates each bill in its own FY, flags the late posting, and syncs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const cloud = referenceHarness(18, Date.parse('2026-03-27T06:30:00.000Z'));
    const { clock } = cloud;
    const a = await cloud.device('A', { file: true });
    const { businessId } = await cloud.ownerAtTill(a.app);
    await caller(a.app).data('printer.setConfig', { kind: 'none' });
    const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const tea = a.app.products.create(ProductInput.parse({ name: 'Tea 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
    a.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 500_000, unitCostPaise: 8_000 }] });
    await a.app.register.open(10_000);
    await syncUntilQuiet(a.app);
    const b = await cloud.device('B');
    await cloud.login(b.app);
    await syncUntilQuiet(b.app);
    b.app.business.selectTerminal(b.app.business.createTerminal({ branchId: b.app.business.getBranches()[0]!.id, code: 'T02', name: 'Till 2' }).id);
    await b.app.register.open(10_000);

    clock.tick(3 * DAY);
    const before = [sell(a.app, tea, pcs), sell(a.app, tea, pcs)].map((s) => billed(a.db, s.saleId));
    clock.jump(7 * DAY);
    const fast = [sell(a.app, tea, pcs), sell(a.app, tea, pcs)].map((s) => billed(a.db, s.saleId));
    clock.jump(-7 * DAY);
    const back = billed(a.db, sell(a.app, tea, pcs).saleId);

    clock.tick(2 * DAY);
    a.app.periods.lock('2026-03-01');
    const onTime = billed(a.db, sell(a.app, tea, pcs).saleId);
    clock.jump(-DAY);
    const slow = billed(a.db, sell(a.app, tea, pcs).saleId);
    clock.jump(DAY);
    const elsewhere = billed(b.db, sell(b.app, tea, pcs).saleId);

    expect(before.map((s) => [s.doc_date, s.fy])).toEqual([['2026-03-30', '2025-26'], ['2026-03-30', '2025-26']]);
    expect(fast.map((s) => [s.doc_date, s.fy])).toEqual([['2026-04-06', '2026-27'], ['2026-04-06', '2026-27']]);
    expect([back.doc_date, back.fy]).toEqual(['2026-03-30', '2025-26']);
    expect([onTime.doc_date, onTime.fy, onTime.late_posting]).toEqual(['2026-04-01', '2026-27', 0]);
    expect(slow).toMatchObject({ doc_date: '2026-03-31', fy: '2025-26', entry_date: '2026-04-01', late_posting: 1 });
    expect(elsewhere).toMatchObject({ doc_date: '2026-04-01', fy: '2026-27', late_posting: 0 });
    const seq = (s: Billed) => Number(s.doc_number.split('/').at(-1));
    expect([...before, back, slow].map(seq), 'the 2025-26 series carries on without a gap').toEqual([1, 2, 3, 4]);
    expect([...fast, onTime].map(seq), 'the 2026-27 series is its own').toEqual([1, 2, 3]);
    expect(a.app.periods.latePostings().map((l) => [l.docDate, l.entryDate])).toEqual([['2026-03-31', '2026-04-01']]);
    for (const s of [...before, ...fast, back, onTime, slow, elsewhere]) expect(s.fy).toBe(financialYearOf(s.doc_date));

    await syncUntilQuiet(a.app);
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(books(a.db, businessId).sales).toHaveLength(8);
    for (const d of [a, b]) expect(healthy(d.db, businessId)).toEqual(HEALTHY);
    expect(await cloud.deadLetters(businessId)).toEqual([]);
    expect(checkDocuments(join(a.dir, 'muneem.sqlite')).failures.join()).toEqual('');
  }, 120_000);
});
