import type { CustomerConsent } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

type ConsentRow = {
  id: string; purpose: CustomerConsent['purpose']; channel: CustomerConsent['channel']; method: CustomerConsent['method']; given_at: string;
  withdrawn_at: string | null; captured_by: string;
};

export function listConsents(db: Db, customerId: string): CustomerConsent[] {
  return (stmt(db, 'SELECT * FROM customer_consent WHERE customer_id = ? ORDER BY given_at, id').all(customerId) as ConsentRow[]).map((r) => ({
    id: r.id, purpose: r.purpose, channel: r.channel, method: r.method, givenAt: r.given_at, withdrawnAt: r.withdrawn_at, capturedBy: r.captured_by,
  }));
}

// Pulled consents are merged by id, never removed, and a withdrawal once recorded is never undone (ADR-0050).
export function mergeConsents(db: Db, businessId: string, customerId: string, consents: readonly CustomerConsent[], at: string): void {
  const upsert = stmt(db, `INSERT INTO customer_consent (id, business_id, customer_id, purpose, channel, method, given_at, withdrawn_at, captured_by, created_at, updated_at)
      VALUES (@id, @businessId, @customerId, @purpose, @channel, @method, @givenAt, @withdrawnAt, @capturedBy, @at, @at)
    ON CONFLICT(id) DO UPDATE SET withdrawn_at = COALESCE(customer_consent.withdrawn_at, excluded.withdrawn_at), updated_at = excluded.updated_at
      WHERE customer_consent.withdrawn_at IS NULL AND excluded.withdrawn_at IS NOT NULL`);
  for (const c of consents) upsert.run({ ...c, businessId, customerId, at });
}
