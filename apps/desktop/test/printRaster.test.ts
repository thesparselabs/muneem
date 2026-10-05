import { describe, expect, it } from 'vitest';
import { PrinterConfig, type ReceiptDoc } from '@muneem/contracts';
import { DRAWER_KICK, needsRaster, renderEscPos } from '../src/main/services/print/escpos.js';
import { columns, layoutReceipt, type PrintLine } from '../src/main/services/print/layout.js';
import { planRasterLine, type LineRasteriser, type RasterPlan } from '../src/main/services/print/raster.js';
import { receiptHtml } from '../src/main/services/print/receiptHtml.js';

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

// Each line comes back as a bitmap of the planned size filled with its position, so the bytes are predictable.
function fakeRasteriser(fill?: (i: number) => number) {
  const plans: RasterPlan[] = [];
  const rasteriser: LineRasteriser = {
    rasterise: (ps) => {
      plans.push(...ps);
      return Promise.resolve(ps.map((p, i) => ({ widthDots: p.widthDots, heightDots: p.heightDots, bits: Buffer.alloc((p.widthDots / 8) * p.heightDots, fill ? fill(i) : i + 1) })));
    },
  };
  return { rasteriser, plans };
}

const LINES: PrintLine[] = [
  { text: 'Sharma Store', align: 'center', bold: true },
  { text: 'चाय पत्ती 250g', align: 'left' },
  { text: columns('TOTAL', '₹ 122.00', 32), align: 'left', bold: true },
];

describe('ESC/POS with ₹ and Indic text', () => {
  it('sends ASCII lines as text and the others as GS v 0 raster lines, byte for byte', async () => {
    const { rasteriser, plans } = fakeRasteriser();
    const bytes = await renderEscPos(LINES, 32, { openDrawer: true, cut: true, rupee: 'symbol' }, rasteriser);
    const raster = (fill: number) => [0x1b, 0x61, 0, 0x1d, 0x76, 0x30, 0, 48, 0, 32, 0, ...new Array<number>(48 * 32).fill(fill)];
    expect([...bytes]).toEqual([
      0x1b, 0x40, ...DRAWER_KICK,
      0x1b, 0x61, 1, 0x1b, 0x45, 1, 0x1d, 0x21, 0, ...ascii('Sharma Store'), 0x0a,
      ...raster(1),
      ...raster(2),
      0x1b, 0x45, 0, 0x1d, 0x21, 0, 0x1b, 0x64, 4, 0x1d, 0x56, 66, 0,
    ]);
    expect(plans.map((p) => p.runs)).toEqual([
      [{ text: 'चाय पत्ती 250g', x: 0, maxWidth: 32 * 12 }],
      [{ text: 'TOTAL', x: 0, maxWidth: 5 * 12 }, { text: '₹ 122.00', x: 24 * 12, maxWidth: 8 * 12 }],
    ]);
  });

  it('with the "Rs" option only the Indic line becomes an image', async () => {
    const { rasteriser, plans } = fakeRasteriser();
    const bytes = await renderEscPos(LINES, 32, { openDrawer: false, cut: false, rupee: 'Rs' }, rasteriser);
    expect(plans).toHaveLength(1);
    expect(bytes.includes(Buffer.from(ascii(`TOTAL${' '.repeat(19)}Rs 122.00`)))).toBe(true);
  });

  it('falls back to plain text when there is no rasteriser, it fails, or it returns the wrong size', async () => {
    const plain = await renderEscPos(LINES, 32, { openDrawer: false, cut: false, rupee: 'symbol' });
    expect(plain.includes(Buffer.from(ascii('??? ????? 250g')))).toBe(true);
    expect(plain.includes(Buffer.from([0x1d, 0x76, 0x30]))).toBe(false);

    const errors: unknown[] = [];
    const broken: LineRasteriser = { rasterise: () => Promise.reject(new Error('page crashed')) };
    expect(await renderEscPos(LINES, 32, { openDrawer: false, cut: false, rupee: 'symbol' }, broken, (e) => errors.push(e))).toEqual(plain);
    expect(errors).toHaveLength(1);

    const wrongSize: LineRasteriser = { rasterise: (ps) => Promise.resolve(ps.map(() => ({ widthDots: 8, heightDots: 1, bits: Buffer.alloc(1) }))) };
    expect(await renderEscPos(LINES, 32, { openDrawer: false, cut: false, rupee: 'symbol' }, wrongSize)).toEqual(plain);
  });

  it('decides per line what the printer code page can carry', () => {
    expect(needsRaster('Lux Soap 100g')).toBe(false);
    expect(needsRaster('Café Crème')).toBe(false);
    expect(needsRaster('TOTAL ₹ 10.00', 'Rs')).toBe(false);
    expect(needsRaster('TOTAL ₹ 10.00', 'symbol')).toBe(true);
    expect(needsRaster('दूध')).toBe(true);
    expect(needsRaster('தேநீர்')).toBe(true);
  });

  it('a whole Hindi receipt rasters exactly its non-ASCII lines', async () => {
    const lines = layoutReceipt(HINDI_DOC, 42, 'symbol');
    const { rasteriser, plans } = fakeRasteriser(() => 0);
    const bytes = await renderEscPos(lines, 42, { openDrawer: false, cut: true, rupee: 'symbol' }, rasteriser);
    const indic = lines.filter((l) => /[^\x20-\x7e]/u.test(l.text));
    expect(indic.length).toBeGreaterThanOrEqual(4);
    expect(plans).toHaveLength(indic.length);
    let rasters = 0;
    for (let i = bytes.indexOf(Buffer.from([0x1d, 0x76, 0x30, 0])); i >= 0; i = bytes.indexOf(Buffer.from([0x1d, 0x76, 0x30, 0]), i + 1)) rasters += 1;
    expect(rasters).toBe(indic.length);
    for (const l of lines.filter((x) => !indic.includes(x))) expect(bytes.includes(Buffer.from(ascii(l.text)))).toBe(true);
    expect(plans.every((p) => p.widthDots === 504)).toBe(true);
  });
});

describe('raster line plans', () => {
  it('keeps ASCII words on their text columns and an Indic phrase as one run', () => {
    const plan = planRasterLine({ text: columns('  2 PCS x 41.30 दूध', '82.60', 42), align: 'left' }, 42);
    expect(plan).toMatchObject({ widthDots: 504, heightDots: 32, fontPx: 22, baseline: 23, bold: false });
    expect(plan.runs.map((r) => r.text)).toEqual(['2', 'PCS', 'x', '41.30 दूध', '82.60']);
    expect(plan.runs[0]).toEqual({ text: '2', x: 2 * 12, maxWidth: 12 });
    expect(plan.runs.at(-1)).toEqual({ text: '82.60', x: 37 * 12, maxWidth: 5 * 12 });
  });

  it('draws double lines at twice the size, centred on half the columns', () => {
    const text = 'शर्मा स्टोर';
    const plan = planRasterLine({ text, align: 'center', bold: true, double: true }, 42);
    expect(plan).toMatchObject({ widthDots: 504, heightDots: 64, fontPx: 44, baseline: 46, bold: true });
    expect(plan.runs).toEqual([{ text, x: Math.floor((21 - text.length) / 2) * 24, maxWidth: (21 - Math.floor((21 - text.length) / 2)) * 24 }]);
  });

  it('58 mm paper is 384 dots wide', () => {
    expect(planRasterLine({ text: 'चाय', align: 'left' }, 32).widthDots).toBe(384);
  });
});

const HINDI_DOC: ReceiptDoc = {
  title: 'TAX INVOICE', duplicate: false, copyNo: 1,
  header: { businessName: 'शर्मा जनरल स्टोर', lines: ['12 चांदनी चौक, दिल्ली', 'Ph: 9999999999'], gstin: '07AAAAA0000A1Z5' },
  docNumber: 'DE01/2627/000042', docDate: '2026-10-05', time: '14:05', terminalCode: 'T01', cashier: 'Aditya',
  customer: { name: 'राम कुमार <VIP>' }, placeOfSupply: '07',
  lines: [
    { name: 'चाय पत्ती 250g', qty: '2 PCS', unitPricePaise: 4130, discountPaise: 0, amountPaise: 8260 },
    { name: 'Tata Salt 1kg', hsnCode: '2501', qty: '1 PCS', unitPricePaise: 2800, discountPaise: 0, amountPaise: 2800 },
  ],
  totals: { grossPaise: 11_060, discountPaise: 0, taxablePaise: 10_534, cgstPaise: 263, sgstPaise: 263, igstPaise: 0, cessPaise: 0, roundOffPaise: 0, totalPaise: 11_060, stateTaxLabel: 'SGST' },
  taxSummary: [{ rateBp: 500, taxablePaise: 10_534, cgstPaise: 263, sgstPaise: 263, igstPaise: 0 }],
  tenders: [{ method: 'CASH', amountPaise: 11_060 }],
  changePaise: 0, footer: ['धन्यवाद! फिर आइए।'],
};

describe('image (driver) mode page', () => {
  it('matches the reviewed 58 mm page, sized to its content', async () => {
    const page = receiptHtml(layoutReceipt(HINDI_DOC, 32, 'symbol'), 32);
    expect(page.widthMicrons).toBe(58_000);
    expect(page.heightMicrons).toBeGreaterThan(100_000);
    await expect(page.html).toMatchFileSnapshot('./fixtures/print/receipt-hindi-58mm.html');
  });

  it('escapes receipt text so a product or customer name cannot become markup', () => {
    const { html } = receiptHtml([{ text: '<img src=x onerror=alert(1)> & "q"', align: 'left' }], 42);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;');
    expect(html).not.toContain('<img');
  });

  it('80 mm paper for 42 and 48 columns', () => {
    expect(receiptHtml([], 42).widthMicrons).toBe(80_000);
    expect(receiptHtml([], 48).widthMicrons).toBe(80_000);
  });
});

describe('printer settings validation', () => {
  const base = { port: 9100, widthChars: 42, openDrawer: true };
  it('a Windows printer needs a name, and image mode needs a Windows printer', () => {
    expect(PrinterConfig.safeParse({ ...base, kind: 'spooler' }).error?.issues[0]?.path).toEqual(['printerName']);
    expect(PrinterConfig.safeParse({ ...base, kind: 'network', host: '10.0.0.5', mode: 'image' }).error?.issues[0]?.path).toEqual(['mode']);
    expect(PrinterConfig.safeParse({ ...base, kind: 'spooler', printerName: 'TVS RP3160 Gold', mode: 'image', rupee: 'symbol' }).success).toBe(true);
  });
  it('rejects printer names with control characters or of absurd length', () => {
    for (const printerName of ['EPSON\nTM-T82', 'EPSON\u0000', 'x'.repeat(257), '   ']) {
      expect(PrinterConfig.safeParse({ ...base, kind: 'spooler', printerName }).success).toBe(false);
    }
  });
  it('a configuration saved before 9d still loads, printing as before', () => {
    expect(PrinterConfig.parse({ kind: 'network', host: '192.168.1.50', port: 9100, widthChars: 42, openDrawer: true })).toMatchObject({ mode: 'escpos', rupee: 'Rs' });
  });
});
