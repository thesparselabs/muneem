import { addDays, financialYearOf, fyBounds, monthStart, newUlid } from '@muneem/domain';
import { findUomByCode, stockState, type Db } from '@muneem/db-sqlite';
import {
  AllocateInput, CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, CustomerInput, ExpenseInput, ManualJournalInput, PaymentInput, ProductInput, PurchaseDraft, ReturnPurchaseInput,
  SaleDraft, SupplierInput, WriteOffInput, type ChargeRef, type TenderLine,
} from '@muneem/contracts';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill, testApp, type TestAppOptions } from '../helpers.js';

export interface SoakOptions {
  seed: number;
  days: number;
  salesPerDay: number;
  endDate: string;
  file: boolean;
  setTime: (ms: number) => void;
  appOptions?: Omit<TestAppOptions, 'file' | 'now'>;
  // 8d: set GST off before each month is locked, and close each year once its March is locked.
  yearEnd?: boolean;
}

export interface SoakCounts {
  sales: number; creditOverrides: number; creditNotes: number; cancelledSales: number; purchases: number; debitNotes: number; receipts: number; supplierPayments: number; allocations: number;
  expenses: number; stockDocuments: number; cashMovements: number; manualJournals: number; writeOffs: number;
  cancelledPayments: number; cancelledExpenses: number; cancelledPurchases: number; periodsLocked: number; backdated: number;
}

// A closed year's P&L and year-end Balance Sheet as they read just before it was closed.
export interface YearEndRecord { setoffs: number; closed: { fy: string; profitAndLoss: unknown; balanceSheet: unknown }[] }

export interface SoakRun {
  app: App; db: Db; businessId: string; startDate: string; endDate: string; monthEnds: string[]; counts: SoakCounts; yearEnd: YearEndRecord; elapsedMs: number;
}

// mulberry32: a small seeded generator, so the same seed makes the same documents.
export class Prng {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.next() * xs.length)]!; }
  sample<T>(xs: readonly T[], n: number): T[] {
    const pool = [...xs];
    return Array.from({ length: Math.min(n, pool.length) }, () => pool.splice(Math.floor(this.next() * pool.length), 1)[0]!);
  }
}

// Business dates follow the clock; each operation moves it on a second so documents never share a timestamp.
class SoakClock {
  private ms = 0;
  constructor(private readonly setTime: (ms: number) => void) {}

  startDay(date: string): void { this.set(new Date(`${date}T09:00:00`).getTime()); }
  tick(): void { this.set(this.ms + 1000); }
  now(): number { return this.ms; }
  private set(ms: number): void { this.ms = ms; this.setTime(ms); }
}

interface SoakProduct { id: string; costPaise: number; supplier: number; boxUomId?: string }
interface Shop { businessId: string; warehouseId: string; pcs: string; products: SoakProduct[]; suppliers: string[]; expenseVendor: string; customers: string[]; accounts: Map<string, string> }

const GST_RATES = [0, 500, 1200, 1800];
const SUPPLIERS = [
  { name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', taxScheme: 'regular', creditDays: 15 },
  { name: 'Bharat Wholesale', stateCode: '07', gstin: '07BBBBB0000B1Z5', taxScheme: 'regular', creditDays: 30 },
  { name: 'Mumbai Distributors', stateCode: '27', gstin: '27CCCCC0000C1Z5', taxScheme: 'regular', creditDays: 21 },
  { name: 'Gupta Kirana Supply', stateCode: '07', gstin: '07EEEEE0000E1Z5', taxScheme: 'composition', creditDays: 7 },
] as const;
const VENDOR_GSTINS = ['07DDDDD0000D1Z5', '09GGGGG0000G1Z5'];


class Trader {
  readonly counts: SoakCounts = {
    sales: 0, creditOverrides: 0, creditNotes: 0, cancelledSales: 0, purchases: 0, debitNotes: 0, receipts: 0, supplierPayments: 0, allocations: 0, expenses: 0, stockDocuments: 0,
    cashMovements: 0, manualJournals: 0, writeOffs: 0, cancelledPayments: 0, cancelledExpenses: 0, cancelledPurchases: 0, periodsLocked: 0, backdated: 0,
  };
  private readonly purchases: string[] = [];
  private readonly sales: string[] = [];
  private readonly creditSales: string[] = [];
  private readonly returned = new Set<string>();
  private readonly payments: string[] = [];
  private readonly expenses: string[] = [];
  private invoiceNo = 0;
  private clearingPaise = 0;
  private today = '';
  private dayNo = 0;
  private overrideDue = false;
  readonly yearEnd: YearEndRecord = { setoffs: 0, closed: [] };

  constructor(private readonly app: App, private readonly db: Db, private readonly shop: Shop, private readonly rng: Prng, private readonly clock: SoakClock,
    private readonly salesPerDay: number, private readonly startDate: string, private readonly closesYears = false) {}

  private get unitsPerProductPerDay(): number { return Math.max(1, Math.ceil((this.salesPerDay * 5) / this.shop.products.length)); }

  openingDay(date: string): void {
    this.today = date;
    const stocked = this.shop.products.slice(0, -1);
    this.app.inventory.setOpeningStock({ note: 'Opening count', lines: stocked.map((p) => ({ productId: p.id, qtyMilli: this.unitsPerProductPerDay * 8 * 1000, unitCostPaise: p.costPaise })) });
    this.counts.stockDocuments++;
    this.shop.customers.forEach((id, i) => {
      if (i % 3 === 0) this.app.customerLedger.setOpening({ partyId: id, amountPaise: this.rng.int(5, 40) * 1000, asOfDate: date });
      if (i === 4) this.app.customerLedger.setOpening({ partyId: id, side: 'payable', amountPaise: 25_000, asOfDate: date });
      this.clock.tick();
    });
    this.shop.suppliers.forEach((id, i) => {
      this.app.supplierLedger.setOpening({ partyId: id, ...(i === 3 && { side: 'receivable' as const }), amountPaise: this.rng.int(20, 200) * 1000, asOfDate: date });
      this.clock.tick();
    });
  }

  async day(date: string, previous: string | null): Promise<void> {
    this.today = date;
    this.dayNo++;
    this.overrideDue = this.dayNo % 5 === 0;
    this.clock.startDay(date);
    if (previous && monthStart(previous) !== monthStart(date)) this.monthEnd(previous);
    const opened = this.app.register.open(this.rng.int(20, 50) * 10_000);
    this.clock.tick();
    this.settleClearing();
    this.restock();
    const half = Math.floor(this.salesPerDay / 2);
    for (let i = 0; i < half; i++) this.sell();
    this.receipts();
    this.supplierPayments();
    this.spend();
    this.returnGoods();
    this.takeBack();
    this.stockWork();
    this.occasional();
    for (let i = half; i < this.salesPerDay; i++) this.sell();
    this.closeRegister(opened.id);
    await new Promise((r) => setImmediate(r));
  }

  private step<T>(fn: () => T): T {
    const r = fn();
    this.clock.tick();
    return r;
  }

  private monthEnd(lastDay: string): void {
    const period = monthStart(lastDay);
    if (this.closesYears) {
      this.step(() => this.app.gst.setoffs.post({ month: period, commandId: newUlid() }));
      this.yearEnd.setoffs++;
    }
    this.step(() => this.app.periods.lock(period));
    this.counts.periodsLocked++;
    if (this.closesYears && period.slice(5, 7) === '03') this.closeYear(financialYearOf(lastDay));
    const backDate = [`${lastDay.slice(0, 8)}20`, lastDay, this.startDate].filter((d) => d >= this.startDate && d <= lastDay)[0]!;
    const customer = this.rng.pick(this.shop.customers);
    this.payments.push(this.step(() => this.app.payments.create(PaymentInput.parse({
      partyType: 'customer', partyId: customer, amountPaise: this.rng.int(10, 50) * 100, method: 'bank', paymentDate: backDate, reference: 'NEFT late entry', commandId: newUlid(),
    }))).id);
    const category = this.rng.pick(this.app.expenses.categories());
    this.expenses.push(this.step(() => this.app.expenses.create(ExpenseInput.parse({
      categoryId: category.id, method: 'bank', amountPaise: this.rng.int(50, 300) * 100, expenseDate: backDate, description: 'Bill found late', commandId: newUlid(),
    }))).id);
    this.buy(2, this.rng.sample(this.shop.products.filter((p) => p.supplier === 2), 2), lastDay);
    this.counts.receipts++;
    this.counts.expenses++;
    this.counts.backdated += 3;
  }

  private closeYear(fy: string): void {
    for (const m of this.app.yearEnd.list().find((y) => y.fy === fy)!.months) if (m.status === 'open') this.step(() => this.app.periods.lock(m.month));
    const { start, end } = fyBounds(fy);
    this.yearEnd.closed.push({ fy, profitAndLoss: this.app.statements.profitAndLoss({ from: start, to: end }), balanceSheet: this.app.statements.balanceSheet({ asOf: end }) });
    this.step(() => this.app.yearEnd.close(fy));
  }

  private sell(): void {
    const n = this.rng.int(1, 4);
    const lines = this.rng.sample(this.shop.products, n).map((p) => p.boxUomId && this.rng.chance(0.2)
      ? { productId: p.id, uomId: p.boxUomId, qtyMilli: 1000 }
      : { productId: p.id, uomId: this.shop.pcs, qtyMilli: this.rng.int(1, 3) * 1000 });
    const kind = this.rng.next();
    const customerId = kind >= 0.8 || this.rng.chance(0.1) ? this.rng.pick(this.shop.customers) : undefined;
    const draft = SaleDraft.parse({ lines, ...(customerId && { customerId }) });
    const quote = this.app.sales.quote(draft);
    const total = quote.totals.totalPaise;
    const tenders = this.tenders(kind, total, quote.credit?.availablePaise);
    if (tenders.some((t) => t.method === 'credit') && tenders.reduce((s, t) => s + (t.method === 'credit' ? t.amountPaise : 0), 0) > (quote.credit?.availablePaise ?? 0)) {
      this.counts.creditOverrides++;
    }
    const { saleId } = this.step(() => this.app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders })));
    (tenders.some((t) => t.method === 'credit') ? this.creditSales : this.sales).push(saleId);
    this.clearingPaise += tenders.filter((t) => t.method === 'upi' || t.method === 'card').reduce((s, t) => s + t.amountPaise, 0);
    this.counts.sales++;
  }

  private tenders(kind: number, total: number, availablePaise: number | undefined): TenderLine[] {
    const cashGiven = Math.ceil(total / 10_000) * 10_000 + (this.rng.chance(0.3) ? 10_000 : 0);
    if (kind < 0.45 || total < 200) return [{ method: 'cash', amountPaise: cashGiven }];
    if (kind < 0.65) return [{ method: this.rng.chance(0.8) ? 'upi' : 'card', amountPaise: total }];
    const cashPart = this.rng.int(1, Math.max(1, Math.floor(total / 100) - 1)) * 100;
    if (kind < 0.8) return [{ method: 'cash', amountPaise: Math.min(cashPart, total - 1) }, { method: this.rng.pick(['upi', 'card', 'other'] as const), amountPaise: total - Math.min(cashPart, total - 1) }];
    if (availablePaise === undefined) return [{ method: 'cash', amountPaise: cashGiven }];
    if (this.overrideDue || this.rng.chance(0.03)) {
      this.overrideDue = false;
      return [{ method: 'credit', amountPaise: total }];
    }
    if (availablePaise >= total) return this.rng.chance(0.6) ? [{ method: 'credit', amountPaise: total }] : [{ method: 'cash', amountPaise: total - Math.floor(total / 2) }, { method: 'credit', amountPaise: Math.floor(total / 2) }];
    if (availablePaise > 0) return [{ method: 'cash', amountPaise: total - availablePaise }, { method: 'credit', amountPaise: availablePaise }];
    return [{ method: 'upi', amountPaise: total }];
  }

  private stockOf(productId: string): number {
    return stockState(this.db, this.shop.businessId, this.shop.warehouseId, productId).qtyMilli;
  }

  private restock(): void {
    const unit = this.unitsPerProductPerDay;
    const low = this.shop.products.filter((p) => this.stockOf(p.id) < unit * 4 * 1000);
    const bySupplier = new Map<number, SoakProduct[]>();
    for (const p of low) bySupplier.set(p.supplier, [...(bySupplier.get(p.supplier) ?? []), p]);
    for (const [s, products] of [...bySupplier.entries()].sort((a, b) => a[0] - b[0])) {
      const invoiceDate = this.rng.chance(0.2) ? this.notBefore(addDays(this.today, -this.rng.int(1, 3))) : this.today;
      if (monthStart(invoiceDate) !== monthStart(this.today)) this.counts.backdated++;
      this.buy(s, products, invoiceDate);
    }
  }

  private notBefore(date: string): string { return date < this.startDate ? this.startDate : date; }

  private buy(s: number, products: SoakProduct[], invoiceDate: string): void {
    const regular = SUPPLIERS[s]!.taxScheme === 'regular';
    const lines = products.map((p) => {
      const qty = this.unitsPerProductPerDay * this.rng.int(8, 12);
      const box = p.boxUomId && this.rng.chance(0.5);
      return {
        productId: p.id, uomId: box ? p.boxUomId! : this.shop.pcs, qtyMilli: box ? Math.ceil(qty / 12) * 1000 : qty * 1000,
        unitPricePaise: Math.round(p.costPaise * (box ? 12 : 1) * (0.95 + this.rng.next() * 0.1)),
        ...(regular && this.rng.chance(0.07) && { itcEligible: false }),
      };
    });
    const draft = {
      supplierId: this.shop.suppliers[s]!, supplierInvoiceNo: `INV-${s}-${++this.invoiceNo}`, supplierInvoiceDate: invoiceDate, lines,
      charges: this.rng.chance(0.5) ? [{ kind: 'freight' as const, amountPaise: this.rng.int(5, 40) * 1000 }] : [],
    };
    const quoted = this.app.purchases.quote(PurchaseDraft.parse(draft));
    const billTotalPaise = quoted.totals.computedTotalPaise + (this.rng.chance(0.3) ? this.rng.int(-60, 60) : 0);
    const p = this.step(() => this.app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise, commandId: newUlid() })));
    this.purchases.push(p.id);
    this.counts.purchases++;
  }

  private receipts(): void {
    const n = Math.max(1, Math.round(this.salesPerDay / 25));
    for (let i = 0; i < n; i++) {
      const customer = this.rng.pick(this.shop.customers);
      const { charges } = this.app.payments.openItems('customer', customer);
      const open = charges.reduce((s, c) => s + c.openPaise, 0);
      if (open === 0 && !this.rng.chance(0.1)) continue;
      const method = this.rng.pick<PaymentInput['method']>(['cash', 'cash', 'upi', 'bank', 'cheque']);
      const mode = this.rng.next();
      const chosen = charges.length > 0 && mode < 0.2 ? this.rng.pick(charges) : null;
      const amountPaise = chosen ? chosen.openPaise
        : open === 0 ? 5000
          : mode < 0.8 ? Math.max(100, Math.round(open * (0.3 + this.rng.next() * 0.7))) : open + this.rng.int(1, 20) * 100;
      const allocation: ChargeRef[] | 'auto' = chosen ? [{ type: chosen.type as ChargeRef['type'], id: chosen.id, amountPaise }] : 'auto';
      this.payments.push(this.step(() => this.app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: customer, amountPaise, method, allocation, commandId: newUlid() }))).id);
      this.counts.receipts++;
    }
    if (this.dayNo % 3 === 0) this.applyCredit();
  }

  private applyCredit(): void {
    for (const customer of this.shop.customers) {
      const items = this.app.payments.openItems('customer', customer);
      const credit = items.credits.find((c) => c.type === 'payment' || c.type === 'opening' || c.type === 'debit_note');
      if (!credit || items.charges.length === 0) continue;
      this.step(() => this.app.payments.allocate(AllocateInput.parse({ partyType: 'customer', partyId: customer, creditType: credit.type, creditId: credit.id, allocation: 'auto' })));
      this.counts.allocations++;
      return;
    }
  }

  private supplierPayments(): void {
    for (const supplier of [...this.shop.suppliers, this.shop.expenseVendor]) {
      const due = this.app.payments.openItems('supplier', supplier).charges.filter((c) => c.dueDate <= this.today);
      if (due.length === 0) continue;
      const chosen = this.rng.chance(0.2) ? this.rng.pick(due) : null;
      const amountPaise = chosen ? chosen.openPaise : due.reduce((s, c) => s + c.openPaise, 0);
      const method: PaymentInput['method'] = amountPaise < 50_000 && this.rng.chance(0.5) ? 'cash' : this.rng.pick(['bank', 'bank', 'cheque', 'upi']);
      const allocation: ChargeRef[] | 'auto' = chosen ? [{ type: chosen.type as ChargeRef['type'], id: chosen.id, amountPaise }] : 'auto';
      this.payments.push(this.step(() => this.app.payments.create(PaymentInput.parse({ partyType: 'supplier', partyId: supplier, amountPaise, method, allocation, commandId: newUlid() }))).id);
      this.counts.supplierPayments++;
    }
  }

  private spend(): void {
    const categories = this.app.expenses.categories();
    const n = this.rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const category = this.rng.pick(categories);
      const kind = this.rng.next();
      const base = { categoryId: category.id, commandId: newUlid() };
      const input = kind < 0.5 ? { ...base, method: 'cash', amountPaise: this.rng.int(20, 300) * 100, description: 'Tea and sundries' }
        : kind < 0.8 ? { ...base, method: this.rng.pick(['bank', 'upi', 'card']), amountPaise: this.rng.int(500, 5000) * 100, gstRateBp: this.rng.pick([500, 1200, 1800]),
          vendorGstin: this.rng.pick(VENDOR_GSTINS), vendorName: 'Service vendor', ...(this.rng.chance(0.2) && { itcEligible: false }) }
          : { ...base, method: 'credit', supplierId: this.shop.expenseVendor, amountPaise: this.rng.int(200, 3000) * 100, ...(this.rng.chance(0.6) && { gstRateBp: 1800 }) };
      this.expenses.push(this.step(() => this.app.expenses.create(ExpenseInput.parse(input))).id);
      this.counts.expenses++;
    }
  }

  private returnGoods(): void {
    if (!this.rng.chance(0.5) || this.purchases.length === 0) return;
    const p = this.app.purchases.get(this.rng.pick(this.purchases.slice(-20)));
    if (p.status !== 'posted') return;
    const line = p.lines.find((l) => l.qtyMilli - l.returnedQtyMilli >= 1000);
    if (!line) return;
    const left = (line.qtyMilli - line.returnedQtyMilli) / 1000;
    const qtyMilli = this.rng.int(1, Math.max(1, Math.floor(left / 3))) * 1000;
    this.step(() => this.app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({
      purchaseId: p.id, reason: 'damaged in transit', refundCharges: this.rng.chance(0.2), commandId: newUlid(), lines: [{ purchaseItemId: line.id, qtyMilli }],
    })));
    this.returned.add(p.id);
    this.counts.debitNotes++;
  }

  // ADR-0043: now and then a customer brings part of a recent bill back, and once in a while a bill is cancelled whole.
  private takeBack(): void {
    if (this.dayNo % 6 === 5) {
      const saleId = this.sales.at(-1);
      if (!saleId || this.app.returns.list({ saleId, limit: 1 }).items.length > 0) return;
      this.step(() => this.app.returns.cancel({ saleId, reason: 'billed by mistake' }));
      this.counts.cancelledSales++;
      this.counts.creditNotes++;
      return;
    }
    const pool = this.dayNo % 3 === 0 && this.creditSales.length > 0 ? this.creditSales : this.sales;
    if (!this.rng.chance(0.4) || pool.length === 0) return;
    const saleId = this.rng.pick(pool.slice(-15));
    const line = this.app.returns.quote({ saleId, lines: [{ lineNo: 1, qtyMilli: 1 }] }).lines.find((l) => l.returnableQtyMilli >= 1000);
    if (!line) return;
    const draft = { saleId, lines: [{ lineNo: line.lineNo, qtyMilli: 1000 }] };
    const quote = this.app.returns.quote(draft);
    if (quote.totalPaise <= 0) return;
    this.step(() => this.app.returns.complete(CompleteReturnInput.parse({ ...draft, commandId: newUlid(), reason: 'damaged pack', expectedTotalPaise: quote.totalPaise })));
    this.counts.creditNotes++;
  }

  private stockWork(): void {
    if (this.rng.chance(0.3)) {
      const p = this.rng.pick(this.shop.products);
      const gain = this.rng.chance(0.2);
      this.step(() => this.app.inventory.adjust({ lines: [{ productId: p.id, qtyMilli: gain ? 1000 : -this.rng.int(1, 3) * 1000, reason: gain ? 'counting_error' : this.rng.pick(['damage', 'theft', 'expiry'] as const) }] }));
      this.counts.stockDocuments++;
    }
    if (this.rng.chance(1 / 7)) {
      const counts = this.rng.sample(this.shop.products, 3).map((p) => ({ productId: p.id, countedMilli: Math.max(0, this.stockOf(p.id) + this.rng.int(-2, 2) * 1000) }));
      this.step(() => this.app.inventory.stockTake({ counts, note: 'Shelf count' }));
      this.counts.stockDocuments++;
    }
    if (this.rng.chance(0.25)) {
      const out = this.rng.chance(0.6);
      this.step(() => this.app.register.cashMovement({ kind: out ? 'cash_out' : 'cash_in', amountPaise: this.rng.int(5, 50) * 100, reason: out ? 'Petty cash' : 'Change from bank' }));
      this.counts.cashMovements++;
    }
  }

  private occasional(): void {
    if (this.dayNo % 4 === 1) this.cancelPayment();
    if (this.dayNo % 4 === 2) this.cancelExpense();
    if (this.dayNo % 5 === 3) this.cancelPurchase();
    if (this.dayNo % 6 === 4) this.writeOff();
    if (this.dayNo % 7 === 0) this.drawings();
  }

  private recent<T>(ids: readonly string[], load: (id: string) => T, eligible: (x: T) => boolean): T | undefined {
    return this.rng.sample(ids.slice(-30), 30).map(load).find(eligible);
  }

  private cancelPayment(): void {
    const p = this.recent(this.payments, (id) => this.app.payments.get(id), (x) => x.status === 'posted');
    if (!p) return;
    this.step(() => this.app.payments.cancel(p.id, 'cheque bounced'));
    this.counts.cancelledPayments++;
  }

  private cancelExpense(): void {
    const e = this.recent(this.expenses, (id) => this.app.expenses.get(id), (x) => x.status === 'posted' && x.settledPaise === 0);
    if (!e) return;
    this.step(() => this.app.expenses.cancel(e.id, 'entered twice'));
    this.counts.cancelledExpenses++;
  }

  private cancelPurchase(): void {
    const p = this.recent(this.purchases, (id) => this.app.purchases.get(id), (x) => x.status === 'posted' && x.settledPaise === 0 && !this.returned.has(x.id));
    if (!p) return;
    this.step(() => this.app.purchaseReturns.cancel(p.id, 'wrong supplier'));
    this.counts.cancelledPurchases++;
  }

  private writeOff(): void {
    for (const customer of this.rng.sample(this.shop.customers, this.shop.customers.length)) {
      const charge = this.app.payments.openItems('customer', customer).charges.find((c) => c.type === 'opening' || c.type === 'sale');
      if (!charge) continue;
      const amountPaise = Math.min(charge.openPaise, this.rng.int(5, 50) * 100);
      this.step(() => this.app.writeOffs.create(WriteOffInput.parse({
        customerId: customer, items: [{ type: charge.type, id: charge.id, amountPaise }], reason: 'not recoverable', commandId: newUlid(),
      })));
      this.counts.writeOffs++;
      return;
    }
  }

  private settleClearing(): void {
    if (this.clearingPaise === 0) return;
    const chargesPaise = Math.floor(this.clearingPaise / 100);
    this.journal('Card/UPI settlement', [['1200', this.clearingPaise - chargesPaise, 0], ['5460', chargesPaise, 0], ['1250', 0, this.clearingPaise]]);
    this.clearingPaise = 0;
  }

  private drawings(): void {
    const amount = this.rng.int(10, 100) * 100;
    this.journal('Owner drawings', [['3200', amount, 0], ['1100', 0, amount]]);
  }

  private journal(narration: string, lines: [code: string, debitPaise: number, creditPaise: number][]): void {
    this.step(() => this.app.manualJournals.post(ManualJournalInput.parse({
      narration, commandId: newUlid(), lines: lines.filter(([, d, c]) => d + c > 0).map(([code, debitPaise, creditPaise]) => ({ accountId: this.shop.accounts.get(code)!, debitPaise, creditPaise })),
    })));
    this.counts.manualJournals++;
  }

  private closeRegister(sessionId: string): void {
    const expected = this.app.register.xReport().expectedCashPaise ?? 0;
    this.step(() => this.app.register.close({ countedCashPaise: Math.max(0, expected + this.rng.int(-300, 300)) }));
    if (this.app.register.current()?.id === sessionId) throw new Error('the register did not close');
  }
}

async function setUpShop(app: App, db: Db, rng: Prng): Promise<Shop> {
  const { businessId } = await ownerAtTill(app);
  await caller(app).data('printer.setConfig', { kind: 'none' });
  const pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const box = findUomByCode(db, businessId, 'BOX')!.id;
  const products = Array.from({ length: 36 }, (_, i): SoakProduct => {
    const gstRateBp = GST_RATES[i % 4]!;
    const sellingPricePaise = rng.int(20, 500) * 100;
    const costPaise = Math.round((sellingPricePaise * 10_000) / (10_000 + gstRateBp) * 0.7);
    const withBox = i === 5;
    const p = app.products.create(ProductInput.parse({
      name: `Soak item ${i + 1}`, sku: `SK${i + 1}`, baseUomId: pcs, gstRateBp, sellingPricePaise, purchasePricePaise: costPaise, priceIsInclusive: true,
      ...(withBox && { conversions: [{ fromUomId: box, factorMilli: 12_000 }] }),
    }));
    return { id: p.id, costPaise, supplier: i % 4, ...(withBox && { boxUomId: box }) };
  });
  const suppliers = SUPPLIERS.map((s) => app.suppliers.create(SupplierInput.parse(s)).id);
  const expenseVendor = app.suppliers.create(SupplierInput.parse({ name: 'City Power & Services', stateCode: '07', gstin: '07FFFFF0000F1Z5', creditDays: 10 })).id;
  const customers = Array.from({ length: 10 }, (_, i) => {
    const c = app.customers.create(CustomerInput.parse({ name: `Customer ${i + 1}`, creditDays: [7, 15, 30][i % 3] }));
    return app.customers.setCreditLimit({ id: c.id, version: c.version, limitPaise: rng.int(5, 50) * 10_000 }).id;
  });
  const accounts = new Map(app.statements.accounts().map((a) => [a.code, a.id]));
  return { businessId, warehouseId: app.inventory.warehouseId(), pcs, products, suppliers, expenseVendor, customers, accounts };
}

export async function runSoak(opts: SoakOptions): Promise<SoakRun> {
  const t0 = performance.now();
  const startDate = addDays(opts.endDate, -(opts.days - 1));
  const clock = new SoakClock(opts.setTime);
  clock.startDay(startDate);
  const { app, db } = await testApp({ ...opts.appOptions, file: opts.file, now: () => clock.now() });
  const rng = new Prng(opts.seed);
  const shop = await setUpShop(app, db, rng);
  const trader = new Trader(app, db, shop, rng, clock, opts.salesPerDay, startDate, opts.yearEnd ?? false);
  trader.openingDay(startDate);
  const monthEnds: string[] = [];
  let previous: string | null = null;
  for (let d = 0; d < opts.days; d++) {
    const date = addDays(startDate, d);
    if (previous && monthStart(previous) !== monthStart(date)) monthEnds.push(previous);
    await trader.day(date, previous);
    previous = date;
  }
  return { app, db, businessId: shop.businessId, startDate, endDate: opts.endDate, monthEnds, counts: trader.counts, yearEnd: trader.yearEnd, elapsedMs: performance.now() - t0 };
}
