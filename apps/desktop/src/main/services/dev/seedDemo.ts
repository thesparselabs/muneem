import { addDays, newUlid } from '@muneem/domain';
import {
  CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, CustomerInput, ExpenseInput, ManualJournalInput, PaymentInput, ProductInput, PurchaseDraft, SaleDraft, SupplierInput,
  type DemoSeedSummary, type TenderLine,
} from '@muneem/contracts';
import type { App } from '../../app.js';

export type SeedApp = Pick<App, 'catalog' | 'products' | 'customers' | 'suppliers' | 'customerLedger' | 'supplierLedger' | 'inventory' | 'register' | 'sales' | 'returns' | 'purchases' | 'payments' | 'expenses' | 'manualJournals' | 'statements'>;
export type SeedResult = DemoSeedSummary;

interface Item { name: string; category: string; brand: string; uom: 'PCS' | 'KG' | 'L'; gstRateBp: number; pricePaise: number; hsn: string }
interface Stocked { id: string; uomId: string; kind: Item['uom']; costPaise: number; supplier: number }

const CATEGORIES = ['Groceries', 'Beverages', 'Snacks', 'Personal Care', 'Household'] as const;
const ITEMS: readonly Item[] = [
  { name: 'Basmati Rice 1kg', category: 'Groceries', brand: 'India Gate', uom: 'KG', gstRateBp: 500, pricePaise: 14_500, hsn: '1006' },
  { name: 'Whole Wheat Atta 5kg', category: 'Groceries', brand: 'Aashirvaad', uom: 'PCS', gstRateBp: 0, pricePaise: 26_500, hsn: '1101' },
  { name: 'Toor Dal 1kg', category: 'Groceries', brand: 'Tata Sampann', uom: 'KG', gstRateBp: 0, pricePaise: 16_800, hsn: '0713' },
  { name: 'Sugar 1kg', category: 'Groceries', brand: 'Madhur', uom: 'KG', gstRateBp: 500, pricePaise: 4_800, hsn: '1701' },
  { name: 'Sunflower Oil 1L', category: 'Groceries', brand: 'Fortune', uom: 'L', gstRateBp: 500, pricePaise: 14_200, hsn: '1512' },
  { name: 'Iodised Salt 1kg', category: 'Groceries', brand: 'Tata', uom: 'PCS', gstRateBp: 0, pricePaise: 2_800, hsn: '2501' },
  { name: 'Masala Tea 250g', category: 'Beverages', brand: 'Tata Tea', uom: 'PCS', gstRateBp: 500, pricePaise: 12_000, hsn: '0902' },
  { name: 'Instant Coffee 100g', category: 'Beverages', brand: 'Nescafe', uom: 'PCS', gstRateBp: 1800, pricePaise: 31_000, hsn: '2101' },
  { name: 'Cola 750ml', category: 'Beverages', brand: 'Coca-Cola', uom: 'PCS', gstRateBp: 2800, pricePaise: 4_000, hsn: '2202' },
  { name: 'Orange Juice 1L', category: 'Beverages', brand: 'Real', uom: 'PCS', gstRateBp: 1200, pricePaise: 11_000, hsn: '2009' },
  { name: 'Potato Chips 52g', category: 'Snacks', brand: 'Lays', uom: 'PCS', gstRateBp: 1200, pricePaise: 2_000, hsn: '2005' },
  { name: 'Chocolate Bar 40g', category: 'Snacks', brand: 'Cadbury', uom: 'PCS', gstRateBp: 1800, pricePaise: 4_500, hsn: '1806' },
  { name: 'Glucose Biscuits 200g', category: 'Snacks', brand: 'Parle', uom: 'PCS', gstRateBp: 1800, pricePaise: 3_000, hsn: '1905' },
  { name: 'Instant Noodles 70g', category: 'Snacks', brand: 'Maggi', uom: 'PCS', gstRateBp: 1200, pricePaise: 1_400, hsn: '1902' },
  { name: 'Bath Soap 100g', category: 'Personal Care', brand: 'Dove', uom: 'PCS', gstRateBp: 1800, pricePaise: 6_500, hsn: '3401' },
  { name: 'Shampoo 340ml', category: 'Personal Care', brand: 'Clinic Plus', uom: 'PCS', gstRateBp: 1800, pricePaise: 21_000, hsn: '3305' },
  { name: 'Toothpaste 150g', category: 'Personal Care', brand: 'Colgate', uom: 'PCS', gstRateBp: 1800, pricePaise: 10_500, hsn: '3306' },
  { name: 'Detergent Powder 1kg', category: 'Household', brand: 'Surf Excel', uom: 'PCS', gstRateBp: 1800, pricePaise: 12_500, hsn: '3402' },
  { name: 'Dishwash Liquid 500ml', category: 'Household', brand: 'Vim', uom: 'PCS', gstRateBp: 1800, pricePaise: 11_500, hsn: '3402' },
  { name: 'LED Bulb 9W', category: 'Household', brand: 'Philips', uom: 'PCS', gstRateBp: 1200, pricePaise: 8_500, hsn: '8539' },
];

const SUPPLIERS = [
  { name: 'Sharma Wholesale Mart', stateCode: '07', gstin: '07AAGCS1234A1Z5', taxScheme: 'regular', creditDays: 15, city: 'Delhi' },
  { name: 'Bharat FMCG Distributors', stateCode: '07', gstin: '07AABCB5678B1Z3', taxScheme: 'regular', creditDays: 30, city: 'Delhi' },
  { name: 'Mumbai Beverages Co', stateCode: '27', gstin: '27AAACM4321C1Z8', taxScheme: 'regular', creditDays: 21, city: 'Mumbai' },
  { name: 'Gupta Kirana Supply', stateCode: '07', taxScheme: 'unregistered', creditDays: 7, city: 'Delhi' },
  { name: 'Verma Household Traders', stateCode: '09', gstin: '09AAHCV9876D1Z2', taxScheme: 'regular', creditDays: 10, city: 'Noida' },
] as const;

const CUSTOMERS = [
  { name: 'Ramesh Kumar', phone: '9810011001', creditDays: 15, limitRupees: 10_000, openingRupees: 2_400 },
  { name: 'Sunita Devi', phone: '9810011002', creditDays: 7, limitRupees: 5_000, openingRupees: 0 },
  { name: 'Anil Traders', phone: '9810011003', creditDays: 30, limitRupees: 50_000, openingRupees: 12_500 },
  { name: 'Priya Singh', phone: '9810011004', creditDays: 0, limitRupees: 3_000, openingRupees: 0 },
  { name: 'Hotel Saffron', phone: '9810011005', creditDays: 30, limitRupees: 40_000, openingRupees: 0 },
  { name: 'Mohd. Iqbal', phone: '9810011006', creditDays: 15, limitRupees: 8_000, openingRupees: 800 },
] as const;

const EXPENSES = [
  { category: 'RENT', method: 'bank', rupees: 18_000, text: 'Shop rent', ago: 18 },
  { category: 'POWER', method: 'upi', rupees: 3_450, text: 'Electricity bill', ago: 14, gst: 1800 },
  { category: 'SALARY', method: 'bank', rupees: 22_000, text: 'Staff salary', ago: 12 },
  { category: 'TRANSPORT', method: 'cash', rupees: 650, text: 'Delivery tempo', ago: 9 },
  { category: 'REPAIRS', method: 'cash', rupees: 1_200, text: 'Shelf repair', ago: 7 },
  { category: 'INTERNET', method: 'upi', rupees: 799, text: 'Internet and phone', ago: 5, gst: 1800 },
  { category: 'OTHER', method: 'cash', rupees: 420, text: 'Stationery and bags', ago: 3 },
  { category: 'BANK', method: 'cash', rupees: 300, text: 'Bank charges', ago: 1 },
] as const;

class Rng {
  constructor(private state: number) {}
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

const rupees = (n: number): number => n * 100;
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

class DemoSeeder {
  readonly result: SeedResult = { products: 0, parties: 0, sales: 0, purchases: 0, payments: 0, expenses: 0, returns: 0, adjustments: 0, journals: 0, errors: [] };
  private readonly rng = new Rng(Date.now() >>> 0);
  private readonly tag = Date.now().toString(36).slice(-4).toUpperCase();
  private stocked: Stocked[] = [];
  private suppliers: string[] = [];
  private customers: string[] = [];
  private readonly cashSales: string[] = [];

  constructor(private readonly app: SeedApp, private readonly today: string) {}

  run(): SeedResult {
    this.attempt('products', () => this.createProducts());
    this.attempt('suppliers', () => this.createSuppliers());
    this.attempt('customers', () => this.createCustomers());
    this.attempt('opening stock', () => this.openingStock());
    this.attempt('register', () => { if (!this.app.register.current()) this.app.register.open(rupees(5_000)); });
    this.attempt('purchases', () => this.purchases());
    this.attempt('sales', () => this.sales());
    this.attempt('receipts', () => this.receipts());
    this.attempt('supplier payments', () => this.supplierPayments());
    this.attempt('expenses', () => this.expenses());
    this.attempt('returns', () => this.returns());
    this.attempt('stock adjustment', () => this.adjustment());
    this.attempt('stock take', () => this.stockTake());
    this.attempt('manual journal', () => this.journal());
    return this.result;
  }

  private attempt<T>(label: string, fn: () => T): T | undefined {
    try { return fn(); } catch (e) {
      if (this.result.errors.length < 20) this.result.errors.push(`${label}: ${message(e)}`);
      return undefined;
    }
  }

  private named<T extends { id: string; name: string }>(list: T[], name: string, create: () => T): T {
    return list.find((x) => x.name === name) ?? create();
  }

  private createProducts(): void {
    const { catalog, products } = this.app;
    const uoms = new Map(catalog.listUoms().map((u) => [u.code, u.id]));
    const categories = new Map<string, string>(CATEGORIES.map((name) => [name, this.named(catalog.listCategories(), name, () => catalog.createCategory({ name, parentId: null })).id]));
    const brands = new Map<string, string>();
    for (const b of new Set(ITEMS.map((i) => i.brand))) brands.set(b, this.named(catalog.listBrands(), b, () => catalog.createBrand({ name: b })).id);
    ITEMS.forEach((item, i) => this.attempt(`product ${item.name}`, () => {
      const costPaise = Math.round(((item.pricePaise * 10_000) / (10_000 + item.gstRateBp)) * 0.72);
      const uomId = uoms.get(item.uom)!;
      const p = products.create(ProductInput.parse({
        name: item.name, sku: `${this.tag}-${String(i + 1).padStart(2, '0')}`, hsnCode: item.hsn, categoryId: categories.get(item.category), brandId: brands.get(item.brand), baseUomId: uomId,
        gstRateBp: item.gstRateBp, sellingPricePaise: item.pricePaise, mrpPaise: Math.round(item.pricePaise * 1.05), purchasePricePaise: costPaise, priceIsInclusive: true, reorderLevelMilli: 10_000,
      }));
      this.stocked.push({ id: p.id, uomId, kind: item.uom, costPaise, supplier: i % SUPPLIERS.length });
      this.result.products++;
    }));
  }

  private createSuppliers(): void {
    for (const s of SUPPLIERS) {
      const created = this.attempt(`supplier ${s.name}`, () => this.createSupplier(s));
      if (created) { this.suppliers.push(created); this.result.parties++; }
    }
    this.suppliers.forEach((id, i) => {
      if (i === 0 || i === 2) this.attempt('supplier opening', () => this.app.supplierLedger.setOpening({ partyId: id, amountPaise: rupees(i === 0 ? 15_000 : 8_500), asOfDate: addDays(this.today, -30) }));
    });
  }

  private createSupplier(s: (typeof SUPPLIERS)[number]): string {
    try { return this.app.suppliers.create(SupplierInput.parse(s)).id; } catch {
      const withoutGstin = { ...s } as typeof s & { gstin?: string };
      delete withoutGstin.gstin;
      return this.app.suppliers.create(SupplierInput.parse({ ...withoutGstin, taxScheme: 'unregistered' })).id;
    }
  }

  private createCustomers(): void {
    for (const c of CUSTOMERS) {
      const id = this.attempt(`customer ${c.name}`, () => {
        const made = this.app.customers.create(CustomerInput.parse({ name: c.name, phone: c.phone, creditDays: c.creditDays, city: 'Delhi', stateCode: '07' }));
        this.app.customers.setCreditLimit({ id: made.id, version: made.version, limitPaise: rupees(c.limitRupees) });
        if (c.openingRupees > 0) this.app.customerLedger.setOpening({ partyId: made.id, amountPaise: rupees(c.openingRupees), asOfDate: addDays(this.today, -30) });
        return made.id;
      });
      if (id) { this.customers.push(id); this.result.parties++; }
    }
  }

  private qty(p: Stocked, pieces: number): number { return p.kind === 'PCS' ? pieces * 1000 : pieces * 500; }

  private openingStock(): void {
    if (this.stocked.length === 0) return;
    this.app.inventory.setOpeningStock({
      note: 'Opening stock (demo)',
      lines: this.stocked.map((p) => ({ productId: p.id, qtyMilli: this.qty(p, this.rng.int(40, 90)), unitCostPaise: p.costPaise })),
    });
  }

  private purchases(): void {
    for (let n = 0; n < 5 && this.suppliers.length > 0; n++) {
      this.attempt('purchase', () => {
        const s = n % this.suppliers.length;
        const mine = this.stocked.filter((p) => p.supplier === s);
        const picked = mine.length > 0 ? this.rng.sample(mine, 4) : this.rng.sample(this.stocked, 4);
        const draft = PurchaseDraft.parse({
          supplierId: this.suppliers[s]!, supplierInvoiceNo: `${this.tag}/${n + 1}`, supplierInvoiceDate: addDays(this.today, -(18 - n * 3)),
          lines: picked.map((p) => ({ productId: p.id, uomId: p.uomId, qtyMilli: this.qty(p, this.rng.int(30, 80)), unitPricePaise: Math.round(p.costPaise * (0.97 + this.rng.next() * 0.06)) })),
          charges: n % 2 === 0 ? [{ kind: 'freight', amountPaise: rupees(this.rng.int(80, 250)) }] : [],
        });
        const quoted = this.app.purchases.quote(draft);
        this.app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: quoted.totals.computedTotalPaise, commandId: newUlid() }));
        this.result.purchases++;
      });
    }
  }

  private tenders(total: number, hasCustomer: boolean, availablePaise: number | undefined): TenderLine[] {
    const cash = Math.ceil(total / 1000) * 1000;
    const kind = this.rng.next();
    if (hasCustomer && availablePaise !== undefined && availablePaise >= total && kind < 0.4) return [{ method: 'credit', amountPaise: total }];
    if (kind < 0.5 || total < 500) return [{ method: 'cash', amountPaise: cash }];
    if (kind < 0.78) return [{ method: 'upi', amountPaise: total }];
    if (kind < 0.92) return [{ method: 'card', amountPaise: total }];
    const half = Math.floor(total / 2);
    return [{ method: 'cash', amountPaise: half }, { method: 'upi', amountPaise: total - half }];
  }

  private sales(): void {
    if (this.stocked.length === 0 || !this.app.register.current()) return;
    for (let n = 0; n < 40; n++) {
      this.attempt('sale', () => {
        const lines = this.rng.sample(this.stocked, this.rng.int(1, 4)).map((p) => ({
          productId: p.id, uomId: p.uomId, qtyMilli: p.kind === 'PCS' ? this.rng.int(1, 3) * 1000 : this.rng.int(1, 4) * 500,
        }));
        const customerId = this.customers.length > 0 && this.rng.chance(0.35) ? this.rng.pick(this.customers) : undefined;
        const draft = SaleDraft.parse({ lines, ...(customerId && { customerId }) });
        const quote = this.app.sales.quote(draft);
        const total = quote.totals.totalPaise;
        const tenders = this.tenders(total, !!customerId, quote.credit?.availablePaise);
        const { saleId } = this.app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders }));
        if (tenders.every((t) => t.method === 'cash')) this.cashSales.push(saleId);
        this.result.sales++;
      });
    }
  }

  private receipts(): void {
    const methods = ['cash', 'upi', 'bank', 'cheque'] as const;
    for (const customerId of this.customers) {
      this.attempt('receipt', () => {
        const open = this.app.payments.openItems('customer', customerId).charges.reduce((s, c) => s + c.openPaise, 0);
        if (open < 100) return;
        const amountPaise = Math.max(100, Math.round(open * (this.rng.chance(0.4) ? 1 : 0.5)));
        this.app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: customerId, amountPaise, method: this.rng.pick(methods), allocation: 'auto', paymentDate: addDays(this.today, -this.rng.int(0, 2)), commandId: newUlid() }));
        this.result.payments++;
      });
    }
  }

  private supplierPayments(): void {
    this.suppliers.forEach((supplierId, i) => this.attempt('supplier payment', () => {
      const { charges } = this.app.payments.openItems('supplier', supplierId);
      const open = charges.reduce((s, c) => s + c.openPaise, 0);
      if (open < 100) return;
      const amountPaise = i % 2 === 0 ? open : Math.round(open / 2);
      this.app.payments.create(PaymentInput.parse({ partyType: 'supplier', partyId: supplierId, amountPaise, method: i % 2 === 0 ? 'bank' : 'upi', allocation: 'auto', paymentDate: addDays(this.today, -this.rng.int(0, 3)), commandId: newUlid() }));
      this.result.payments++;
    }));
  }

  private expenses(): void {
    const categories = this.app.expenses.categories();
    const byCode = (code: string) => categories.find((c) => c.code === code);
    EXPENSES.forEach((e, i) => this.attempt(`expense ${e.text}`, () => {
      const category = byCode(e.category) ?? categories[i % categories.length]!;
      this.app.expenses.create(ExpenseInput.parse({
        categoryId: category.id, method: e.method, amountPaise: rupees(e.rupees), description: e.text, expenseDate: addDays(this.today, -e.ago), commandId: newUlid(),
        ...('gst' in e && { gstRateBp: e.gst, vendorName: 'Service vendor', vendorGstin: '07AABCU9603R1ZX' }),
      }));
      this.result.expenses++;
    }));
  }

  private returns(): void {
    for (const saleId of this.cashSales.slice(-8)) {
      if (this.result.returns >= 2) return;
      this.attempt('sales return', () => {
        const line = this.app.returns.quote({ saleId, lines: [{ lineNo: 1, qtyMilli: 1 }] }).lines.find((l) => l.returnableQtyMilli >= 1000);
        if (!line) return;
        const draft = { saleId, lines: [{ lineNo: line.lineNo, qtyMilli: 1000 }] };
        const quote = this.app.returns.quote(draft);
        if (quote.totalPaise <= 0) return;
        this.app.returns.complete(CompleteReturnInput.parse({ ...draft, commandId: newUlid(), reason: 'Customer returned item', expectedTotalPaise: quote.totalPaise }));
        this.result.returns++;
      });
    }
  }

  private adjustment(): void {
    const p = this.stocked[2];
    if (!p) return;
    this.app.inventory.adjust({ note: 'Damaged in storage (demo)', lines: [{ productId: p.id, qtyMilli: -2000, reason: 'damage' }] });
    this.result.adjustments++;
  }

  private stockTake(): void {
    const counts = this.stocked.slice(5, 8).map((p) => ({ productId: p.id, countedMilli: this.qty(p, 35) }));
    if (counts.length === 0) return;
    this.app.inventory.stockTake({ note: 'Shelf count (demo)', counts });
    this.result.adjustments++;
  }

  private journal(): void {
    const ids = new Map(this.app.statements.accounts().map((a) => [a.code, a.id]));
    const [drawings, cash] = [ids.get('3200'), ids.get('1100')];
    if (!drawings || !cash) return;
    this.app.manualJournals.post(ManualJournalInput.parse({
      narration: 'Owner drawings (demo)', commandId: newUlid(),
      lines: [{ accountId: drawings, debitPaise: rupees(5_000), creditPaise: 0 }, { accountId: cash, debitPaise: 0, creditPaise: rupees(5_000) }],
    }));
    this.result.journals++;
  }
}

export function seedDemo(app: SeedApp, today: string): SeedResult {
  return new DemoSeeder(app, today).run();
}
