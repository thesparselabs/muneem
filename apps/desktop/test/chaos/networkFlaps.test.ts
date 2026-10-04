import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteReturnInput, ProductInput } from '@muneem/contracts';
import { FaultInjector } from '@muneem/sync-reference';
import type { Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import type { Credentials, Transport } from '../../src/main/sync/transport.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';
import { Clock } from '../sync/cloudHarness.js';
import { sell } from '../sync/scenario37.js';
import { books, DEVICE_A, DEVICE_B, healthy, ownerMembership, referenceCloud, referenceTransport, syncedAppOptions, syncUntilQuiet } from '../sync/syncHelpers.js';

const START = Date.parse('2026-10-05T04:30:00.000Z');
const PAGE = 5;
const FLAPPING = { drop: 0.3, dropResponse: 0.3, error500: 0.1, duplicate: 0.1 };
const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };

const count = (db: Db, sql: string, ...args: unknown[]) => db.prepare(sql).pluck().get(...args) as number;

describe('network flapping mid-sync (9g)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('connections cut mid-push and mid-pull page, again and again while both tills bill, lose and duplicate nothing and converge', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = new Clock(START, false);
    const cloud = referenceCloud();
    const net = new FaultInjector(cloud, { seed: 99 }, () => Promise.resolve());
    let businessId = '';
    // Pull pages of five, so a cut lands between pages of one pull.
    const smallPages = (credentials: () => Credentials | null): Transport => {
      const t = referenceTransport(net, () => credentials()?.deviceId ?? null);
      return { ...t, pull: (q) => t.pull({ ...q, limit: Math.min(q.limit ?? PAGE, PAGE) }) };
    };
    const device = (cloudId: string) => testApp({ ...syncedAppOptions(net, cloudId, () => (businessId ? [ownerMembership(businessId)] : [])), syncTransport: smallPages });

    const a = await device(DEVICE_A);
    ({ businessId } = await ownerAtTill(a.app));
    await caller(a.app).data('printer.setConfig', { kind: 'none' });
    const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const tea = a.app.products.create(ProductInput.parse({ name: 'Tea 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
    a.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 1_000_000, unitCostPaise: 8_000 }] });
    await a.app.register.open(10_000);
    await syncUntilQuiet(a.app);
    const b = await device(DEVICE_B);
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    b.app.business.selectTerminal(b.app.business.createTerminal({ branchId: b.app.business.getBranches()[0]!.id, code: 'T02', name: 'Till 2' }).id);
    await b.app.register.open(10_000);
    await syncUntilQuiet(b.app);

    const tills: { app: App; db: Db }[] = [a, b];
    let sold = 0;
    net.configure(FLAPPING);
    for (let round = 0; round < 12; round++) {
      net.partition(round % 4 === 2);
      for (const t of tills) {
        let saleId = '';
        for (let i = 0; i < 6; i++) { clock.tick(); saleId = sell(t.app, tea, pcs, 1000 * (1 + (i % 3))).saleId; sold++; }
        if (round % 3 === 1) {
          const back = { saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }] };
          t.app.returns.complete(CompleteReturnInput.parse({ ...back, commandId: newUlid(), reason: 'damaged', expectedTotalPaise: t.app.returns.quote(back).totalPaise }));
        }
        for (let attempt = 0; attempt < 3; attempt++) { clock.tick(60_000); t.app.syncEngine.retryNow(); await t.app.syncEngine.run({ pull: true }); }
      }
    }

    net.partition(false);
    net.configure({ drop: 0, dropResponse: 0, error500: 0, duplicate: 0 });
    clock.idle(30 * 60_000);
    for (let pass = 0; pass < 3; pass++) for (const t of tills) { t.app.syncEngine.retryNow(); await syncUntilQuiet(t.app); }

    const cut = (call: string, fault: string) => net.events.filter((e) => e.call === call && e.fault === fault).length;
    for (const call of ['push', 'pull']) for (const fault of ['drop', 'drop_response']) expect(cut(call, fault), `${call} ${fault}`).toBeGreaterThan(0);
    expect(cut('push', 'partition'), 'offline rounds').toBeGreaterThan(0);
    expect(cloud.deadLetters(businessId)).toEqual([]);
    expect([...cloud.business(businessId)!.entities.values()].filter((e) => e.entityType === 'sale')).toHaveLength(sold);
    const reference = books(a.db, businessId);
    expect(reference.sales).toHaveLength(sold);
    expect(reference.creditNotes).toHaveLength(8);
    expect(books(b.db, businessId)).toEqual(reference);
    for (const t of tills) {
      expect(healthy(t.db, businessId)).toEqual(HEALTHY);
      expect(count(t.db, "SELECT COUNT(*) FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')")).toBe(0);
      expect(count(t.db, 'SELECT COUNT(*) FROM (SELECT doc_number FROM sale GROUP BY doc_number HAVING COUNT(*) > 1)')).toBe(0);
    }
    const audit = cloud.business(businessId)!.audit;
    for (const t of tills) {
      const deviceId = t.app.device.localDeviceId();
      expect(audit.chain(deviceId).map((e) => e.row.hash)).toEqual(t.db.prepare('SELECT hash FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq').pluck().all(businessId, deviceId));
    }
  }, 300_000);
});
