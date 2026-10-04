import { getBusiness, getHydration, type Db } from '@muneem/db-sqlite';

// How a device first gets a business it does not hold: by a hydration bundle (the app), or by pulling every stream (tests, 7e).
export type ColdStart = 'hydrate' | 'pull';

// FR-086: a business is held while it is being imported, or not on this device yet. Billing, seeding and sync wait for it.
export class HydrationGate {
  constructor(private readonly db: () => Db, private readonly coldStart: ColdStart) {}

  holds(businessId: string): boolean {
    const h = getHydration(this.db(), businessId);
    if (h) return h.status !== 'ready';
    return this.coldStart === 'hydrate' && !getBusiness(this.db(), businessId);
  }
}
