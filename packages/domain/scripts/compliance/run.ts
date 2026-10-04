import {
  billRoundOff, buildGstr1, closingEntryNo, fyEndOf, buildGstr3b, buildItcRegister, buildJournal, CHART_OF_ACCOUNTS, closingLines, computeInvoice, computeReturn, computeSetoff,
  creditNoteBucket, creditUsedBy, cumulativeShare, DEBIT_NOTE_RULE, EXPENSE_RULE, GST_PAYMENT_RULE, GST_SETOFF_RULE, isUtWithoutLegislature, landedValues,
  PURCHASE_RULE, SALE_RETURN_RULE, SALE_RULE, type AccountRef, type ClosingBalance, type GstHeads, type GstInvoiceInput, type GstInvoiceResult,
  type GstLineInput, type GstLineResult, type InwardLine, type JournalLine, type NoteLine, type OutwardLine, type ReturnInput, type SeriesIssued,
  type SoldLine, type TaxHeads,
} from '../../src/index.js';
import type {
  Business, CreditNote, DebitNote, DebitNoteResult, DocLine, Expense, PostedJournal, Purchase, PurchaseResult, Sale, ScenarioInput, ScenarioResult,
} from './types.js';

const NO_DISCOUNT = { kind: 'amount', value: 0 } as const;
const NO_B2CL = Number.MAX_SAFE_INTEGER;
const ZERO: GstHeads = { igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 };
const HEAD_KEYS = ['igstPaise', 'cgstPaise', 'sgstPaise', 'cessPaise'] as const;

const headsOf = (a: GstHeads): GstHeads => ({ igstPaise: a.igstPaise, cgstPaise: a.cgstPaise, sgstPaise: a.sgstPaise, cessPaise: a.cessPaise });
const taxHeads = (a: GstHeads): TaxHeads => ({ cgstPaise: a.cgstPaise, sgstPaise: a.sgstPaise, igstPaise: a.igstPaise, cessPaise: a.cessPaise });
const addHeads = (a: GstHeads, b: GstHeads): GstHeads => ({
  igstPaise: a.igstPaise + b.igstPaise, cgstPaise: a.cgstPaise + b.cgstPaise, sgstPaise: a.sgstPaise + b.sgstPaise, cessPaise: a.cessPaise + b.cessPaise,
});
const taxOf = (a: GstHeads): number => a.igstPaise + a.cgstPaise + a.sgstPaise + a.cessPaise;
const sum = <T>(xs: readonly T[], f: (x: T) => number): number => xs.reduce((s, x) => s + f(x), 0);

const gstLine = (l: DocLine): GstLineInput => ({
  qtyMilli: l.qtyMilli, unitPricePaise: l.unitPricePaise, priceIsInclusive: l.inclusive ?? false, lineDiscount: l.lineDiscount ?? NO_DISCOUNT,
  gstRateBp: l.item.rateBp, cessRateBp: l.item.cessRateBp ?? 0, cessPerUnitPaise: l.item.cessPerUnitPaise ?? 0, taxTreatment: l.item.treatment ?? 'taxable',
});

const ACCOUNTS = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
const codeOf = (ref: AccountRef): string => ('code' in ref ? ref.code : CHART_OF_ACCOUNTS.find((a) => a.role === ref.role)!.code);

function posted(ref: string, date: string, lines: readonly JournalLine[]): PostedJournal {
  return {
    ref, date, lines: lines.map((l) => {
      const code = codeOf(l.account);
      return {
        side: l.debitPaise > 0 ? 'Dr' : 'Cr', code, account: ACCOUNTS.get(code)!.name, paise: l.debitPaise || l.creditPaise,
        ...(l.party && { party: `${l.party.partyType}:${l.party.partyId}` }),
      };
    }),
  };
}

// Each account's net (debit positive) over the journals.
function balances(journals: readonly PostedJournal[]): Map<string, number> {
  const by = new Map<string, number>();
  for (const j of journals) for (const l of j.lines) by.set(l.code, (by.get(l.code) ?? 0) + (l.side === 'Dr' ? l.paise : -l.paise));
  return by;
}

const TAX_CODES = { output: { igstPaise: '2230', cgstPaise: '2210', sgstPaise: '2220', cessPaise: '2240' }, input: { igstPaise: '1530', cgstPaise: '1510', sgstPaise: '1520', cessPaise: '1540' } };

// Output tax as credit − debit and input tax as debit − credit; a negative balance counts as zero (ADR-0044).
export function taxBalances(journals: readonly PostedJournal[], clampAtZero: boolean): { output: GstHeads; input: GstHeads } {
  const net = balances(journals);
  const side = (codes: Record<keyof GstHeads, string>, sign: number): GstHeads =>
    Object.fromEntries(HEAD_KEYS.map((k) => {
      const v = sign * (net.get(codes[k]) ?? 0) || 0;
      return [k, clampAtZero ? Math.max(0, v) : v];
    })) as unknown as GstHeads;
  return { output: side(TAX_CODES.output, -1), input: side(TAX_CODES.input, 1) };
}

function series(docs: readonly { number: string }[], nature: SeriesIssued['nature']): SeriesIssued[] {
  const by = new Map<string, { number: string; seq: number }[]>();
  for (const d of docs) {
    const cut = d.number.lastIndexOf('/');
    const key = d.number.slice(0, cut);
    by.set(key, [...(by.get(key) ?? []), { number: d.number, seq: Number(d.number.slice(cut + 1)) }]);
  }
  return [...by.values()].map((xs) => {
    const sorted = [...xs].sort((a, b) => a.seq - b.seq);
    return {
      nature, firstNumber: sorted[0]!.number, lastNumber: sorted.at(-1)!.number, firstSeq: sorted[0]!.seq, lastSeq: sorted.at(-1)!.seq, issued: xs.length, cancelled: 0,
    };
  });
}

interface SaleState { sale: Sale; input: GstInvoiceInput; result: GstInvoiceResult; creditPaise: number; toAccountTaken: number; roundOffTaken: number; returned: number[] }

class ScenarioRun {
  readonly out: ScenarioResult;
  private readonly sales = new Map<string, SaleState>();
  private readonly purchases = new Map<string, { p: Purchase; lines: GstLineResult[]; landed: number[]; charges: number[]; itcEligible: boolean[]; roundOffPaise: number; returned: number[] }>();
  private readonly outward: OutwardLine[] = [];
  private readonly notes: NoteLine[] = [];
  private readonly inward: InwardLine[] = [];

  constructor(private readonly s: ScenarioInput) {
    this.out = {
      invoices: [], creditNotes: [], purchases: [], debitNotes: [], gstr1: undefined!, gstr3b: undefined!, itcRegister: [], setoff: null, journals: [], trialBalance: [],
    };
  }

  private get b(): Business { return this.s.business; }
  private get regular(): boolean { return this.b.scheme === 'regular'; }

  run(): ScenarioResult {
    this.s.sales?.forEach((x) => this.sale(x));
    this.s.creditNotes?.forEach((x) => this.creditNote(x));
    this.s.purchases?.forEach((x) => this.purchase(x));
    this.s.debitNotes?.forEach((x) => this.debitNote(x));
    this.s.expenses?.forEach((x) => this.expense(x));
    this.out.gstr1 = buildGstr1({
      regular: this.regular, outward: this.outward, notes: this.notes,
      series: this.regular ? [...series(this.s.sales ?? [], 'invoice'), ...series(this.s.creditNotes ?? [], 'credit_note')] : [],
    });
    this.out.gstr3b = buildGstr3b({ regular: this.regular, outward: this.outward, notes: this.notes, inward: this.inward });
    this.out.itcRegister = buildItcRegister(this.inward);
    if (this.s.setoff) this.setoff(this.s.setoff.date, this.s.setoff.challanDate);
    if (this.s.yearEnd) this.yearEnd(this.s.yearEnd.fy);
    const net = balances(this.out.journals);
    this.out.trialBalance = [...net.entries()].filter(([, v]) => v !== 0).sort(([a], [b]) => a.localeCompare(b))
      .map(([code, netPaise]) => ({ code, account: ACCOUNTS.get(code)!.name, netPaise }));
    return this.out;
  }

  private sale(x: Sale): void {
    const input: GstInvoiceInput = {
      docType: this.regular ? 'tax_invoice' : 'bill_of_supply', supplierStateCode: this.b.stateCode,
      placeOfSupplyStateCode: x.placeOfSupply ?? x.customer?.stateCode ?? this.b.stateCode, isUnionTerritoryWithoutLegislature: isUtWithoutLegislature(this.b.stateCode),
      taxScheme: this.b.scheme, ...(x.customer?.gstin && { customerGstin: x.customer.gstin }), billDiscount: x.billDiscount ?? NO_DISCOUNT,
      roundToRupee: this.b.roundToRupee, b2clThresholdPaise: this.b.b2clThresholdPaise, lines: x.lines.map(gstLine),
    };
    const result = computeInvoice(input);
    const cash = x.paid ? x.paid.cash ?? 0 : result.totalPaise;
    const upi = x.paid?.upi ?? 0;
    const creditPaise = result.totalPaise - cash - upi;
    if (creditPaise < 0 || (creditPaise > 0 && !x.customer)) throw new Error(`${x.ref}: tenders do not cover the bill`);
    this.out.invoices.push({ ref: x.ref, kind: 'sale', input, result });
    this.sales.set(x.ref, { sale: x, input, result, creditPaise, toAccountTaken: 0, roundOffTaken: 0, returned: x.lines.map(() => 0) });
    this.journal(x.ref, x.date, buildJournal(SALE_RULE, {
      cashPaise: cash, clearingPaise: upi, creditPaise, customerId: x.customer?.id ?? null, taxablePaise: result.taxablePaise, tax: taxHeads(result),
      roundOffPaise: result.roundOffPaise, cogsPaise: sum(x.lines, (l) => l.cogsPaise),
    }));
    x.lines.forEach((l, i) => this.outward.push({
      ...this.amounts(result.lines[i]!), docId: x.ref, docNumber: x.number, docDate: x.date, docValuePaise: result.totalPaise, docBucket: result.gstr1Bucket,
      customerGstin: x.customer?.gstin ?? null, customerName: x.customer?.name ?? null, placeOfSupply: input.placeOfSupplyStateCode, supplyType: result.supplyType,
      hsnCode: l.item.hsn, uomCode: l.item.uom, qtyMilli: l.qtyMilli, taxTreatment: l.item.treatment ?? 'taxable', gstRateBp: l.item.rateBp,
    }));
  }

  private amounts(l: GstHeads & { taxablePaise: number }) {
    return { taxablePaise: l.taxablePaise, ...headsOf(l) };
  }

  private creditNote(x: CreditNote): void {
    const st = this.sales.get(x.saleRef)!;
    const sold = (i: number): SoldLine => {
      const r = st.result.lines[i]!;
      return { qtyMilli: st.sale.lines[i]!.qtyMilli, baseQtyMilli: st.sale.lines[i]!.qtyMilli, taxablePaise: r.taxablePaise, ...taxHeads(r), cogsPaise: st.sale.lines[i]!.cogsPaise };
    };
    const input: ReturnInput = {
      lines: x.lines.map((l) => ({ line: sold(l.line), returnedBeforeMilli: st.returned[l.line]!, qtyMilli: l.qtyMilli })),
      saleRoundOffPaise: st.result.roundOffPaise, roundOffReturnedPaise: st.roundOffTaken,
    };
    const result = computeReturn(input);
    const outstanding = Math.max(0, st.creditPaise - st.toAccountTaken);
    const toAccountPaise = x.refundBy === 'account' ? result.totalPaise : Math.min(outstanding, result.totalPaise);
    const refundPaise = result.totalPaise - toAccountPaise;
    st.toAccountTaken += toAccountPaise;
    st.roundOffTaken += result.roundOffPaise;
    x.lines.forEach((l) => { st.returned[l.line]! += l.qtyMilli; });
    this.out.creditNotes.push({ ref: x.ref, saleRef: x.saleRef, input, result, toAccountPaise, refundPaise });
    this.journal(x.ref, x.date, buildJournal(SALE_RETURN_RULE, {
      cashPaise: x.refundBy === 'cash' ? refundPaise : 0, clearingPaise: x.refundBy === 'upi' ? refundPaise : 0, creditPaise: toAccountPaise,
      customerId: st.sale.customer?.id ?? null, taxablePaise: result.taxablePaise, tax: taxHeads(result), roundOffPaise: result.roundOffPaise, costPaise: result.costPaise,
    }));
    const c = st.sale.customer;
    x.lines.forEach((l, k) => {
      const line = st.sale.lines[l.line]!;
      this.notes.push({
        ...this.amounts(result.lines[k]!), docId: x.ref, docNumber: x.number, docDate: x.date, docValuePaise: result.totalPaise,
        docBucket: creditNoteBucket(this.b.scheme, c?.gstin), customerGstin: c?.gstin ?? null, customerName: c?.name ?? null,
        placeOfSupply: st.input.placeOfSupplyStateCode, supplyType: st.result.supplyType, hsnCode: line.item.hsn, uomCode: line.item.uom, qtyMilli: l.qtyMilli,
        taxTreatment: line.item.treatment ?? 'taxable', gstRateBp: line.item.rateBp, saleBucket: st.result.gstr1Bucket, saleNumber: st.sale.number, saleDate: st.sale.date,
      });
    });
  }

  private purchase(x: Purchase): void {
    const scheme = x.supplier.scheme ?? 'regular';
    const itcAllowed = scheme === 'regular' && this.regular;
    const input: GstInvoiceInput = {
      docType: scheme === 'regular' ? 'tax_invoice' : 'bill_of_supply', supplierStateCode: x.supplier.stateCode, placeOfSupplyStateCode: this.b.stateCode,
      isUnionTerritoryWithoutLegislature: isUtWithoutLegislature(this.b.stateCode), taxScheme: scheme, billDiscount: NO_DISCOUNT, roundToRupee: false,
      b2clThresholdPaise: NO_B2CL, lines: x.lines.map(gstLine),
    };
    const result = computeInvoice(input);
    const itcEligible = x.lines.map((l) => itcAllowed && (l.itcEligible ?? true));
    const charges = x.chargesPaise ?? 0;
    const landed = landedValues(result.lines.map((l, i) => ({ taxablePaise: l.taxablePaise, taxPaise: taxOf(l), itcEligible: itcEligible[i]! })), charges);
    const computed = result.totalPaise + charges;
    const roundOffPaise = x.billTotalPaise === undefined ? 0 : billRoundOff(computed, x.billTotalPaise);
    const itc = result.lines.reduce((h, l, i) => (itcEligible[i] ? addHeads(h, headsOf(l)) : h), ZERO);
    const totalPaise = computed + roundOffPaise;
    this.out.invoices.push({ ref: x.ref, kind: 'purchase', input, result });
    const pr: PurchaseResult = { ref: x.ref, landedPaise: landed.map((l) => l.landedValuePaise), itc, roundOffPaise, totalPaise };
    this.out.purchases.push(pr);
    this.purchases.set(x.ref, {
      p: x, lines: result.lines, landed: pr.landedPaise, charges: landed.map((l) => l.chargesPaise), itcEligible, roundOffPaise, returned: x.lines.map(() => 0),
    });
    this.journal(x.ref, x.date, buildJournal(PURCHASE_RULE, { supplierId: x.supplier.id, inventoryPaise: sum(pr.landedPaise, (v) => v), itc: taxHeads(itc), roundOffPaise, totalPaise }));
    result.lines.forEach((l, i) => this.inward.push({
      ...this.amounts(l), kind: 'purchase', docId: x.ref, docNumber: x.number, docDate: x.date, supplierName: x.supplier.name, supplierGstin: x.supplier.gstin ?? null,
      supplierInvoiceNo: x.supplierInvoiceNo, supplierInvoiceDate: x.date, supplyType: result.supplyType, taxTreatment: x.lines[i]!.item.treatment ?? 'taxable',
      supplierScheme: scheme, itcEligible: itcEligible[i]!,
    }));
  }

  private debitNote(x: DebitNote): void {
    const pu = this.purchases.get(x.purchaseRef)!;
    const parts = x.lines.map((r) => {
      const l = pu.lines[r.line]!;
      const whole = pu.p.lines[r.line]!.qtyMilli;
      const share = (amount: number) => cumulativeShare(amount, whole, pu.returned[r.line]!, r.qtyMilli);
      const heads: GstHeads = { igstPaise: share(l.igstPaise), cgstPaise: share(l.cgstPaise), sgstPaise: share(l.sgstPaise), cessPaise: share(l.cessPaise) };
      return { r, taxable: share(l.taxablePaise), heads, landed: share(pu.landed[r.line]!), charges: share(pu.charges[r.line]!), eligible: pu.itcEligible[r.line]! };
    });
    x.lines.forEach((r) => { pu.returned[r.line]! += r.qtyMilli; });
    const completes = pu.p.lines.every((l, i) => pu.returned[i] === l.qtyMilli);
    const chargesPaise = x.refundCharges ? sum(parts, (p) => p.charges) : 0;
    const roundOffPaise = completes ? pu.roundOffPaise : 0;
    const heads = parts.reduce((h, p) => addHeads(h, p.heads), ZERO);
    const itcReversed = parts.reduce((h, p) => (p.eligible ? addHeads(h, p.heads) : h), ZERO);
    const taxablePaise = sum(parts, (p) => p.taxable);
    const inventoryPaise = sum(parts, (p) => p.landed);
    const lossPaise = sum(parts, (p) => p.landed - p.taxable - (p.eligible ? 0 : taxOf(p.heads))) - chargesPaise;
    const totalPaise = taxablePaise + taxOf(heads) + chargesPaise + roundOffPaise;
    const res: DebitNoteResult = { ref: x.ref, purchaseRef: x.purchaseRef, taxablePaise, ...headsOf(heads), inventoryPaise, itcReversed, lossPaise, chargesPaise, roundOffPaise, totalPaise };
    this.out.debitNotes.push(res);
    this.journal(x.ref, x.date, buildJournal(DEBIT_NOTE_RULE, {
      supplierId: pu.p.supplier.id, totalPaise, inventoryPaise, itcReversed: taxHeads(itcReversed), lossPaise, roundOffPaise,
    }));
    parts.forEach((p) => this.inward.push({
      taxablePaise: p.taxable, ...p.heads, kind: 'debit_note', docId: x.ref, docNumber: x.number, docDate: x.date, supplierName: pu.p.supplier.name,
      supplierGstin: pu.p.supplier.gstin ?? null, supplierInvoiceNo: pu.p.supplierInvoiceNo, supplierInvoiceDate: pu.p.date,
      supplyType: this.out.invoices.find((i) => i.ref === x.purchaseRef)!.result.supplyType, taxTreatment: pu.p.lines[p.r.line]!.item.treatment ?? 'taxable',
      supplierScheme: pu.p.supplier.scheme ?? 'regular', itcEligible: p.eligible,
    }));
  }

  private expense(x: Expense): void {
    const gstin = x.vendor.gstin;
    let amounts = { taxablePaise: x.amountPaise, ...ZERO };
    let supplyType: InwardLine['supplyType'] = null;
    if (x.gstRateBp !== undefined && gstin) {
      const input: GstInvoiceInput = {
        docType: 'tax_invoice', supplierStateCode: gstin.slice(0, 2), placeOfSupplyStateCode: this.b.stateCode,
        isUnionTerritoryWithoutLegislature: isUtWithoutLegislature(this.b.stateCode), taxScheme: 'regular', billDiscount: NO_DISCOUNT, roundToRupee: false,
        b2clThresholdPaise: NO_B2CL, lines: [{
          qtyMilli: 1000, unitPricePaise: x.amountPaise, priceIsInclusive: x.inclusive ?? false, lineDiscount: NO_DISCOUNT, gstRateBp: x.gstRateBp,
          cessRateBp: 0, cessPerUnitPaise: 0, taxTreatment: 'taxable',
        }],
      };
      const result = computeInvoice(input);
      this.out.invoices.push({ ref: x.ref, kind: 'expense', input, result });
      amounts = this.amounts(result);
      supplyType = result.supplyType;
    }
    const tax = taxOf(amounts);
    const claimed = this.regular && !!gstin && (x.itcEligible ?? true) && tax > 0;
    const totalPaise = amounts.taxablePaise + tax;
    this.journal(x.ref, x.date, buildJournal(EXPENSE_RULE, {
      expenseAccount: { code: x.accountCode }, method: x.method, supplierId: x.method === 'credit' ? x.vendor.id : null,
      expensePaise: amounts.taxablePaise + (claimed ? 0 : tax), itc: claimed ? taxHeads(amounts) : taxHeads(ZERO), roundOffPaise: 0, totalPaise,
    }));
    this.inward.push({
      ...amounts, kind: 'expense', docId: x.ref, docNumber: x.number, docDate: x.date, supplierName: x.vendor.name, supplierGstin: gstin ?? null,
      supplierInvoiceNo: x.number, supplierInvoiceDate: x.date, supplyType, taxTreatment: 'taxable', supplierScheme: gstin ? 'regular' : 'unregistered', itcEligible: claimed,
    });
  }

  private setoff(date: string, challanDate: string): void {
    const { output, input } = taxBalances(this.out.journals, true);
    const result = computeSetoff(output, input);
    this.out.setoff = { liability: output, credit: input, result };
    const cashPaise = taxOf(result.cash);
    this.journal('SETOFF', date, buildJournal(GST_SETOFF_RULE, { liability: taxHeads(output), creditUsed: taxHeads(creditUsedBy(result.utilisation)), cashPaise }));
    if (cashPaise > 0) this.journal('CHALLAN', challanDate, buildJournal(GST_PAYMENT_RULE, { totalPaise: cashPaise }));
  }

  private yearEnd(fy: string): void {
    const net = balances(this.out.journals);
    const closing: ClosingBalance[] = [...net.entries()].flatMap(([code, netPaise]) => {
      const type = ACCOUNTS.get(code)!.type;
      return type === 'income' || type === 'expense' ? [{ code, type, netPaise }] : [];
    });
    this.journal(closingEntryNo(fy, 1), fyEndOf(fy), closingLines(closing));
  }

  private journal(ref: string, date: string, lines: readonly JournalLine[]): void {
    this.out.journals.push(posted(ref, date, lines));
  }
}

export const runScenario = (s: ScenarioInput): ScenarioResult => new ScenarioRun(s).run();

// "Dr 1100 1180.00" — the compact form HAND journals are typed in.
export const compactJournal = (j: PostedJournal): string[] =>
  j.lines.map((l) => `${l.side} ${l.code} ${(l.paise / 100).toFixed(2)}`);

// Reads `invoices.S1.result.totalPaise`: an array is indexed by its elements' `ref`, or by position.
export function valueAt(root: unknown, path: string): unknown {
  let v: unknown = root;
  for (const seg of path.split('.')) {
    if (Array.isArray(v)) v = /^\d+$/u.test(seg) ? v[Number(seg)] : v.find((x: { ref?: string }) => x.ref === seg);
    else v = (v as Record<string, unknown> | undefined)?.[seg];
  }
  return v;
}
