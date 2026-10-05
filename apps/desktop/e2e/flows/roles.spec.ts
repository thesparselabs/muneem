import { expect, test, type Page } from '@playwright/test';
import { launchMuneem, type Muneem } from '../support/muneem.js';
import { createProduct, firstRunSetup, go, openingStock, scan, signIn } from '../support/steps.js';
import { CASHIER } from '../support/stubCloud.js';

// Stage 2 / 5f / 6e / 8: what a cashier sees and may do on the owner's till.
test.describe.serial('a cashier on the owner’s till', () => {
  let m: Muneem;
  let page: Page;
  const menu = () => page.getByRole('navigation', { name: 'Main' });

  test.beforeAll(async () => {
    m = await launchMuneem();
    page = m.page;
    await signIn(page);
    await firstRunSetup(page);
    await createProduct(page, { name: 'Amul Butter 100g', sku: 'BUTTER100', barcode: '8901262010016', price: '60', gst: '12%' });
    await openingStock(page, [['BUTTER100', 'Amul Butter 100g']]);
    await expect(page.getByRole('banner').getByRole('button', { name: /✓ Synced/u })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'Sign in', CASHIER);
    await expect(page.getByRole('banner').getByText(CASHIER.name)).toBeVisible();
  });
  test.afterAll(async () => { await m?.close(); });

  test('the menu hides purchases, expenses, accounts and GST', async () => {
    for (const hidden of ['Purchases', 'Expenses', 'Accounts', 'GST', 'Reports']) await expect(menu().getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
    for (const shown of ['POS · Billing', 'Parties', 'Payments', 'Products']) await expect(menu().getByRole('link', { name: shown, exact: true })).toBeVisible();
  });

  test('parties shows customers only', async () => {
    await go(page, '/parties');
    await expect(page.getByRole('tab', { name: 'Customers' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Suppliers' })).toHaveCount(0);
  });

  test('creating a product is refused', async () => {
    await go(page, '/products/new');
    await page.getByLabel('Name', { exact: true }).fill('Not allowed');
    await page.getByLabel('Selling price (₹)').fill('10');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByRole('status')).toHaveText(/permission|not allowed|denied/iu);
  });

  test('a bill discount above the role’s limit is refused at the till', async () => {
    await go(page, '/pos');
    await page.getByLabel('Opening cash (₹)').fill('0');
    await page.keyboard.press('Enter');
    await scan(page, '8901262010016');
    await page.keyboard.press('F4');
    await page.getByRole('radio', { name: 'Percent' }).check();
    await page.getByRole('dialog', { name: 'Bill discount (F4)' }).getByRole('textbox').fill('20');
    await page.keyboard.press('Enter');
    await page.keyboard.press('F5');
    const pay = page.getByRole('dialog', { name: /Payment \(F5\)/ });
    await expect(pay.getByLabel('Cash')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText(/discount/iu);
    await expect(page.getByRole('cell', { name: 'Amul Butter 100g', exact: true })).toBeVisible();
  });
});
