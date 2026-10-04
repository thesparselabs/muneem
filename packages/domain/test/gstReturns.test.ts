import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  b2clThresholdOn, buildGstr1, buildGstr3b, buildItcRegister, computeInvoice, gstTieOuts, noteSection, outwardSection, placeOfSupplyLabel, uqcOf,
  type Gstr1Bucket, type InwardLine, type NoteLine, type OutwardLine, type TaxTreatment,
} from '../src/index.js';

const B2B_GSTIN = '07AAAAA0000A1Z5';
const out = (o: Partial<OutwardLine> = {}): OutwardLine => ({
  docId: 'S1', docNumber: 'T1/2627/000001', docDate: '2026-05-03', docValuePaise: 11_800, docBucket: 'b2cs', customerGstin: null, customerName: null,
  placeOfSupply: '07', supplyType: 'intra', hsnCode: '3401', uomCode: 'PCS', qtyMilli: 1000, taxTreatment: 'taxable', gstRateBp: 1800,
  taxablePaise: 10_000, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, cessPaise: 0, ...o,
});
const note = (o: Partial<NoteLine> = {}): NoteLine => ({
  ...out({ docId: 'C1', docNumber: 'T1C/2627/00001', docDate: '2026-05-10', docBucket: 'cdnur' }), saleBucket: 'b2cs', saleNumber: 'T1/2627/000001',
  saleDate: '2026-05-03', ...o,
});
const inward = (o: Partial<InwardLine> = {}): InwardLine => ({
  kind: 'purchase', docId: 'P1', docNumber: 'T1P/2627/00001', docDate: '2026-05-04', supplierName: 'Acme', supplierGstin: '07BBBBB0000B1Z5',
  supplierInvoiceNo: 'A-1', supplierInvoiceDate: '2026-05-04', supplyType: 'intra', taxTreatment: 'taxable', supplierScheme: 'regular', itcEligible: true,
  taxablePaise: 50_000, cgstPaise: 4_500, sgstPaise: 4_500, igstPaise: 0, cessPaise: 0, ...o,
});
const gstr1 = (outward: OutwardLine[], notes: NoteLine[] = []) => buildGstr1({ regular: true, outward, notes, series: [] });

describe('GSTR-1 sections, hand-built', () => {
  it('B2B: one row per invoice and rate, the invoice value on each; an exempt line leaves for the exempt table', () => {
    const inv = { docId: 'S9', docNumber: 'T1/2627/000009', docBucket: 'b2b' as const, customerGstin: B2B_GSTIN, customerName: 'Shree Traders', docValuePaise: 27_550 };
    const r = gstr1([
      out({ ...inv }),
      out({ ...inv, gstRateBp: 500, taxablePaise: 5_000, cgstPaise: 125, sgstPaise: 125, hsnCode: '1006' }),
      out({ ...inv, taxTreatment: 'exempt', gstRateBp: 0, taxablePaise: 1_400, cgstPaise: 0, sgstPaise: 0, hsnCode: '0701' }),
    ]);
    expect(r.b2b).toEqual([
      { gstin: B2B_GSTIN, name: 'Shree Traders', invoiceNumber: 'T1/2627/000009', invoiceDate: '2026-05-03', invoiceValuePaise: 27_550, placeOfSupply: '07',
        rateBp: 500, taxablePaise: 5_000, igstPaise: 0, cgstPaise: 125, sgstPaise: 125, cessPaise: 0 },
      { gstin: B2B_GSTIN, name: 'Shree Traders', invoiceNumber: 'T1/2627/000009', invoiceDate: '2026-05-03', invoiceValuePaise: 27_550, placeOfSupply: '07',
        rateBp: 1800, taxablePaise: 10_000, igstPaise: 0, cgstPaise: 900, sgstPaise: 900, cessPaise: 0 },
    ]);
    expect(r.exemp.find((e) => e.kind === 'intra_registered')).toEqual({ kind: 'intra_registered', nilPaise: 0, exemptPaise: 1_400, nonGstPaise: 0 });
    expect(r.b2cs).toEqual([]);
  });

  it('B2CL boundary: an inter-state bill of exactly the threshold is B2CS, one paisa more is B2CL', () => {
    const at = (unitPricePaise: number) => computeInvoice({
      docType: 'tax_invoice', supplierStateCode: '07', placeOfSupplyStateCode: '27', isUnionTerritoryWithoutLegislature: false, taxScheme: 'regular',
      billDiscount: { kind: 'amount', value: 0 }, roundToRupee: false, b2clThresholdPaise: 10_000_000,
      lines: [{ qtyMilli: 1000, unitPricePaise, priceIsInclusive: true, lineDiscount: { kind: 'amount', value: 0 }, gstRateBp: 0, cessRateBp: 0, cessPerUnitPaise: 0, taxTreatment: 'taxable' }],
    }).gstr1Bucket;
    expect(at(10_000_000)).toBe('b2cs');
    expect(at(10_000_001)).toBe('b2cl');
    const inter = { supplyType: 'inter' as const, placeOfSupply: '27', cgstPaise: 0, sgstPaise: 0, igstPaise: 1_800 };
    const r = gstr1([
      out({ ...inter, docBucket: 'b2cl', docId: 'L', docNumber: 'T1/2627/000002', docValuePaise: 10_000_001 }),
      out({ ...inter, docBucket: 'b2cs', docId: 'S', docNumber: 'T1/2627/000003', docValuePaise: 10_000_000 }),
    ]);
    expect(r.b2cl).toHaveLength(1);
    expect(r.b2cl[0]).toMatchObject({ invoiceNumber: 'T1/2627/000002', invoiceValuePaise: 10_000_001, placeOfSupply: '27', igstPaise: 1_800 });
    expect(r.b2cs).toEqual([{ placeOfSupply: '27', rateBp: 1800, taxablePaise: 10_000, igstPaise: 1_800, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 }]);
  });

  it('B2CS adds up by state and rate, and a credit note against a B2CS bill nets into it', () => {
    const r = gstr1([out(), out({ docId: 'S2', docNumber: 'T1/2627/000002' }), out({ docId: 'S3', gstRateBp: 500, taxablePaise: 2_000, cgstPaise: 50, sgstPaise: 50 })],
      [note({ taxablePaise: 3_000, cgstPaise: 270, sgstPaise: 270 })]);
    expect(r.b2cs).toEqual([
      { placeOfSupply: '07', rateBp: 500, taxablePaise: 2_000, igstPaise: 0, cgstPaise: 50, sgstPaise: 50, cessPaise: 0 },
      { placeOfSupply: '07', rateBp: 1800, taxablePaise: 17_000, igstPaise: 0, cgstPaise: 1_530, sgstPaise: 1_530, cessPaise: 0 },
    ]);
    expect(r.cdnur).toEqual([]);
    expect(r.net).toEqual({ taxablePaise: 19_000, igstPaise: 0, cgstPaise: 1_580, sgstPaise: 1_580, cessPaise: 0 });
  });

  it('credit notes against B2B go to CDNR, against B2CL to CDNUR (B2CL), against exports to CDNUR (EXPWOP)', () => {
    const r = gstr1([], [
      note({ docId: 'C1', saleBucket: 'b2b', docBucket: 'cdnr', customerGstin: B2B_GSTIN, customerName: 'Shree', docValuePaise: 1_180, taxablePaise: 1_000, cgstPaise: 90, sgstPaise: 90 }),
      note({ docId: 'C2', docNumber: 'T1C/2627/00002', saleBucket: 'b2cl', supplyType: 'inter', placeOfSupply: '27', cgstPaise: 0, sgstPaise: 0, igstPaise: 1_800 }),
      note({ docId: 'C3', docNumber: 'T1C/2627/00003', saleBucket: 'exports', taxTreatment: 'zero_rated', gstRateBp: 0, placeOfSupply: '96', cgstPaise: 0, sgstPaise: 0 }),
    ]);
    expect(r.cdnr).toEqual([{ gstin: B2B_GSTIN, name: 'Shree', noteNumber: 'T1C/2627/00001', noteDate: '2026-05-10', placeOfSupply: '07', noteValuePaise: 1_180,
      rateBp: 1800, taxablePaise: 1_000, igstPaise: 0, cgstPaise: 90, sgstPaise: 90, cessPaise: 0 }]);
    expect(r.cdnur.map((c) => [c.noteNumber, c.urType])).toEqual([['T1C/2627/00002', 'B2CL'], ['T1C/2627/00003', 'EXPWOP']]);
    expect(r.net).toEqual({ taxablePaise: -21_000, igstPaise: -1_800, cgstPaise: -90, sgstPaise: -90, cessPaise: 0 });
  });

  it('a mixed bill: nil, exempt and non-GST lines are reported per line, inter/intra and registered or not', () => {
    const unreg = { docId: 'M', docNumber: 'T1/2627/000004', supplyType: 'inter' as const, placeOfSupply: '27', cgstPaise: 0, sgstPaise: 0, igstPaise: 1_800 };
    const r = gstr1([
      out({ ...unreg }),
      out({ ...unreg, taxTreatment: 'nil_rated', gstRateBp: 0, taxablePaise: 700, igstPaise: 0, hsnCode: '0401' }),
      out({ ...unreg, taxTreatment: 'non_gst', gstRateBp: 0, taxablePaise: 9_000, igstPaise: 0, hsnCode: '2710' }),
      out({ docId: 'N', taxTreatment: 'exempt', gstRateBp: 0, taxablePaise: 300, cgstPaise: 0, sgstPaise: 0, docBucket: 'exempt' }),
    ]);
    expect(r.exemp).toEqual([
      { kind: 'inter_registered', nilPaise: 0, exemptPaise: 0, nonGstPaise: 0 },
      { kind: 'intra_registered', nilPaise: 0, exemptPaise: 0, nonGstPaise: 0 },
      { kind: 'inter_unregistered', nilPaise: 700, exemptPaise: 0, nonGstPaise: 9_000 },
      { kind: 'intra_unregistered', nilPaise: 0, exemptPaise: 300, nonGstPaise: 0 },
    ]);
    expect(r.b2cs).toEqual([{ placeOfSupply: '27', rateBp: 1800, taxablePaise: 10_000, igstPaise: 1_800, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 }]);
    expect(r.hsn.map((h) => [h.hsn, h.rateBp, h.taxablePaise])).toEqual([['0401', 0, 700], ['2710', 0, 9_000], ['3401', 0, 300], ['3401', 1800, 10_000]]);
  });

  it('exports: zero-rated bills go to EXP without payment', () => {
    const r = gstr1([out({ docBucket: 'exports', taxTreatment: 'zero_rated', gstRateBp: 0, cgstPaise: 0, sgstPaise: 0, placeOfSupply: '96', supplyType: 'inter' })]);
    expect(r.exp).toEqual([{ exportType: 'WOPAY', invoiceNumber: 'T1/2627/000001', invoiceDate: '2026-05-03', invoiceValuePaise: 11_800, rateBp: 0,
      taxablePaise: 10_000, igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 }]);
  });

  it('HSN summary is net of credit notes, by recipient, HSN, UQC and rate', () => {
    const r = gstr1([
      out({ qtyMilli: 2000, uomCode: 'PCS' }), out({ docId: 'S2', qtyMilli: 1500, uomCode: 'KG', taxablePaise: 3_000, cgstPaise: 270, sgstPaise: 270 }),
      out({ docId: 'S3', customerGstin: B2B_GSTIN, docBucket: 'b2b' }), out({ docId: 'S4', hsnCode: null }),
    ], [note({ qtyMilli: 500, taxablePaise: 2_500, cgstPaise: 225, sgstPaise: 225 })]);
    expect(r.hsn).toEqual([
      { recipient: 'b2b', hsn: '3401', uqc: 'PCS', qtyMilli: 1000, totalValuePaise: 11_800, rateBp: 1800, taxablePaise: 10_000, igstPaise: 0, cgstPaise: 900, sgstPaise: 900, cessPaise: 0 },
      { recipient: 'b2c', hsn: '3401', uqc: 'KGS', qtyMilli: 1500, totalValuePaise: 3_540, rateBp: 1800, taxablePaise: 3_000, igstPaise: 0, cgstPaise: 270, sgstPaise: 270, cessPaise: 0 },
      { recipient: 'b2c', hsn: '3401', uqc: 'PCS', qtyMilli: 1500, totalValuePaise: 8_850, rateBp: 1800, taxablePaise: 7_500, igstPaise: 0, cgstPaise: 675, sgstPaise: 675, cessPaise: 0 },
      { recipient: 'b2c', hsn: '', uqc: 'PCS', qtyMilli: 1000, totalValuePaise: 11_800, rateBp: 1800, taxablePaise: 10_000, igstPaise: 0, cgstPaise: 900, sgstPaise: 900, cessPaise: 0 },
    ]);
    expect(r.missingHsn).toEqual([{ docNumber: 'T1/2627/000001', count: 1 }]);
  });

  it('documents issued: from–to per series, a missing number counts as cancelled', () => {
    const r = buildGstr1({ regular: true, outward: [], notes: [], series: [
      { nature: 'credit_note', firstNumber: 'T1C/2627/00001', lastNumber: 'T1C/2627/00002', firstSeq: 1, lastSeq: 2, issued: 2, cancelled: 0 },
      { nature: 'invoice', firstNumber: 'T1/2627/000011', lastNumber: 'T1/2627/000015', firstSeq: 11, lastSeq: 15, issued: 4, cancelled: 0 },
    ] });
    expect(r.docs).toEqual([
      { nature: 'invoice', from: 'T1/2627/000011', to: 'T1/2627/000015', total: 5, cancelled: 1 },
      { nature: 'credit_note', from: 'T1C/2627/00001', to: 'T1C/2627/00002', total: 2, cancelled: 0 },
    ]);
  });

  it('a composition business files no GSTR-1 or GSTR-3B here', () => {
    const r = buildGstr1({ regular: false, outward: [out({ docBucket: 'na' })], notes: [], series: [] });
    expect(r.applicable).toBe(false);
    expect([r.b2b, r.b2cs, r.hsn, r.docs].every((s) => s.length === 0)).toBe(true);
    const b = buildGstr3b({ regular: false, outward: [out()], notes: [], inward: [inward()] });
    expect(b.applicable).toBe(false);
    expect(b.outputTax).toEqual({ igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 });
  });

  it('sections and the exempt classification follow the documented rules', () => {
    expect(outwardSection('b2b', 'zero_rated')).toBe('b2b');
    expect(outwardSection('na', 'taxable')).toBe('none');
    expect(noteSection('b2cs', 'taxable')).toBe('b2cs');
    expect(noteSection('b2b', 'nil_rated')).toBe('exemp');
    expect(placeOfSupplyLabel('27')).toBe('27-Maharashtra');
    expect(uqcOf('KG')).toBe('KGS');
    expect(uqcOf('CASE')).toBe('CTN');
    expect(uqcOf('whatever')).toBe('OTH');
  });
});

describe('GSTR-3B and the ITC register, hand-built', () => {
  const outward = [out(), out({ docId: 'S2', taxTreatment: 'nil_rated', gstRateBp: 0, taxablePaise: 500, cgstPaise: 0, sgstPaise: 0 }),
    out({ docId: 'S3', taxTreatment: 'non_gst', gstRateBp: 0, taxablePaise: 800, cgstPaise: 0, sgstPaise: 0 }),
    out({ docId: 'S4', supplyType: 'inter', placeOfSupply: '27', cgstPaise: 0, sgstPaise: 0, igstPaise: 1_800, cessPaise: 120 })];
  const notes = [note({ taxablePaise: 1_000, cgstPaise: 90, sgstPaise: 90 })];
  const inwardLines = [
    inward(),
    inward({ docId: 'P1', itcEligible: false, taxablePaise: 10_000, cgstPaise: 900, sgstPaise: 900 }),
    inward({ kind: 'expense', docId: 'E1', docNumber: 'T1E/2627/00001', supplyType: 'inter', taxablePaise: 1_000, cgstPaise: 0, sgstPaise: 0, igstPaise: 180 }),
    inward({ kind: 'debit_note', docId: 'D1', docNumber: 'T1D/2627/00001', taxablePaise: 5_000, cgstPaise: 450, sgstPaise: 450 }),
    inward({ kind: 'purchase', docId: 'P2', supplierScheme: 'composition', taxablePaise: 7_000, cgstPaise: 0, sgstPaise: 0, supplyType: 'inter' }),
    inward({ kind: 'purchase', docId: 'P3', taxTreatment: 'nil_rated', taxablePaise: 600, cgstPaise: 0, sgstPaise: 0 }),
    inward({ kind: 'purchase', docId: 'P3', taxTreatment: 'non_gst', taxablePaise: 900, cgstPaise: 0, sgstPaise: 0 }),
    inward({ kind: 'purchase_cancel', docId: 'P0', taxablePaise: 2_000, cgstPaise: 180, sgstPaise: 180 }),
  ];
  const r = buildGstr3b({ regular: true, outward, notes, inward: inwardLines });
  const row = (code: string) => r.rows.find((x) => x.code === code)!;

  it('3.1: taxable, nil/exempt and non-GST outward supplies, net of credit notes', () => {
    expect(row('3.1a')).toMatchObject({ taxablePaise: 19_000, igstPaise: 1_800, cgstPaise: 810, sgstPaise: 810, cessPaise: 120 });
    expect(row('3.1c')).toMatchObject({ taxablePaise: 500 });
    expect(row('3.1e')).toMatchObject({ taxablePaise: 800 });
    expect(r.outputTax).toEqual({ igstPaise: 1_800, cgstPaise: 810, sgstPaise: 810, cessPaise: 120 });
  });

  it('4: eligible ITC, reversals by debit note and cancel, and ineligible tax', () => {
    expect(row('4A5')).toMatchObject({ igstPaise: 180, cgstPaise: 4_500, sgstPaise: 4_500 });
    expect(row('4B2')).toMatchObject({ cgstPaise: 630, sgstPaise: 630 });
    expect(row('4C')).toMatchObject({ igstPaise: 180, cgstPaise: 3_870, sgstPaise: 3_870 });
    expect(row('4D2')).toMatchObject({ cgstPaise: 900, sgstPaise: 900 });
    expect(r.netItc).toEqual({ igstPaise: 180, cgstPaise: 3_870, sgstPaise: 3_870, cessPaise: 0 });
  });

  it('5: inward supplies from composition suppliers, nil and non-GST', () => {
    expect(r.inward).toEqual([
      { description: 'From a supplier under composition scheme, exempt and nil rated supply', interPaise: 7_000, intraPaise: 600 },
      { description: 'Non-GST supply', interPaise: 0, intraPaise: 900 },
    ]);
  });

  it('the ITC register lists each document with what it lets the business claim', () => {
    const reg = buildItcRegister(inwardLines);
    const p1 = reg.find((x) => x.kind === 'purchase' && x.docNumber === 'T1P/2627/00001' && x.ineligiblePaise > 0)!;
    expect(p1).toMatchObject({ taxablePaise: 60_000, eligible: { cgstPaise: 4_500, sgstPaise: 4_500 }, ineligiblePaise: 1_800 });
    expect(reg.find((x) => x.kind === 'debit_note')).toMatchObject({ eligible: { cgstPaise: 450, sgstPaise: 450 } });
  });

  it('the tie-out compares 3.1 and 4C with the books head by head', () => {
    const books = { output: r.outputTax, input: { ...r.netItc, cgstPaise: r.netItc.cgstPaise + 1 } };
    const failing = gstTieOuts(r, books).filter((t) => t.returnPaise !== t.booksPaise);
    expect(failing.map((t) => t.name)).toEqual(['input CGST: 4C = input account']);
  });
});

describe('GSTR-1 and GSTR-3B agree on output tax for any mix of lines', () => {
  const treatment = fc.constantFrom<TaxTreatment>('taxable', 'taxable', 'nil_rated', 'exempt', 'non_gst', 'zero_rated');
  const bucket = fc.constantFrom<Gstr1Bucket>('b2b', 'b2cl', 'b2cs', 'exports', 'exempt', 'na');
  const amounts = fc.record({ taxablePaise: fc.integer({ min: 0, max: 1e7 }), igstPaise: fc.integer({ min: 0, max: 1e6 }), cgstPaise: fc.integer({ min: 0, max: 1e6 }),
    sgstPaise: fc.integer({ min: 0, max: 1e6 }), cessPaise: fc.integer({ min: 0, max: 1e5 }) });
  const taxed = (t: TaxTreatment, a: { taxablePaise: number; igstPaise: number; cgstPaise: number; sgstPaise: number; cessPaise: number }) =>
    (t === 'taxable' ? a : { ...a, igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 });
  const outLine = fc.tuple(bucket, treatment, amounts, fc.integer({ min: 0, max: 9 }))
    .map(([b, t, a, i]) => out({ docId: `S${i}`, docBucket: b, taxTreatment: t, customerGstin: b === 'b2b' ? B2B_GSTIN : null, ...taxed(t, a) }));
  const noteLine = fc.tuple(bucket, treatment, amounts, fc.integer({ min: 0, max: 9 }))
    .map(([b, t, a, i]) => note({ docId: `C${i}`, saleBucket: b, taxTreatment: t, customerGstin: b === 'b2b' ? B2B_GSTIN : null, ...taxed(t, a) }));
  it('Σ sections − notes = 3.1(a)+(b)', () => {
    fc.assert(fc.property(fc.array(outLine, { maxLength: 30 }), fc.array(noteLine, { maxLength: 10 }), (o, n) => {
      const g1 = buildGstr1({ regular: true, outward: o, notes: n, series: [] });
      const g3 = buildGstr3b({ regular: true, outward: o, notes: n, inward: [] });
      expect({ igstPaise: g1.net.igstPaise, cgstPaise: g1.net.cgstPaise, sgstPaise: g1.net.sgstPaise, cessPaise: g1.net.cessPaise }).toEqual(g3.outputTax);
    }));
  });
});

describe('B2CL threshold is effective-dated', () => {
  const schedule = [{ effectiveFrom: '2017-07-01', paise: 25_000_000 }, { effectiveFrom: '2024-08-01', paise: 10_000_000 }];
  it('takes the latest entry on or before the date, else the fallback', () => {
    expect(b2clThresholdOn(schedule, '2024-07-31', 1)).toBe(25_000_000);
    expect(b2clThresholdOn(schedule, '2024-08-01', 1)).toBe(10_000_000);
    expect(b2clThresholdOn(schedule, '2017-06-30', 7)).toBe(7);
    expect(b2clThresholdOn(undefined, '2026-01-01', 7)).toBe(7);
  });
});
