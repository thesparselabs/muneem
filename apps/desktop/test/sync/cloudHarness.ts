import { vi } from 'vitest';
import type { Db } from '@muneem/db-sqlite';
import { FaultInjector, type ReferenceServer } from '@muneem/sync-reference';
import type { App } from '../../src/main/app.js';
import type { RestoreHost } from '../../src/main/backups/index.js';
import { MemorySecretStore } from '../../src/main/infra/secrets.js';
import { caller, ownerAtTill, USER_ID, type FakeServer } from '../helpers.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedDevice } from './syncHelpers.js';

export const DEVICE_C = '01J0000000000000000000DEVC';

export interface FaultRates { drop?: number; dropResponse?: number; duplicate?: number; error500?: number; reorder?: number }

export interface Network {
  partition(on: boolean): void;
  faults(rates: FaultRates): void;
  injected(): number;
}

export interface DeviceHandle { app: App; db: Db; dir: string }

// What a sync scenario needs from "the cloud": devices that reach it, a network to break, and the cloud's own view of a business.
export interface CloudHarness {
  readonly clock: Clock;
  readonly net: Network;
  device(slot: string, opts?: { file?: boolean; dbFile?: string; restoreHost?: RestoreHost }): Promise<DeviceHandle>;
  login(app: App): Promise<void>;
  ownerAtTill(app: App): Promise<{ businessId: string }>;
  cloudSales(businessId: string): Promise<number>;
  deadLetters(businessId: string): Promise<readonly unknown[]>;
  trialBalance(businessId: string): Promise<readonly unknown[] | null>;
  auditChains(businessId: string): Promise<Record<string, number>>;
}

const SAFE_DRIFT_MS = 4 * 60_000;

// The device clock under fake Date. Against a real server it never strays far from real time, since signed requests allow 5 minutes of skew.
export class Clock {
  private offset = 0;
  private current: number;

  constructor(start: number, private readonly real: boolean) {
    this.current = start;
    vi.setSystemTime(start);
  }

  now(): number { return this.current; }

  tick(ms = 2000): void {
    this.set(this.real ? Math.max(this.current + ms, vi.getRealSystemTime() + this.offset) : this.current + ms);
  }

  jump(ms: number): void {
    this.offset += ms;
    this.set(this.current + ms);
  }

  // The clock is set right again (a real server refuses a skewed device).
  reconnect(): void {
    if (!this.real) return;
    const real = vi.getRealSystemTime();
    this.offset = 0;
    this.set(Math.abs(this.current - real) < SAFE_DRIFT_MS ? Math.max(this.current, real) : real);
  }

  // Time passes for backoffs to expire.
  idle(ms: number): void {
    if (this.real) this.reconnect();
    else this.tick(ms);
  }

  private set(ms: number): void {
    this.current = ms;
    vi.setSystemTime(ms);
  }
}

// One OS keychain per device slot: the device key and tokens survive a restart, as they do on a real machine.
export function keychains(): (slot: string) => MemorySecretStore {
  const stores = new Map<string, MemorySecretStore>();
  return (slot) => stores.get(slot) ?? stores.set(slot, new MemorySecretStore()).get(slot)!;
}

const REFERENCE_IDS: Record<string, string> = { A: DEVICE_A, B: DEVICE_B, C: DEVICE_C };
const REFERENCE_LOGIN = { identifier: '9999999999', password: 'correct-horse' };

export interface ReferenceHarness extends CloudHarness { readonly server: ReferenceServer; readonly injector: FaultInjector }

// The in-memory reference server behind the seeded fault injector (ADR-0042).
export function referenceHarness(seed: number, start: number): ReferenceHarness {
  const server = referenceCloud();
  server.registerDevice(DEVICE_C, USER_ID);
  const injector = new FaultInjector(server, { seed }, () => Promise.resolve());
  const authServers: FakeServer[] = [];
  let partitioned = false;
  let businessId: string | null = null;
  const memberships = () => (businessId ? [ownerMembership(businessId)] : []);
  const secrets = keychains();
  const net: Network = {
    partition: (on) => { partitioned = on; injector.partition(on); for (const s of authServers) s.online = !on; },
    faults: (rates) => injector.configure({ drop: 0, dropResponse: 0, duplicate: 0, error500: 0, reorder: 0, ...rates }),
    injected: () => injector.events.filter((e) => e.fault !== 'delivered').length,
  };
  return {
    server, injector, net, clock: new Clock(start, false),
    device: async (slot, opts = {}) => {
      const d = await syncedDevice(injector, REFERENCE_IDS[slot]!, memberships, { ...opts, secrets: secrets(slot) });
      d.server.online = !partitioned;
      authServers.push(d.server);
      return d;
    },
    login: async (app) => { await caller(app).data('auth.login', REFERENCE_LOGIN); },
    ownerAtTill: async (app) => {
      const r = await ownerAtTill(app, REFERENCE_LOGIN);
      businessId = r.businessId;
      return r;
    },
    cloudSales: (id) => Promise.resolve([...server.business(id)!.entities.values()].filter((e) => e.entityType === 'sale').length),
    deadLetters: (id) => Promise.resolve(server.deadLetters(id)),
    trialBalance: () => Promise.resolve(null),
    auditChains: (id) => {
      const audit = server.business(id)!.audit;
      return Promise.resolve(Object.fromEntries(audit.devices().map((d) => [d, audit.chain(d).length])));
    },
  };
}
