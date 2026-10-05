import { CompleteSaleInput, CreatePurchaseInput, PaymentInput, PurchaseDraft, SaleDraft, type TenderLine } from '@muneem/contracts';
import { addDays, newUlid } from '@muneem/domain';
import type { App } from '../../src/main/app.js';
import type { Prng } from '../soak/generator.js';
import type { ScaleShop } from './shop.js';

export interface BlockPlan { startDate: string; days: number; salesPerDay: number; purchasesPerDay: number }
export interface BlockCounts { sales: number; purchases: number; receipts: number; supplierPayments: number }

// One self-contained stretch of trading through the real services: every payment settles documents of the same block.
export class TemplateBlock {
  readonly counts: BlockCounts = { sales: 0, purchases: 0, receipts: 0, supplierPayments: 0 };
  private readonly creditCustomers = new Set<string>();
  private invoiceNo = 0;

  constructor(private readonly app: App, private readonly shop: ScaleShop, private readonly rng: Prng, private readonly setTime: (ms: number) => void) {}

  run(plan: BlockPlan): void {
    for (let d = 0; d < plan.days; d++) {
      const date = addDays(plan.startDate, d);
      let ms = new Date(`${date}T09:00:00`).getTime();
      const tick = () => { ms += 30_000; this.setTime(ms); };
      tick();
      for (let p = 0; p < plan.purchasesPerDay; p++) { this.buy(date); tick(); }
      for (let s = 0; s < plan.salesPerDay; s++) { this.sell(); tick(); }
      this.receipts();
      tick();
      this.payDueSuppliers(date);
    }
  }

  private sell(): void {
    const n = this.rng.pick([1, 1, 2, 2, 3, 3, 4, 5, 6, 8]);
    const lines = this.rng.sample(this.shop.products, n).map((p) => ({ productId: p.id, uomId: this.shop.pcs, qtyMilli: this.rng.int(1, 3) * 1000 }));
    const kind = this.rng.next();
    const customerId = kind >= 0.8 ? this.rng.pick(this.shop.customers).id : undefined;
    const draft = SaleDraft.parse({ lines, ...(customerId && { customerId }) });
    const total = this.app.sales.quote(draft).totals.totalPaise;
    const tenders = this.tenders(kind, total);
    if (customerId && tenders.some((t) => t.method === 'credit')) this.creditCustomers.add(customerId);
    this.app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders }));
    this.counts.sales++;
  }

  private tenders(kind: number, total: number): TenderLine[] {
    if (kind < 0.5) return [{ method: 'cash', amountPaise: Math.ceil(total / 10_000) * 10_000 }];
    if (kind < 0.75) return [{ method: this.rng.chance(0.8) ? 'upi' : 'card', amountPaise: total }];
    if (kind < 0.8) return [{ method: 'cash', amountPaise: Math.floor(total / 2) }, { method: 'upi', amountPaise: total - Math.floor(total / 2) }];
    if (kind < 0.85) return [{ method: 'cash', amountPaise: total }];
    if (kind < 0.95) return [{ method: 'credit', amountPaise: total }];
    return [{ method: 'cash', amountPaise: total - Math.floor(total / 2) }, { method: 'credit', amountPaise: Math.floor(total / 2) }];
  }

  private buy(date: string): void {
    const supplier = this.rng.pick(this.shop.suppliers);
    const lines = this.rng.sample(this.shop.products, 25).map((p) => ({ productId: p.id, uomId: this.shop.pcs, qtyMilli: this.rng.int(20, 60) * 1000, unitPricePaise: p.costPaise }));
    const draft = { supplierId: supplier, supplierInvoiceNo: `INV-${++this.invoiceNo}`, supplierInvoiceDate: date, lines };
    const billTotalPaise = this.app.purchases.quote(PurchaseDraft.parse(draft)).totals.computedTotalPaise;
    this.app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise, commandId: newUlid() }));
    this.counts.purchases++;
  }

  // Most credit customers of the block pay something back, settled oldest bill first.
  private receipts(): void {
    for (const customerId of this.creditCustomers) {
      if (this.rng.chance(0.3)) continue;
      const open = this.app.payments.openItems('customer', customerId).charges.reduce((s, c) => s + c.openPaise, 0);
      if (open === 0) continue;
      const amountPaise = this.rng.chance(0.6) ? open : Math.max(100, Math.round(open * 0.5));
      this.app.payments.create(PaymentInput.parse({
        partyType: 'customer', partyId: customerId, amountPaise, method: this.rng.pick(['cash', 'upi', 'bank'] as const), allocation: 'auto', commandId: newUlid(),
      }));
      this.counts.receipts++;
    }
    this.creditCustomers.clear();
  }

  private payDueSuppliers(date: string): void {
    for (const supplierId of this.shop.suppliers) {
      const amountPaise = this.app.payments.openItems('supplier', supplierId).charges.filter((c) => c.dueDate <= date).reduce((s, c) => s + c.openPaise, 0);
      if (amountPaise === 0) continue;
      this.app.payments.create(PaymentInput.parse({ partyType: 'supplier', partyId: supplierId, amountPaise, method: 'bank', allocation: 'auto', commandId: newUlid() }));
      this.counts.supplierPayments++;
    }
  }
}
