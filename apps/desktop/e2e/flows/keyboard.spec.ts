import { expect, test, type Page } from '@playwright/test';
import { launchMuneem, printed, type Muneem } from '../support/muneem.js';
import { createProduct, firstRunSetup, go, openingStock, scan, signIn, tabTo } from '../support/steps.js';

// LLD testing table: the keyboard-only POS run (F2…F9) is a first-class test. After setup, no mouse is used.
test.describe.serial('POS without a mouse', () => {
  let m: Muneem;
  let page: Page;
  const status = () => page.getByRole('status');
  const cell = (name: string) => page.getByRole('cell', { name, exact: true });

  test.beforeAll(async () => {
    m = await launchMuneem();
    page = m.page;
    await signIn(page);
    await firstRunSetup(page);
    await createProduct(page, { name: 'Amul Butter 100g', sku: 'BUTTER100', barcode: '8901262010016', price: '60', gst: '12%' });
    await createProduct(page, { name: 'Basmati Rice 1kg', sku: 'RICE1', barcode: '8906000000011', price: '120', gst: '5%' });
    await openingStock(page, [['BUTTER100', 'Amul Butter 100g'], ['RICE1', 'Basmati Rice 1kg']]);
    await go(page, '/pos');
  });
  test.afterAll(async () => { await m?.close(); });

  test('open the register', async () => {
    await expect(page.getByLabel('Opening cash (₹)')).toBeFocused();
    await page.keyboard.type('500');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Scan or search a product (F2)')).toBeFocused();
  });

  test('F2 search by name then Enter adds the first match; a scan adds by barcode', async () => {
    await page.keyboard.press('F2');
    await page.keyboard.type('basm', { delay: 80 });
    await expect(page.getByRole('button', { name: /Basmati Rice 1kg/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(cell('Basmati Rice 1kg')).toBeVisible();
    await scan(page, '8901262010016');
    await expect(cell('Amul Butter 100g')).toBeVisible();
  });

  test('Tab reaches a line quantity, its discount and its Remove', async () => {
    const qty = page.getByLabel('Quantity').first();
    await tabTo(page, qty);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await expect(qty).toHaveValue('3');

    await tabTo(page, page.getByRole('row').filter({ hasText: 'Basmati Rice 1kg' }).getByRole('button', { name: 'Add' }));
    await page.keyboard.press('Enter');
    const line = page.getByRole('dialog', { name: 'Line discount' });
    await expect(line.getByRole('textbox')).toBeFocused();
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await expect(line).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: 'Basmati Rice 1kg' }).getByRole('button', { name: '₹5.00' })).toBeVisible();

    await tabTo(page, page.getByRole('button', { name: 'Remove Amul Butter 100g' }));
    await page.keyboard.press('Enter');
    await expect(cell('Amul Butter 100g')).toBeHidden();
  });

  test('F3 customer, F4 bill discount, Esc closes a dialog', async () => {
    await page.keyboard.press('F3');
    const customer = page.getByRole('dialog', { name: 'Customer (F3)' });
    await expect(customer.getByLabel('Search by name, phone or GSTIN')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(customer).toBeHidden();
    await expect(cell('Basmati Rice 1kg')).toBeVisible();

    await page.keyboard.press('F4');
    const discount = page.getByRole('dialog', { name: 'Bill discount (F4)' });
    await expect(discount.getByRole('textbox')).toBeFocused();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await expect(discount).toBeHidden();
    await expect(page.getByRole('complementary').getByText('Discount', { exact: true })).toBeVisible();
  });

  test('F6 holds, F7 then Enter recalls', async () => {
    await page.keyboard.press('F6');
    await expect(status()).toHaveText(/Bill held/);
    await page.keyboard.press('F7');
    await expect(page.getByRole('dialog', { name: 'Held bills (F7)' }).getByRole('button', { name: 'Retrieve' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(status()).toHaveText('Bill retrieved.');
    await expect(cell('Basmati Rice 1kg')).toBeVisible();
  });

  test('F5 then Enter completes the sale; F9 reprints it', async () => {
    await page.keyboard.press('F5');
    const pay = page.getByRole('dialog', { name: /Payment \(F5\)/ });
    await expect(pay.getByLabel('Cash')).toBeFocused();
    await tabTo(pay.page(), pay.getByLabel('UPI', { exact: true }));
    await page.keyboard.press('Shift+Tab');
    await expect(pay.getByLabel('Cash')).toBeFocused();
    await page.keyboard.press('Enter');
    const saved = status().filter({ hasText: /^Saved / });
    await expect(saved).toBeVisible();
    const bill = /Saved (\S+)/u.exec((await saved.textContent()) ?? '')![1]!;
    await printed(m, bill);
    await expect(page.getByLabel('Scan or search a product (F2)')).toBeFocused();

    await page.keyboard.press('F9');
    await expect(status()).toHaveText(`Reprinting ${bill}`);
  });

  test('Esc clears a cart', async () => {
    await scan(page, '8901262010016');
    await expect(cell('Amul Butter 100g')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(status()).toHaveText('Cart cleared');
  });

  test('cash in/out, X report and close register are reachable by Tab', async () => {
    await tabTo(page, page.getByRole('button', { name: 'Cash in/out' }));
    await page.keyboard.press('Enter');
    const cash = page.getByRole('dialog', { name: 'Cash in / out' });
    await expect(cash.getByLabel('Amount (₹)')).toBeFocused();
    await page.keyboard.type('50');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Tea for staff');
    await page.keyboard.press('Enter');
    await expect(cash).toBeHidden();

    await tabTo(page, page.getByRole('button', { name: 'X report' }));
    await page.keyboard.press('Enter');
    const x = page.getByRole('dialog', { name: 'X report' });
    await expect(x.getByText('Cash out')).toBeVisible();
    await page.keyboard.press('Escape');

    await tabTo(page, page.getByRole('button', { name: 'Close register' }));
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Counted cash (₹)')).toBeFocused();
    await page.keyboard.type('650');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Z report #1')).toBeVisible();
    await tabTo(page, page.getByRole('button', { name: 'Done' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Open the register' })).toBeVisible();
  });
});
