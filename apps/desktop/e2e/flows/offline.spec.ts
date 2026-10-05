import { expect, test, type Page } from '@playwright/test';
import { fitsAndSnap, launchMuneem, printed, savedDocNumber, type Muneem } from '../support/muneem.js';
import { createProduct, firstRunSetup, go, openingStock, scan, signIn } from '../support/steps.js';

const CONNECTIVITY_PROBE_MS = 45_000;

// Stage 3 / 7g: the cloud goes away mid-day, billing carries on, sign-in works offline, and the queue drains on return.
test.describe.serial('offline billing', () => {
  let m: Muneem;
  let page: Page;
  const badge = () => page.getByRole('banner').getByRole('button', { name: /Synced|waiting|Syncing|Not synced|Offline|retrying|Needs attention/u });

  async function sell(): Promise<string> {
    await page.keyboard.press('F2');
    await scan(page, '8901262010016');
    await expect(page.getByRole('cell', { name: 'Amul Butter 100g', exact: true })).toBeVisible();
    await page.keyboard.press('F5');
    await expect(page.getByRole('dialog', { name: /Payment \(F5\)/ }).getByLabel('Cash')).toBeFocused();
    await page.keyboard.press('Enter');
    const saved = page.getByRole('status').filter({ hasText: /^Saved / });
    await expect(saved).toBeVisible();
    return savedDocNumber(await saved.textContent());
  }

  test.beforeAll(async () => {
    m = await launchMuneem();
    page = m.page;
    await signIn(page);
    await firstRunSetup(page);
    await createProduct(page, { name: 'Amul Butter 100g', sku: 'BUTTER100', barcode: '8901262010016', price: '60', gst: '12%' });
    await openingStock(page, [['BUTTER100', 'Amul Butter 100g']]);
    await go(page, '/pos');
    await page.getByLabel('Opening cash (₹)').fill('0');
    await page.keyboard.press('Enter');
  });
  test.afterAll(async () => { await m?.close(); });

  test('online: a sale syncs', async () => {
    await printed(m, await sell());
    await expect(badge()).toHaveText(/✓ Synced/u, { timeout: 30_000 });
  });

  test('offline: the badge says so and billing carries on', async () => {
    m.cloud.setOnline(false);
    await expect(page.getByText('● Offline')).toBeVisible({ timeout: CONNECTIVITY_PROBE_MS });
    const bill = await sell();
    await printed(m, bill);
    await expect(badge()).toHaveText(/⚠ \d+ waiting · offline/u, { timeout: 30_000 });
    await fitsAndSnap(page, 'offline-pos');
  });

  test('offline: sign out and back in with saved credentials', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByText('Offline — using saved sign-in')).toBeVisible();
    await signIn(page, 'Sign in offline');
    await expect(page.getByText(/\(offline, \d+d left\)/u)).toBeVisible();
  });

  test('back online: the queue drains to Synced', async () => {
    m.cloud.setOnline(true);
    await expect(page.getByText('● Online')).toBeVisible({ timeout: CONNECTIVITY_PROBE_MS });
    await go(page, '/diagnostics');
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(badge()).toHaveText(/✓ Synced/u, { timeout: 30_000 });
  });
});
