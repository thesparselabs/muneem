import { DomainError } from '../errors.js';
import { apportion, assertSafeInt, divRound, pctOf, sumInts } from '../money.js';
import type {
  Discount,
  GstInvoiceInput,
  GstInvoiceResult,
  GstLineInput,
  GstLineResult,
  Gstr1Bucket,
  TaxTreatment,
} from './types.js';

/**
 * LLD §3.1 — exact step order. Order changes results; do not "simplify".
 * Pure: same input → same output, on device (this file) and cloud (Go port).
 */
export function computeInvoice(input: GstInvoiceInput): GstInvoiceResult {
  validate(input);

  // 1  supply type
  const supplyType = input.placeOfSupplyStateCode === input.supplierStateCode ? 'intra' : 'inter';
  const taxesApply = input.taxScheme === 'regular';

  // 2  per line: gross, exclusive gross, line discount, pre-bill-discount taxable
  const pre = input.lines.map((l, i) => {
    const lineTaxes = taxesApply && l.taxTreatment === 'taxable';
    const gross = divRound(mulChecked(l.qtyMilli, l.unitPricePaise), 1000);
    // Inclusive back-calc divides by (10000 + gst + cess) — cess-bearing MRP items would otherwise be mis-taxed.
    // A non-taxable line has no tax inside its price, so its exclusive gross is its gross.
    const grossEx =
      l.priceIsInclusive && lineTaxes
        ? divRound(mulChecked(gross, 10_000), 10_000 + l.gstRateBp + l.cessRateBp)
        : gross;
    const lineDisc = discountAmount(l.lineDiscount, grossEx);
    if (lineDisc > grossEx) {
      throw new DomainError('DISCOUNT_EXCEEDS_VALUE', `line ${i + 1}: discount ${lineDisc} exceeds value ${grossEx}`);
    }
    return { gross, grossEx, lineDisc, taxable0: grossEx - lineDisc, lineTaxes };
  });

  // 3  bill discount, apportioned by largest remainder over pre-discount taxable values
  const taxable0Sum = sumInts(pre.map((p) => p.taxable0));
  const billDiscTotal = discountAmount(input.billDiscount, taxable0Sum);
  if (billDiscTotal > taxable0Sum) {
    throw new DomainError('DISCOUNT_EXCEEDS_VALUE', `bill discount ${billDiscTotal} exceeds taxable ${taxable0Sum}`);
  }
  const billDisc = apportion(billDiscTotal, pre.map((p) => p.taxable0));

  // 4  per line tax
  const lines: GstLineResult[] = input.lines.map((l, i) => {
    const p = pre[i]!;
    const taxable = p.taxable0 - (billDisc[i] ?? 0);
    let cgst = 0, sgst = 0, igst = 0, cess = 0;
    if (p.lineTaxes) {
      if (supplyType === 'intra') {
        const taxTotal = pctOf(taxable, l.gstRateBp);
        // Half the rate via integer maths only; sgst = total − cgst so the halves always re-sum (C-3).
        cgst = divRound(mulChecked(taxable, l.gstRateBp), 20_000);
        sgst = taxTotal - cgst;
      } else {
        igst = pctOf(taxable, l.gstRateBp);
      }
      cess = pctOf(taxable, l.cessRateBp) + divRound(mulChecked(l.qtyMilli, l.cessPerUnitPaise), 1000);
    }
    const total = taxable + cgst + sgst + igst + cess;
    return {
      grossPaise: p.gross,
      grossExPaise: p.grossEx,
      lineDiscountPaise: p.lineDisc,
      apportionedBillDiscountPaise: billDisc[i] ?? 0,
      taxablePaise: taxable,
      cgstPaise: cgst,
      sgstPaise: sgst,
      igstPaise: igst,
      cessPaise: cess,
      totalPaise: total,
    };
  });

  // 5  invoice sums
  const sum = (k: keyof GstLineResult) => sumInts(lines.map((x) => x[k]));
  const grossPaise = sum('grossPaise');
  const lineDiscountPaise = sum('lineDiscountPaise');
  const taxablePaise = sum('taxablePaise');
  const cgstPaise = sum('cgstPaise');
  const sgstPaise = sum('sgstPaise');
  const igstPaise = sum('igstPaise');
  const cessPaise = sum('cessPaise');

  // 6  optional rupee round-off; delta posts to the Round Off account, never absorbed
  const totalBefore = taxablePaise + cgstPaise + sgstPaise + igstPaise + cessPaise;
  let totalPaise = totalBefore;
  let roundOffPaise = 0;
  if (input.roundToRupee) {
    totalPaise = divRound(totalBefore, 100) * 100;
    roundOffPaise = totalPaise - totalBefore;
  }

  // 7  GSTR-1 bucket
  const gstr1Bucket = bucketOf(input, supplyType, totalPaise);

  return {
    supplyType,
    stateTaxKind: supplyType === 'intra' && input.isUnionTerritoryWithoutLegislature ? 'utgst' : 'sgst',
    lines,
    grossPaise,
    lineDiscountPaise,
    billDiscountPaise: billDiscTotal,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    cessPaise,
    roundOffPaise,
    totalPaise,
    gstr1Bucket,
  };
}

function bucketOf(input: GstInvoiceInput, supplyType: 'intra' | 'inter', totalPaise: number): Gstr1Bucket {
  if (input.taxScheme !== 'regular') return 'na';
  const hasGstin = !!input.customerGstin;
  if (input.docType === 'credit_note') return hasGstin ? 'cdnr' : 'cdnur';
  if (hasGstin) return 'b2b';
  if (supplyType === 'inter' && totalPaise > input.b2clThresholdPaise) return 'b2cl';
  const treatments = new Set<TaxTreatment>(input.lines.map((l) => l.taxTreatment));
  if (!treatments.has('taxable')) {
    if (treatments.size === 1) {
      const only = [...treatments][0]!;
      if (only === 'zero_rated') return 'exports';
      if (only === 'nil_rated') return 'nil_rated';
      if (only === 'non_gst') return 'non_gst';
      return 'exempt';
    }
    // mixed non-taxable treatments: report under 'exempt' (deterministic, reviewable)
    return 'exempt';
  }
  return 'b2cs';
}

function discountAmount(d: Discount, base: number): number {
  if (d.kind === 'percent') return pctOf(base, d.value);
  return d.value;
}

function mulChecked(a: number, b: number): number {
  return assertSafeInt(a * b, 'product');
}

function validate(input: GstInvoiceInput): void {
  if (!/^\d{2}$/.test(input.supplierStateCode) || !/^\d{2}$/.test(input.placeOfSupplyStateCode)) {
    throw new DomainError('INVALID_INPUT', 'state codes must be 2 digits');
  }
  if (input.lines.length === 0) throw new DomainError('INVALID_INPUT', 'invoice needs at least one line');
  assertSafeInt(input.b2clThresholdPaise, 'b2clThresholdPaise');
  validateDiscount(input.billDiscount, 'bill');
  input.lines.forEach((l, i) => validateLine(l, i));
}

function validateDiscount(d: Discount, what: string): void {
  assertSafeInt(d.value, `${what} discount`);
  if (d.value < 0) throw new DomainError('INVALID_INPUT', `${what} discount must be >= 0`);
  if (d.kind === 'percent' && d.value > 10_000) throw new DomainError('INVALID_INPUT', `${what} discount > 100%`);
}

function validateLine(l: GstLineInput, i: number): void {
  const at = `line ${i + 1}`;
  assertSafeInt(l.qtyMilli, `${at} qtyMilli`);
  assertSafeInt(l.unitPricePaise, `${at} unitPricePaise`);
  assertSafeInt(l.gstRateBp, `${at} gstRateBp`);
  assertSafeInt(l.cessRateBp, `${at} cessRateBp`);
  assertSafeInt(l.cessPerUnitPaise, `${at} cessPerUnitPaise`);
  if (l.qtyMilli <= 0) throw new DomainError('INVALID_INPUT', `${at}: qty must be > 0`);
  if (l.unitPricePaise < 0) throw new DomainError('INVALID_INPUT', `${at}: price must be >= 0`);
  if (l.gstRateBp < 0 || l.cessRateBp < 0 || l.cessPerUnitPaise < 0) {
    throw new DomainError('INVALID_INPUT', `${at}: rates must be >= 0`);
  }
  validateDiscount(l.lineDiscount, at);
}
