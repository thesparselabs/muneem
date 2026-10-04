import { expect, type Locator, type Page } from '@playwright/test';
import { OWNER } from './stubCloud.js';

type Credentials = { identifier: string; password: string };

export async function go(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
}

export async function signIn(page: Page, button = 'Sign in', user: Credentials = OWNER): Promise<void> {
  await page.getByLabel('Mobile or email').fill(user.identifier);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: button, exact: true }).click();
}

export async function firstRunSetup(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Your business' })).toBeVisible();
  await page.getByLabel('Business name').fill('Sharma Kirana');
  await page.getByLabel('City').fill('Delhi');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'First branch (store)' })).toBeVisible();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'This computer’s till (terminal)' })).toBeVisible();
  await page.getByRole('button', { name: 'Create terminal' }).click();
  await page.getByRole('button', { name: 'Use this terminal' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

export interface NewProduct { name: string; sku: string; barcode?: string; price: string; purchase?: string; gst?: string }

export async function createProduct(page: Page, p: NewProduct): Promise<void> {
  await go(page, '/products/new');
  await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(p.name);
  await page.getByLabel('SKU / item code').fill(p.sku);
  if (p.gst) await page.getByLabel('GST rate').selectOption({ label: p.gst });
  await page.getByLabel('Selling price (₹)').fill(p.price);
  if (p.purchase) await page.getByLabel('Purchase price (₹)').fill(p.purchase);
  if (p.barcode) {
    await page.getByRole('button', { name: 'Add barcode' }).click();
    await page.getByLabel('Barcode 1').fill(p.barcode);
  }
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByRole('heading', { level: 1, name: p.name })).toBeVisible();
}

export async function pick(page: Page, field: string, query: string, option: string | RegExp): Promise<void> {
  await page.getByLabel(field, { exact: true }).fill(query);
  await page.getByRole('button', { name: option }).first().click();
}

// A scanner is a keyboard that types a burst and presses Enter within LLD §13's gaps.
export async function scan(page: Page, code: string): Promise<void> {
  await page.keyboard.type(code);
  await page.keyboard.press('Enter');
}

export async function openingStock(page: Page, lines: readonly (readonly [sku: string, name: string])[]): Promise<void> {
  await go(page, '/inventory/opening');
  for (const [sku, name] of lines) {
    await pick(page, 'Add a product', sku, new RegExp(name));
    await page.getByLabel(`Quantity of ${name} (PCS)`).fill('50');
    await page.getByLabel(`Unit cost of ${name}`).fill('20');
  }
  await page.getByRole('button', { name: 'Save opening stock' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
}

// Keyboard reachability (NFR-023): Tab forward until the target has focus, failing if it never does.
export async function tabTo(page: Page, target: Locator, maxPresses = 60): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

export function amountIn(text: string | null): string {
  const m = /₹\s?([\d,]+\.\d{2})/u.exec(text ?? '');
  if (!m) throw new Error(`no amount in "${text}"`);
  return m[1]!.replace(/,/gu, '');
}
