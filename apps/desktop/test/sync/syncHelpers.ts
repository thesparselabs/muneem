import { ROLE_PRESETS } from '@muneem/contracts';
import { reconcilePartiesDb, replayCheck, tieOutFailures, type Db } from '@muneem/db-sqlite';
import { ReferenceServer, ServerError, type SyncServer } from '@muneem/sync-reference';
import { HttpBundleDownloader } from '../../src/main/sync/bundleDownloader.js';
import { TransportError, type Transport } from '../../src/main/sync/transport.js';
import type { App } from '../../src/main/app.js';
import { defaultServer, loginResponse, ORG_ID, testApp, USER_ID, type FakeServer, type TestAppOptions } from '../helpers.js';

export const DEVICE_A = '01J0000000000000000000DEVA';
export const DEVICE_B = '01J0000000000000000000DEVB';

const wire = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// The in-process transport (7d): the reference server as a device reaches it, signed identity and all, with errors as the wire shows them.
export function referenceTransport(server: SyncServer, deviceId: () => string | null): Transport {
  const call = async <T>(f: (id: string) => Promise<T>): Promise<T> => {
    const id = deviceId();
    if (!id) throw new TransportError(401, 'DEVICE_NOT_REGISTERED');
    try {
      return wire(await f(id));
    } catch (e) {
      if (e instanceof ServerError) throw new TransportError(e.status, e.code, e.message);
      throw e;
    }
  };
  return {
    push: (r) => call((id) => server.push(id, wire(r))),
    pull: (q) => call((id) => server.pull(id, q)),
    bootstrap: (r) => call((id) => server.bootstrap(id, r)),
    snapshot: (s) => call((id) => server.snapshot(id, s)),
  };
}

export interface BundleFetchLog { ranges: (string | null)[] }

// S3 in miniature: the bundle URL served from the reference server, honouring Range; `cutAfter` stalls a download after
// that many bytes for good, as a process killed mid-download would leave it.
export function bundleFetch(cloud: ReferenceServer, log: BundleFetchLog = { ranges: [] }, cutAfter?: number): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const range = (init?.headers as Record<string, string> | undefined)?.Range ?? null;
    log.ranges.push(range);
    const from = range ? Number(/bytes=(\d+)-/u.exec(range)![1]) : 0;
    const object = cloud.bundleObject(url, from);
    if (object.status >= 400) return new Response(null, { status: object.status });
    const body = cutAfter === undefined ? object.body : object.body.subarray(0, Math.max(0, cutAfter - from));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(body));
        if (cutAfter === undefined) c.close();
      },
    });
    return new Response(stream, { status: object.status, headers: { 'Content-Type': 'application/gzip' } });
  }) as typeof fetch;
}

export const bundleDownloader = (cloud: ReferenceServer, log?: BundleFetchLog, cutAfter?: number) => new HttpBundleDownloader(bundleFetch(cloud, log, cutAfter));

// Adds `businessId` to this device by a hydration bundle and waits for the import and the pull after it.
export async function hydrate(app: App, businessId: string) {
  app.hydration.start(businessId);
  return app.hydration.launch({ businessId, cloudDeviceId: app.device.cloudDeviceId()! });
}

export function referenceCloud(): ReferenceServer {
  const cloud = new ReferenceServer();
  cloud.addMember(USER_ID, ORG_ID);
  cloud.registerDevice(DEVICE_A, USER_ID);
  cloud.registerDevice(DEVICE_B, USER_ID);
  return cloud;
}

export const ownerMembership = (businessId: string) => ({
  business_id: businessId, organization_id: ORG_ID, business_name: 'Sharma Store',
  permission_snapshot: { perm_ver: 1, roles: ['owner'], issued_at: new Date().toISOString(), grants: ROLE_PRESETS.owner!.map((g) => ({ permission: g.permission })) },
});

// A device's own view of the cloud's auth API: its registration id and the businesses its user belongs to.
export function deviceServer(cloudId: string, memberships: () => unknown[] = () => []): FakeServer {
  const base = defaultServer();
  return {
    ...base,
    respond: (method, path, body) => {
      if (path === '/v1/devices/register') return { status: 201, body: { id: cloudId, installation_id: (body as { installation_id: string }).installation_id, status: 'active', created_at: new Date().toISOString() } };
      if (path === '/v1/auth/login' && (body as { password: string }).password === 'correct-horse') return { status: 200, body: loginResponse({ memberships: memberships() }) };
      if (path === '/v1/auth/refresh') return { status: 200, body: { access_token: 'access.jwt.2', refresh_token: 'refresh-2', expires_in: 900 } };
      return base.respond(method, path, body);
    },
  };
}

export function syncedAppOptions(cloud: SyncServer, cloudId: string, memberships: () => unknown[] = () => []): TestAppOptions {
  return { server: deviceServer(cloudId, memberships), syncTransport: (creds) => referenceTransport(cloud, () => creds()?.deviceId ?? null), random: () => 0.5 };
}

export async function syncedDevice(cloud: SyncServer, cloudId: string, memberships: () => unknown[] = () => [], extra: TestAppOptions = {}) {
  return testApp({ ...syncedAppOptions(cloud, cloudId, memberships), ...extra });
}

// Push and pull until the outbox is empty and a pull brings nothing new, as the scheduler would over a few ticks.
export async function syncUntilQuiet(app: App, rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    const r = await app.syncEngine.run({ pull: true });
    if (!r.ran) throw new Error(`sync did not run: ${r.reason}`);
    if (r.error || r.push?.error) throw new Error(`sync failed: ${r.error ?? r.push?.error}`);
    if ((r.push?.sent ?? 0) === 0 && (r.push?.retrying ?? 0) === 0 && (r.pull?.applied ?? 0) === 0) return;
  }
  throw new Error('sync never went quiet');
}

const rows = (db: Db, sql: string, businessId: string) => db.prepare(sql).all(businessId);

// What two devices must agree on after sync: documents, stock, party balances and the Trial Balance.
export function books(db: Db, businessId: string) {
  return {
    sales: rows(db, 'SELECT id, doc_number, status, total_paise, credit_paise, settled_paise, cogs_paise FROM sale WHERE business_id = ? ORDER BY id', businessId),
    saleLines: rows(db, 'SELECT i.id, i.product_id, i.base_qty_milli, i.total_paise, i.cogs_paise FROM sale_item i JOIN sale s ON s.id = i.sale_id WHERE s.business_id = ? ORDER BY i.id', businessId),
    creditNotes: rows(db, `SELECT id, doc_number, sale_id, kind, total_paise, refund_method, refund_paise, credit_paise, allocated_paise, cost_paise, gstr1_bucket
      FROM credit_note WHERE business_id = ? ORDER BY id`, businessId),
    creditNoteLines: rows(db, 'SELECT i.id, i.sale_item_id, i.qty_milli, i.total_paise, i.cost_paise FROM credit_note_item i JOIN credit_note n ON n.id = i.credit_note_id WHERE n.business_id = ? ORDER BY i.id', businessId),
    purchases: rows(db, 'SELECT id, doc_number, status, total_paise, settled_paise FROM purchase WHERE business_id = ? ORDER BY id', businessId),
    debitNotes: rows(db, 'SELECT id, doc_number, status, total_paise, allocated_paise FROM debit_note WHERE business_id = ? ORDER BY id', businessId),
    payments: rows(db, 'SELECT id, doc_number, status, amount_paise, allocated_paise FROM payment WHERE business_id = ? ORDER BY id', businessId),
    expenses: rows(db, 'SELECT id, doc_number, status, total_paise, settled_paise FROM expense WHERE business_id = ? ORDER BY id', businessId),
    writeOffs: rows(db, 'SELECT id, amount_paise, allocated_paise FROM write_off WHERE business_id = ? ORDER BY id', businessId),
    openings: rows(db, 'SELECT id, status, amount_paise, allocated_paise, settled_paise FROM party_opening WHERE business_id = ? ORDER BY id', businessId),
    allocations: rows(db, 'SELECT id, source_id, target_id, amount_paise, allocated_on, voided_on FROM allocation WHERE business_id = ? ORDER BY id', businessId),
    movements: rows(db, 'SELECT id, product_id, signed_qty_milli, value_paise, unit_cost_paise FROM stock_movement WHERE business_id = ? ORDER BY id', businessId),
    stock: rows(db, 'SELECT product_id, SUM(qty_milli) AS qty, SUM(value_paise) AS value FROM stock_level WHERE business_id = ? GROUP BY product_id ORDER BY product_id', businessId),
    partyBalances: rows(db, 'SELECT party_type, party_id, SUM(amount_paise) AS balance FROM party_ledger_entry WHERE business_id = ? GROUP BY party_type, party_id ORDER BY party_id', businessId),
    journals: rows(db, 'SELECT id, entry_no, entry_date, source, debit_total_paise, late_posting FROM journal_entry WHERE business_id = ? ORDER BY id', businessId),
    trialBalance: rows(db, `SELECT a.code, SUM(l.debit_paise) AS debit, SUM(l.credit_paise) AS credit FROM journal_line l JOIN account a ON a.id = l.account_id
      WHERE l.business_id = ? GROUP BY a.code ORDER BY a.code`, businessId),
    periods: rows(db, 'SELECT period_start, status FROM accounting_period WHERE business_id = ? ORDER BY period_start', businessId),
  };
}

export function healthy(db: Db, businessId: string) {
  const parties = reconcilePartiesDb(db, businessId);
  return { tieOuts: tieOutFailures(db, businessId), replay: replayCheck(db, businessId), partyMismatches: parties.mismatches, allocationFaults: parties.faults };
}
