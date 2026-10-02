import {
  AppError, type CompleteSaleInput, type CompleteSaleResult, type ReceiptDoc, type Sale, type SaleDraft, type SaleListInput, type SalePage, type SaleQuote,
} from '@muneem/contracts';
import { formatRupees as rupees, settleTenders } from '@muneem/domain';
import { firstPrintJobFor, getSale, getSession, listSales, saleIdByCommand, withTransaction } from '@muneem/db-sqlite';
import type { PosContext } from './posContext.js';
import type { RegisterService } from './register.js';
import { runSaleCommit } from './saleCommit.js';
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
    const limit = this.ctx.maxDiscountBp();
    if (limit !== undefined && totals.discountBp > limit) {
      throw new AppError('PERMISSION_DENIED', `Discount of ${totals.discountBp / 100}% is above your limit of ${limit / 100}%`);
    }
    if (totals.totalPaise !== input.expectedTotalPaise) {
      throw new AppError('TOTAL_MISMATCH', `The bill total is now ${rupees(totals.totalPaise)}; check the cart and take payment again`);
    }
    const settled = settleTenders(totals.totalPaise, input.tenders);
    if (!settled.ok) {
      const message = settled.reason === 'short' ? `${rupees(settled.shortByPaise)} still to pay`
        : settled.reason === 'non_cash_over_total' ? 'Card, UPI and other payments cannot exceed the bill; only cash can give change'
          : 'Every payment must be more than zero';
      throw new AppError('VALIDATION_FAILED', message, { tenders: message });
    }

    const db = this.ctx.db();
    let openDrawer = false;
    const result = withTransaction(db, (): CompleteSaleResult => {
      const again = this.replay(input.commandId);
      if (again) return again;
      if (getSession(db, session.id)?.status !== 'open') throw new AppError('REGISTER_NOT_OPEN', 'The register was closed');
      const s = runSaleCommit({
        db, actor: this.ctx.actor(), till: this.ctx.till(), session, input, priced, tenders: settled.tenders, paidPaise: settled.paidPaise,
        changePaise: settled.changePaise, docDate: this.ctx.today(), cashier: this.cashierName(),
        receiptFooter: this.ctx.setting('pos.receiptFooter', DEFAULT_FOOTER),
      });
      openDrawer = settled.tenders.some((t) => t.method === 'cash');
      return { saleId: s.saleId, docNumber: s.number!.number, totals, changePaise: settled.changePaise, printJobId: s.printJobId, replayed: false };
    });
    if (!result.replayed) this.notify({ ...result, openDrawer });
    return result;
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
