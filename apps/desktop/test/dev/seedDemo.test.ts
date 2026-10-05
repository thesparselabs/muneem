import { describe, expect, it } from 'vitest';
import { ownerAtTill, testApp } from '../helpers.js';
import { seedDemo } from '../../src/main/services/dev/seedDemo.js';

describe('demo seed', () => {
  it('populates a business through the real services with no errors', async () => {
    const { app } = await testApp();
    await ownerAtTill(app);

    const r = seedDemo(app, '2026-10-05');

    expect(r.errors).toEqual([]);
    expect(r.products).toBeGreaterThanOrEqual(15);
    expect(r.parties).toBeGreaterThanOrEqual(8);
    expect(r.sales).toBeGreaterThanOrEqual(25);
    expect(r.purchases).toBeGreaterThanOrEqual(3);
    expect(r.payments).toBeGreaterThanOrEqual(3);
    expect(r.expenses).toBeGreaterThanOrEqual(5);
    expect(r.returns + r.adjustments + r.journals).toBeGreaterThan(0);
  });
});
