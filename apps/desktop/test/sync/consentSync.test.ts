import { describe, expect, it } from 'vitest';
import type { ReferenceServer } from '@muneem/sync-reference';
import { caller, ownerAtTill } from '../helpers.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';
import type { App } from '../../src/main/app.js';

async function twoDevices(cloud: ReferenceServer) {
  const a = await syncedDevice(cloud, DEVICE_A);
  const { businessId, branchId } = await ownerAtTill(a.app);
  const ravi = a.app.customers.create({ name: 'Ravi Kumar', phone: '9876543210', email: 'ravi@example.in', city: 'Delhi' });
  await syncUntilQuiet(a.app);
  const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
  await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
  await syncUntilQuiet(b.app);
  const t2 = await caller(b.app).data<{ id: string }>('business.createTerminal', { branchId, code: 'T02', name: 'Till 2' });
  await caller(b.app).data('business.selectTerminal', { terminalId: t2.id });
  await syncUntilQuiet(b.app);
  return { a: a.app, b: b.app, ravi };
}

const settle = async (...apps: App[]) => { for (const app of [...apps, ...apps]) await syncUntilQuiet(app); };

describe('DPDP consent and erasure over sync (8h, ADR-0050)', () => {
  it('a consent given and withdrawn on one device reaches the other with the customer', async () => {
    const cloud = referenceCloud();
    const { a, b, ravi } = await twoDevices(cloud);
    const given = a.customerPrivacy.setConsent({ customerId: ravi.id, purpose: 'payment_reminders', channel: 'whatsapp', method: 'in_person' });
    await settle(a, b);
    expect(b.customers.get(ravi.id).consents).toEqual(given.consents);

    const withdrawn = a.customerPrivacy.withdrawConsent({ customerId: ravi.id, consentId: given.consents![0]!.id });
    await settle(a, b);
    expect(b.customers.get(ravi.id).consents).toEqual(withdrawn.consents);
    expect(b.customers.get(ravi.id).consents![0]!.withdrawnAt).toEqual(expect.any(String));
  });

  it('an erasure reaches the other device, and an edit it made before hearing of it cannot bring the profile back', async () => {
    const cloud = referenceCloud();
    const { a, b, ravi } = await twoDevices(cloud);
    b.customerPrivacy.setConsent({ customerId: ravi.id, purpose: 'payment_reminders', channel: 'sms', method: 'phone' });
    await settle(b, a);
    const current = a.customers.get(ravi.id);
    const erased = a.customerPrivacy.erase({ customerId: ravi.id, version: current.version, reason: 'customer asked' });
    await syncUntilQuiet(a);
    const stale = b.customers.get(ravi.id);
    b.customers.update({ id: ravi.id, version: stale.version, name: 'Ravi K', phone: '9876500000', email: 'new@example.in' });
    await settle(b, a);
    for (const app of [a, b]) {
      const c = app.customers.get(ravi.id);
      expect(c).toMatchObject({ name: erased.name, erasedAt: erased.erasedAt });
      expect([c.phone, c.email, c.city]).toEqual([undefined, undefined, undefined]);
      expect(c.consents!.every((x) => x.withdrawnAt !== null)).toBe(true);
    }
    const review = await caller(a).data<{ field: string | null; winner: string }[]>('sync.listReviewItems', { status: 'all' });
    expect(review).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'erasedAt', winner: 'cloud' })]));
  });
});
