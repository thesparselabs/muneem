import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fitsAndSnap, launchMuneem, printed, savedDocNumber, stubSaveDialog, type Muneem } from '../support/muneem.js';
import { amountIn, createProduct, firstRunSetup, go, openingStock, pick, scan, signIn } from '../support/steps.js';

const IMPORT_CSV = [
  'Item Name,SKU,Barcode,Sale Price,GST %,Unit',
  'Tata Salt 1kg,SALT1,8901058000017,28,5,PCS',
  'Parle-G 100g,PARLEG,8901719100017,10,18,PCS',
  'नमकीन मिक्स,NAMKEEN,8900000000031,55,12,PCS',
].join('\n');

test.describe.serial('golden flow', () => {
  let m: Muneem;
  let page: Page;
  let firstBill = '';
  let creditOwed = '';
  test.beforeAll(async () => { m = await launchMuneem(); page = m.page; });
  test.afterAll(async () => { await m?.close(); });

  test('first-run setup: sign in, business, branch, terminal', async () => {
    await fitsAndSnap(page, '01-login');
    await signIn(page);
    await fitsAndSnap(page, '02-setup');
    await firstRunSetup(page);
    await expect(page.getByText('Terminal T01')).toBeVisible();
    await fitsAndSnap(page, '03-home');
  });

  test('catalog: products with barcodes and a CSV import', async () => {
    await createProduct(page, { name: 'Amul Butter 100g', sku: 'BUTTER100', barcode: '8901262010016', price: '60', purchase: '50', gst: '12%' });
    await createProduct(page, { name: 'Basmati Rice 1kg', sku: 'RICE1', barcode: '8906000000011', price: '120', purchase: '95', gst: '5%' });
    await fitsAndSnap(page, '04-product-edit');

    await go(page, '/products/import');
    await page.locator('#import-file').setInputFiles({ name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from(IMPORT_CSV) });
    await expect(page.getByRole('heading', { name: /Match columns/ })).toBeVisible();
    await fitsAndSnap(page, '05-import-preview');
    await page.getByRole('button', { name: 'Import 3 products' }).click();
    await expect(page.getByRole('status').filter({ hasText: '3 products added' })).toBeVisible();

    await go(page, '/products');
    await page.getByLabel(/Search by name, SKU, barcode/).fill('8901262010016');
    await expect(page.getByRole('link', { name: 'Amul Butter 100g' })).toBeVisible();
    await page.getByLabel(/Search by name, SKU, barcode/).fill('नमकीन');
    await expect(page.getByRole('link', { name: 'नमकीन मिक्स' })).toBeVisible();
    await page.getByLabel(/Search by name, SKU, barcode/).fill('bas');
    await expect(page.getByRole('link', { name: 'Basmati Rice 1kg' })).toBeVisible();
    await fitsAndSnap(page, '06-products');
  });

  test('opening stock', async () => {
    await openingStock(page, [['BUTTER100', 'Amul Butter 100g'], ['RICE1', 'Basmati Rice 1kg'], ['SALT1', 'Tata Salt 1kg']]);
    await fitsAndSnap(page, '07-inventory');
  });

  test('POS golden flow, keyboard only: scan, quantity, discount, pay, receipt', async () => {
    await go(page, '/pos');
    await page.getByLabel('Opening cash (₹)').fill('1000');
    await page.keyboard.press('Enter');
    const search = page.getByLabel('Scan or search a product (F2)');
    await expect(search).toBeFocused();
    await fitsAndSnap(page, '08-pos-empty');

    await scan(page, '8901262010016');
    await expect(page.getByRole('cell', { name: 'Amul Butter 100g', exact: true })).toBeVisible();
    await scan(page, '8906000000011');
    await expect(page.getByRole('cell', { name: 'Basmati Rice 1kg', exact: true })).toBeVisible();

    await page.getByLabel('Quantity').first().focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await page.keyboard.press('F2');
    await expect(search).toBeFocused();

    await page.keyboard.press('F4');
    const discount = page.getByRole('dialog', { name: 'Bill discount (F4)' });
    await expect(discount).toBeVisible();
    await discount.getByRole('textbox', { name: 'Amount (₹)' }).focus();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await expect(discount).toBeHidden();
    await expect(page.getByRole('complementary').getByText('Discount', { exact: true })).toBeVisible();
    await fitsAndSnap(page, '09-pos-cart');

    await page.keyboard.press('F5');
    const pay = page.getByRole('dialog', { name: /Payment \(F5\)/ });
    await expect(pay.getByLabel('Cash')).toBeFocused();
    await fitsAndSnap(page, '10-pos-payment');
    await page.keyboard.press('Enter');
    const saved = page.getByRole('status').filter({ hasText: /^Saved / });
    await expect(saved).toBeVisible();
    firstBill = savedDocNumber(await saved.textContent());
    const receipt = await printed(m, firstBill);
    expect(receipt).toContain('Amul Butter');
    expect(receipt).toContain('Basmati Rice');
  });

  test('hold and recall a bill', async () => {
    await scan(page, '8901058000017');
    await expect(page.getByRole('cell', { name: 'Tata Salt 1kg', exact: true })).toBeVisible();
    await page.keyboard.press('F6');
    await expect(page.getByRole('status')).toHaveText(/Bill held/);
    await expect(page.getByText('Scan a barcode or search to start a bill.')).toBeVisible();
    await page.keyboard.press('F7');
    const held = page.getByRole('dialog', { name: 'Held bills (F7)' });
    await expect(held.getByRole('button', { name: 'Retrieve' })).toBeFocused();
    await fitsAndSnap(page, '11-pos-held');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText('Bill retrieved.');
    await expect(page.getByRole('cell', { name: 'Tata Salt 1kg', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('status')).toHaveText('Cart cleared');
  });

  test('customer credit sale', async () => {
    await go(page, '/parties');
    await page.getByRole('button', { name: 'New customer' }).click();
    await page.getByLabel('Name').fill('Meena Traders');
    await page.getByLabel('Phone').fill('9876543210');
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Meena Traders' })).toBeVisible();
    await page.getByRole('button', { name: 'Credit limit' }).click();
    await page.getByLabel('Limit (₹)').fill('5000');
    await page.getByRole('button', { name: 'Save limit' }).click();
    await expect(page.getByText(/limit ₹\s?5,000\.00/u)).toBeVisible();
    await fitsAndSnap(page, '12-party');

    await go(page, '/pos');
    await expect(page.getByLabel('Scan or search a product (F2)')).toBeFocused();
    await page.keyboard.press('F3');
    const customer = page.getByRole('dialog', { name: 'Customer (F3)' });
    await expect(customer.getByLabel('Search by name, phone or GSTIN')).toBeFocused();
    await page.keyboard.type('Meena');
    await customer.getByRole('button', { name: /Meena Traders/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary').getByText('Meena Traders')).toBeVisible();
    await page.keyboard.press('F2');
    await scan(page, '8906000000011');
    await expect(page.getByRole('cell', { name: 'Basmati Rice 1kg', exact: true })).toBeVisible();

    await page.keyboard.press('F5');
    const pay = page.getByRole('dialog', { name: /Payment \(F5\)/ });
    const total = Number(amountIn(await pay.getAttribute('aria-label')));
    await pay.getByLabel('Cash').fill('20');
    await pay.getByLabel('Credit').fill((total - 20).toFixed(2));
    await expect(pay.getByRole('status')).toHaveText('Paid in full');
    await pay.getByLabel('Credit').press('Enter');
    const saved = page.getByRole('status').filter({ hasText: /^Saved / });
    await expect(saved).toBeVisible();
    const bill = savedDocNumber(await saved.textContent());
    expect(await printed(m, bill)).toContain('Meena Traders');
    creditOwed = (total - 20).toFixed(2);
  });

  test('a return issues a credit note', async () => {
    await go(page, '/sales');
    const row = page.getByRole('row').filter({ hasText: firstBill });
    await row.getByRole('button', { name: 'Return / Cancel' }).click();
    const dialog = page.getByRole('dialog', { name: `Return against ${firstBill}` });
    await dialog.getByLabel('Return quantity of Amul Butter 100g').fill('1');
    await dialog.getByLabel('Return quantity of Basmati Rice 1kg').fill('0');
    await dialog.getByLabel('Reason').fill('Packet torn');
    await fitsAndSnap(page, '13-return');
    await dialog.getByRole('button', { name: 'Issue credit note' }).click();
    const issued = page.getByRole('status').filter({ hasText: /^Credit note / });
    await expect(issued).toBeVisible();
    const note = /Credit note (\S+)/u.exec((await issued.textContent()) ?? '')![1]!;
    await printed(m, note);
    await expect(page.getByRole('region', { name: 'Credit notes' }).getByRole('cell', { name: firstBill })).toBeVisible();
  });

  test('receive a payment against the credit sale', async () => {
    await go(page, '/parties');
    await page.getByRole('link', { name: 'Meena Traders' }).click();
    await page.getByRole('link', { name: 'Receive payment' }).click();
    await expect(page.getByRole('heading', { name: 'Receive payment' })).toBeVisible();
    await page.getByLabel('Amount (₹)').fill(creditOwed);
    await expect(page.getByText(/Settling ₹\s?[\d,.]+ · advance ₹\s?0\.00/u)).toBeVisible();
    await fitsAndSnap(page, '14-receive-payment');
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page).toHaveURL(/#\/payments\/[0-9A-Z]{26}$/u);
  });

  test('purchase with freight', async () => {
    await go(page, '/parties');
    await page.getByRole('tab', { name: 'Suppliers' }).click();
    await page.getByRole('button', { name: 'New supplier' }).click();
    await page.getByLabel('Name').fill('Gupta Wholesale');
    await page.getByLabel('GSTIN').fill('07BBBBB0000B1Z5');
    await expect(page.getByLabel('State code')).toHaveValue('07');
    await page.getByLabel('Credit days').fill('30');
    await page.getByRole('button', { name: 'Save supplier' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gupta Wholesale' })).toBeVisible();
    await page.getByRole('button', { name: 'Opening balance' }).click();
    await page.getByLabel('Amount (₹)').fill('1000');
    await page.getByRole('button', { name: 'Save opening balance' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Opening balance' }).first()).toBeVisible();

    await go(page, '/purchases/new');
    await pick(page, 'Supplier', 'Gupta', /Gupta Wholesale/);
    await page.getByLabel('Bill number').fill('GW-101');
    await pick(page, 'Add a product', 'BUTTER100', /Amul Butter 100g/);
    await page.getByLabel('Quantity for Amul Butter 100g', { exact: true }).fill('10');
    await page.getByLabel('Rate for Amul Butter 100g', { exact: true }).fill('45');
    await page.getByRole('button', { name: 'Add a charge' }).click();
    await page.getByLabel('Charge amount').fill('100');
    const check = page.getByRole('status').filter({ hasText: /Lines add up to/ });
    await expect(check).toBeVisible();
    const linesTotal = Number(amountIn(await check.textContent()));
    await page.getByLabel('Bill total (as printed)').fill((linesTotal + 2).toFixed(2));
    await expect(page.getByRole('status').filter({ hasText: /^Off by/u })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save purchase' })).toBeDisabled();
    await page.getByLabel('Bill total (as printed)').fill(linesTotal.toFixed(2));
    await expect(page.getByRole('status').filter({ hasText: 'Matches the bill' })).toBeVisible();
    await fitsAndSnap(page, '15-purchase');
    await page.getByRole('button', { name: 'Save purchase' }).click();
    await expect(page).toHaveURL(/#\/purchases\/[0-9A-Z]{26}$/u);
  });

  test('stock adjustment', async () => {
    await go(page, '/inventory/adjust');
    await pick(page, 'Add a product', 'SALT1', /Tata Salt 1kg/);
    await page.getByLabel('Quantity for Tata Salt 1kg').fill('2');
    await page.getByLabel('Note (optional)').fill('Rat damage');
    await page.getByRole('button', { name: 'Post adjustment' }).click();
    await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Tata Salt 1kg' })).toContainText('48');
  });

  test('close the register: Z report', async () => {
    await go(page, '/pos');
    await page.getByRole('button', { name: 'X report' }).click();
    await expect(page.getByRole('dialog', { name: 'X report' }).getByText(/X report \(session 1\)/)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Close register' }).click();
    const close = page.getByRole('dialog', { name: 'Close register' });
    await expect(close.getByLabel('Counted cash (₹)')).toBeFocused();
    await page.keyboard.type('1200');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Z report #1')).toBeVisible();
    await fitsAndSnap(page, '16-z-report');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Open the register' })).toBeVisible();
  });

  test('reports: run and export CSV', async () => {
    const out = join(m.profile, 'sales-by-product.csv');
    await stubSaveDialog(m, out);
    await go(page, '/reports');
    await page.getByRole('button', { name: 'Sales by product' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('heading', { name: 'Sales by product', level: 2 })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Amul Butter 100g' })).toBeVisible();
    await fitsAndSnap(page, '17-reports');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    await expect(page.getByText('Saved sales-by-product.csv')).toBeVisible();
    expect(readFileSync(out, 'utf8')).toContain('Amul Butter 100g');
  });

  test('GST returns for the month', async () => {
    const out = join(m.profile, 'b2cs.csv');
    await stubSaveDialog(m, out);
    await go(page, '/gst');
    await page.getByLabel('Month').selectOption(`${new Date().toLocaleDateString('en-CA').slice(0, 7)}-01`);
    await expect(page.getByRole('status').filter({ hasText: 'Every head ties to the tax accounts for the month.' })).toBeVisible();
    const b2cs = page.getByRole('row').filter({ hasText: 'B2CS' });
    await expect(b2cs).toBeVisible();
    await fitsAndSnap(page, '18-gst');
    // reports.export allows one call a second; the previous test exported a moment ago.
    await expect(async () => {
      await b2cs.getByRole('button', { name: 'CSV' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Saved b2cs.csv' })).toBeVisible({ timeout: 1_000 });
    }).toPass({ intervals: [1_000] });
    expect(readFileSync(out, 'utf8').length).toBeGreaterThan(0);
  });

  test('diagnostics: sync, backups, audit', async () => {
    await go(page, '/diagnostics');
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sync started' })).toBeVisible();
    await page.getByRole('button', { name: 'Back up now' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Backup made/ })).toBeVisible();
    await page.getByRole('button', { name: 'Verify audit trail' }).click();
    await expect(page.getByRole('status').filter({ hasText: /verified/i })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: /Synced/ })).toBeVisible({ timeout: 30_000 });
    await fitsAndSnap(page, '19-diagnostics');
  });

  test('notifications bell: a low-stock item after the next sign-in', async () => {
    await go(page, '/products');
    await page.getByRole('link', { name: 'Tata Salt 1kg' }).click();
    await page.getByLabel('Reorder level').fill('100');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page);
    const bell = page.getByRole('link', { name: /^Notifications, [1-9]\d* unread/u });
    await expect(bell).toBeVisible();
    await bell.click();
    const item = page.getByRole('listitem').filter({ hasText: 'Tata Salt 1kg' });
    await expect(item).toBeVisible();
    await fitsAndSnap(page, '20-notifications');
    await item.getByRole('button', { name: 'Mark read' }).click();
    await expect(item.getByRole('button', { name: 'Mark read' })).toBeHidden();
  });

  test('books: trial balance and balance sheet balance after the day', async () => {
    await go(page, '/accounts/statements');
    await expect(page.getByText('Balanced', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Profit & Loss' }).click();
    await expect(page.getByRole('heading', { name: /^Profit & Loss/u })).toBeVisible();
    await page.getByRole('tab', { name: 'Balance Sheet' }).click();
    await expect(page.getByText('Balanced', { exact: true })).toBeVisible();
  });

  test('every main screen fits 1366×768 and loads without an error', async () => {
    for (const route of SCREENS) {
      await go(page, route);
      await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('alert').filter({ hasText: /Something went wrong|Too many requests/u }), `${route} shows an error`).toHaveCount(0);
      await fitsAndSnap(page, `screen${route.replaceAll('/', '-')}`);
    }
  });
});

const SCREENS = [
  '/', '/pos', '/sales', '/products', '/products/new', '/products/import', '/settings/catalog',
  '/inventory', '/inventory/adjust', '/inventory/stock-take', '/inventory/opening', '/inventory/reconciliation',
  '/parties', '/parties/outstanding', '/purchases', '/purchases/new', '/expenses', '/payments', '/payments/new',
  '/accounts', '/accounts/statements', '/accounts/books', '/accounts/journal/new', '/accounts/periods', '/accounts/year-end',
  '/gst', '/gst/setoff', '/gst/payments', '/reports', '/settings/printer', '/settings/review', '/settings/updates',
  '/diagnostics', '/notifications',
] as const;
