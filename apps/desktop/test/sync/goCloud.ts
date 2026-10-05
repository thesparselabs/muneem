import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { vi } from 'vitest';
import { Prng } from '../soak/generator.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';
import { Clock, keychains, type CloudHarness, type FaultRates, type Network } from './cloudHarness.js';

export const E2E_CLOUD = process.env.MUNEEM_E2E_CLOUD ?? '';
const E2E_DATABASE_URL = process.env.MUNEEM_E2E_DATABASE_URL ?? 'postgres://muneem:muneem@localhost:5433/muneem_e2e?sslmode=disable';

const networkError = (why: string) => new TypeError(`fetch failed: ${why}`);
const pathOf = (input: string | URL | Request) => new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname;

// The network between the devices and the real API: a partition fails every call; seeded faults hit only sync calls.
export class FaultyFetch implements Network {
  private partitioned = false;
  private rates: FaultRates = {};
  private count = 0;

  constructor(private readonly rng: Prng, private readonly inner: typeof fetch = globalThis.fetch) {}

  partition(on: boolean): void { this.partitioned = on; }
  faults(rates: FaultRates): void { this.rates = rates; }
  injected(): number { return this.count; }

  readonly fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (this.partitioned) throw networkError('partitioned');
    if (!pathOf(input).includes('/sync/')) return this.inner(input, init);
    if (this.roll(this.rates.drop)) throw networkError('request lost');
    if (this.roll(this.rates.error500)) return Response.json({ error: { code: 'INTERNAL', class: 'permanent', message: 'internal error' } }, { status: 500 });
    if (this.roll(this.rates.duplicate)) await (await this.inner(input, init)).arrayBuffer();
    const res = await this.inner(input, init);
    if (res.ok && this.roll(this.rates.dropResponse)) {
      await res.arrayBuffer();
      throw networkError('response lost');
    }
    return res;
  }) as typeof fetch;

  private roll(rate: number | undefined): boolean {
    const hit = !!rate && this.rng.chance(rate);
    if (hit) this.count++;
    return hit;
  }
}

// Read-only checks straight from the cloud's Postgres (psql, so the tests need no driver).
export function cloudQuery<T>(sql: string, businessId: string): T {
  const out = execFileSync('psql', [E2E_DATABASE_URL, '-AtqX', '-v', 'ON_ERROR_STOP=1', '-v', `bid=${businessId}`], { input: sql, encoding: 'utf8' });
  return JSON.parse(out.trim()) as T;
}

const SALES = "SELECT count(*) FROM entity_state WHERE business_id = :'bid' AND entity_type = 'sale';";
const DEAD_LETTERS = `SELECT coalesce(json_agg(json_build_object('entityType', entity_type, 'code', error_code, 'detail', error_detail) ORDER BY id), '[]')
  FROM dead_letter WHERE business_id = :'bid';`;
const AUDIT_CHAINS = "SELECT coalesce(json_object_agg(device_id, n), '{}') FROM (SELECT device_id, count(*) AS n FROM audit_entry WHERE business_id = :'bid' GROUP BY device_id) c;";
// The cloud Trial Balance from its typed journal projection, shaped like books().trialBalance; a role line takes its code from the cloud's own chart.
const TRIAL_BALANCE = `SELECT coalesce(json_agg(t ORDER BY t.code), '[]') FROM (
  SELECT coalesce(l.account_code, a.payload->>'code') AS code, sum(l.debit_paise) AS debit, sum(l.credit_paise) AS credit
  FROM journal_line l LEFT JOIN entity_state a ON a.business_id = l.business_id AND a.entity_type = 'account' AND a.deleted_at IS NULL AND a.payload->>'role' = l.account_role
  WHERE l.business_id = :'bid' GROUP BY 1) t;`;

async function registerOwner(base: string): Promise<{ identifier: string; password: string }> {
  const identifier = `9${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`;
  const password = 'correct-horse-e2e';
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'E2E Owner', identifier, password }),
  });
  if (res.status !== 201) throw new Error(`register ${identifier}: HTTP ${res.status} ${await res.text()}`);
  return { identifier, password };
}

// The real Go API (MUNEEM_E2E_CLOUD) with a freshly registered owner, so reruns never collide.
export async function goHarness(base: string, seed: number): Promise<CloudHarness> {
  const owner = await registerOwner(base);
  const net = new FaultyFetch(new Prng(seed));
  const secrets = keychains();
  return {
    net, clock: new Clock(vi.getRealSystemTime(), true),
    device: (slot, opts = {}) => testApp({ ...opts, fetch: net.fetch, apiBaseUrl: base, secrets: secrets(slot), random: () => 0.5 }),
    login: async (app) => { await caller(app).data('auth.login', owner); },
    ownerAtTill: (app) => ownerAtTill(app, owner),
    cloudSales: (id) => Promise.resolve(cloudQuery<number>(SALES, id)),
    deadLetters: (id) => Promise.resolve(cloudQuery<unknown[]>(DEAD_LETTERS, id)),
    trialBalance: (id) => Promise.resolve(cloudQuery<unknown[]>(TRIAL_BALANCE, id)),
    auditChains: (id) => Promise.resolve(cloudQuery<Record<string, number>>(AUDIT_CHAINS, id)),
  };
}
