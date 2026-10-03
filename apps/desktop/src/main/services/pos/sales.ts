import {
  AppError, type CompleteSaleInput, type CompleteSaleResult, type Customer, type ReceiptDoc, type Sale, type SaleDraft, type SaleListInput, type SalePage, type SaleQuote,
} from '@muneem/contracts';
import { addDays, creditAvailable, formatRupees as rupees, settleTenders } from '@muneem/domain';
import { firstPrintJobFor, getSale, getSession, listSales, partyBalance, saleIdByCommand, withTransaction } from '@muneem/db-sqlite';
import type { PosContext } from './posContext.js';
import type { RegisterService } from './register.js';
import { runSaleCommit, type SaleCredit } from './saleCommit.js';
import type { SalePricing } from './salePricing.js';

const DEFAULT_FOOTER = ['Thank you! Visit again.'];

export type AfterCommit = (result: CompleteSaleResult & { openDrawer: boolean }) => void;

export class SaleService {
  constructor(
    private readonly ctx: PosContext,
    private readonly pricing: SalePricing,
    private readonly register: RegisterService,
    private readonly cashierName: () => string,
    private readonly afterCommit: AfterCommit = () => undefined,
  ) {}

  quote(draft: SaleDraft): SaleQuote { return this.pricing.price(draft).quote; }

  complete(input: CompleteSaleInput): CompleteSaleResult {
    const replay = this.replay(input.commandId);
    if (replay) return replay;
    const session = this.register.requireOpen();
    const priced = this.pricing.price(input);
    const { totals, issues } = priced.quote;
    if (issues.length > 0) {
      throw new AppError('VALIDATION_FAILED', 'Some lines cannot be billed', Object.fromEntries(issues.map((i) => [`lines.${i.lineNo - 1}`, i.message])));
    }
    const blocked = priced.quote.warnings.filter((w) => w.blocking);
    if (blocked.length > 0) throw new AppError('STOCK_INSUFFICIENT', blocked.map((w) => w.message).join('; '));
    const limit = this.ctx.maxDiscountBp();
    if (limit !== undefined && totals.discountBp > limit) {
      throw new AppError('PERMISSION_DENIED', `Discount of ${totals.discountBp / 100}% is above your limit of ${limit / 100}%`);
    }
    if (totals.totalPaise !== input.expectedTotalPaise) {
      throw new AppError('TOTAL_MISMATCH', `The bill total is now ${rupees(totals.totalPaise)}; check the cart and take payment again`);
    }
    const creditLines = input.tenders.filter((t) => t.method === 'credit');
    if (creditLines.length > 1) throw new AppError('VALIDATION_FAILED', 'Put the credit part on one line', { tenders: 'only one credit line per bill' });
    if (creditLines.length > 0 && !priced.customer) {
      throw new AppError('VALIDATION_FAILED', 'Choose the customer before giving credit', { tenders: 'credit needs a customer on the bill' });
    }
    const settled = settleTenders(totals.totalPaise, input.tenders);
    if (!settled.ok) {
      const message = settled.reason === 'short' ? `${rupees(settled.shortByPaise)} still to pay`
        : settled.reason === 'non_cash_over_total' ? 'Card, UPI, credit and other payments cannot exceed the bill; only cash can give change'
          : 'Every payment must be more than zero';
      throw new AppError('VALIDATION_FAILED', message, { tenders: message });
    }

    const db = this.ctx.db();
    let openDrawer = false;
    const result = withTransaction(db, (): CompleteSaleResult => {
      const again = this.replay(input.commandId);
      if (again) return again;
      if (getSession(db, session.id)?.status !== 'open') throw new AppError('REGISTER_NOT_OPEN', 'The register was closed');
      const creditPaise = creditLines.reduce((sum, t) => sum + t.amountPaise, 0);
      const s = runSaleCommit({
        db, actor: this.ctx.actor(), till: this.ctx.till(), session, input, priced, tenders: settled.tenders, paidPaise: settled.paidPaise - creditPaise,
        credit: creditPaise > 0 ? this.credit(priced.customer!, creditPaise) : null,
        changePaise: settled.changePaise, docDate: this.ctx.today(), cashier: this.cashierName(),
        receiptFooter: this.ctx.setting('pos.receiptFooter', DEFAULT_FOOTER),
      });
      openDrawer = settled.tenders.some((t) => t.method === 'cash');
      return { saleId: s.saleId, docNumber: s.number!.number, totals, changePaise: settled.changePaise, printJobId: s.printJobId, replayed: false };
    });
    if (!result.replayed) this.notify({ ...result, openDrawer });
    return result;
  }

  // Checked inside the sale's transaction, so the balance it reads is the one the sale is added to (ADR-0026).
  private credit(customer: Customer, amountPaise: number): SaleCredit {
    const docDate = this.ctx.today();
    const credit: SaleCredit = { amountPaise, dueDate: addDays(docDate, customer.creditDays) };
    const balancePaise = partyBalance(this.ctx.db(), { businessId: this.ctx.businessId(), partyType: 'customer', partyId: customer.id });
    const available = creditAvailable(balancePaise, customer.creditLimitPaise);
    if (amountPaise <= available) return credit;
    if (!this.ctx.can('customers.approve')) {
      const limit = customer.creditLimitPaise === null ? 'no credit limit set' : `a limit of ${rupees(customer.creditLimitPaise)}`;
      throw new AppError('CREDIT_LIMIT_EXCEEDED',
        `${customer.name} owes ${rupees(balancePaise)} with ${limit}; ${rupees(amountPaise - Math.max(0, available))} more than allowed. A manager can approve it.`);
    }
    return { ...credit, override: { balancePaise, limitPaise: customer.creditLimitPaise, approvedBy: this.ctx.userId() } };
  }

  get(id: string): Sale {
    const sale = getSale(this.ctx.db(), id);
    if (!sale || sale.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return sale;
  }

  list(f: SaleListInput): SalePage {
    return listSales(this.ctx.db(), this.ctx.businessId(), f);
  }

  receipt(saleId: string): ReceiptDoc {
    this.get(saleId);
    const job = firstPrintJobFor(this.ctx.db(), saleId);
    if (!job) throw new Error('NOT_FOUND');
    return job.doc as ReceiptDoc;
  }

  private replay(commandId: string): CompleteSaleResult | null {
    const id = saleIdByCommand(this.ctx.db(), this.ctx.businessId(), commandId);
    if (!id) return null;
    const sale = this.get(id);
    const printJobId = firstPrintJobFor(this.ctx.db(), id)!.id;
    return { saleId: id, docNumber: sale.docNumber, totals: sale.totals, changePaise: sale.changePaise, printJobId, replayed: true };
  }

  // Printing and the drawer run after COMMIT and can never undo the sale (HLD §8).
  private notify(result: CompleteSaleResult & { openDrawer: boolean }): void {
    try {
      this.afterCommit(result);
    } catch {
      /* hardware is best effort */
    }
  }
}
