import { InvoiceBranding } from '@muneem/contracts';
import { getSetting, setSetting, type Actor, type Db } from '@muneem/db-sqlite';

const KEY = 'invoice.branding';

export interface BrandingDeps { db: () => Db; businessId: () => string; actor: () => Actor }

// Business-scoped so a shop's logo, accent and notes follow it to every till (setting table syncs; ADR-0015 printer config does not).
export class InvoiceBrandingStore {
  constructor(private readonly d: BrandingDeps) {}

  get(): InvoiceBranding {
    const parsed = InvoiceBranding.safeParse(getSetting(this.d.db(), this.d.businessId(), KEY) ?? {});
    return parsed.success ? parsed.data : InvoiceBranding.parse({});
  }

  set(input: InvoiceBranding): InvoiceBranding {
    const value = InvoiceBranding.parse(input);
    setSetting(this.d.db(), this.d.businessId(), KEY, value, this.d.actor());
    return value;
  }
}
