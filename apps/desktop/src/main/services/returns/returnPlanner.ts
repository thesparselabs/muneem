import { AppError, type RefundMethod, type ReturnQuote, type Sale } from '@muneem/contracts';
import { computeReturn, type ReturnLineResult, type ReturnResult } from '@muneem/domain';
import { getSale, returnedSoFar, saleOutstanding, soldItems, type Db, type SoldItem } from '@muneem/db-sqlite';

export interface ReturnRequest { saleId: string; lines: readonly { lineNo: number; qtyMilli: number }[]; refundMethod?: RefundMethod | undefined }

export interface PlannedLine { item: SoldItem; returnedBeforeMilli: number; share: ReturnLineResult }

export interface ReturnPlan {
  sale: Sale & { businessId: string };
  items: SoldItem[];
  returnedByItem: Map<string, number>;
  lines: PlannedLine[];
  result: ReturnResult | null;
  outstandingPaise: number;
  refundMethod: RefundMethod;
  refundMethods: RefundMethod[];
  creditPaise: number;
  refundPaise: number;
  issues: { lineNo: number; message: string }[];
  exceeded: boolean;
}

const qty = (milli: number, uom: string) => `${milli / 1000} ${uom}`;

// Refunds go back the way the bill was paid: cash if any cash was taken, else its first card or UPI line; an all-credit bill goes back on account.
export function defaultRefundMethod(sale: Sale): RefundMethod {
  const paid = sale.tenders.filter((t) => t.method !== 'credit');
  if (paid.length === 0) return 'credit';
  if (paid.some((t) => t.method === 'cash')) return 'cash';
  const first = paid.find((t) => t.method === 'upi' || t.method === 'card');
  return first ? (first.method as RefundMethod) : 'cash';
}

// ADR-0043: prices a return from the sale's stored lines; problems are listed, never thrown, so a quote can show them.
export function planReturn(db: Db, businessId: string, req: ReturnRequest): ReturnPlan {
  const sale = getSale(db, req.saleId);
  if (!sale || sale.businessId !== businessId) throw new AppError('NOT_FOUND', 'Sale not found');
  const items = soldItems(db, sale.id);
  const returned = returnedSoFar(db, sale.id);
  const asked = new Map<number, number>();
  const issues: ReturnPlan['issues'] = [];
  let exceeded = false;
  for (const r of req.lines) {
    const item = items.find((i) => i.lineNo === r.lineNo);
    if (!item) { issues.push({ lineNo: r.lineNo, message: 'not a line of this bill' }); continue; }
    if (asked.has(r.lineNo)) { issues.push({ lineNo: r.lineNo, message: `${item.name} is listed twice` }); continue; }
    const left = item.qtyMilli - (returned.qtyBySaleItem.get(item.id) ?? 0);
    if (r.qtyMilli > left) {
      issues.push({ lineNo: r.lineNo, message: `only ${qty(left, item.uomCode)} of ${item.name} is left to return` });
      exceeded = true;
      continue;
    }
    asked.set(r.lineNo, r.qtyMilli);
  }
  const result = asked.size === 0 ? null : computeReturn({
    lines: items.map((i) => ({ line: i, returnedBeforeMilli: returned.qtyBySaleItem.get(i.id) ?? 0, qtyMilli: asked.get(i.lineNo) ?? 0 })),
    saleRoundOffPaise: sale.totals.roundOffPaise, roundOffReturnedPaise: returned.roundOffPaise,
  });
  const lines = result ? items.flatMap((item, i) => (asked.has(item.lineNo) ? [{ item, returnedBeforeMilli: returned.qtyBySaleItem.get(item.id) ?? 0, share: result.lines[i]! }] : [])) : [];
  for (const l of lines) if (l.share.baseQtyMilli === 0) issues.push({ lineNo: l.item.lineNo, message: `too little of ${l.item.name} to return` });
  const outstandingPaise = saleOutstanding(db, sale.id);
  const refundMethods: RefundMethod[] = sale.customerId ? ['cash', 'upi', 'card', 'credit'] : ['cash', 'upi', 'card'];
  const refundMethod = req.refundMethod ?? defaultRefundMethod(sale);
  if (!refundMethods.includes(refundMethod)) issues.push({ lineNo: 0, message: 'credit to an account needs a customer on the bill' });
  const total = result?.totalPaise ?? 0;
  const creditPaise = refundMethod === 'credit' ? total : Math.min(outstandingPaise, Math.max(0, total));
  return {
    sale, items, returnedByItem: returned.qtyBySaleItem, lines, result, outstandingPaise, refundMethod, refundMethods, creditPaise, refundPaise: total - creditPaise,
    issues, exceeded,
  };
}

export function quoteOf(plan: ReturnPlan): ReturnQuote {
  const r = plan.result;
  return {
    saleId: plan.sale.id, saleDocNumber: plan.sale.docNumber, ...(plan.sale.customer.name && { customerName: plan.sale.customer.name }),
    lines: plan.items.map((item) => {
      const returned = plan.returnedByItem.get(item.id) ?? 0;
      const s = plan.lines.find((l) => l.item.id === item.id)?.share;
      return {
        lineNo: item.lineNo, name: item.name, uomCode: item.uomCode, soldQtyMilli: item.qtyMilli, returnedQtyMilli: returned, returnableQtyMilli: item.qtyMilli - returned,
        qtyMilli: s?.qtyMilli ?? 0, taxablePaise: s?.taxablePaise ?? 0, cgstPaise: s?.cgstPaise ?? 0, sgstPaise: s?.sgstPaise ?? 0, igstPaise: s?.igstPaise ?? 0,
        cessPaise: s?.cessPaise ?? 0, totalPaise: s?.totalPaise ?? 0,
      };
    }),
    taxablePaise: r?.taxablePaise ?? 0, cgstPaise: r?.cgstPaise ?? 0, sgstPaise: r?.sgstPaise ?? 0, igstPaise: r?.igstPaise ?? 0, cessPaise: r?.cessPaise ?? 0,
    roundOffPaise: r?.roundOffPaise ?? 0, totalPaise: r?.totalPaise ?? 0, creditPaise: plan.creditPaise, refundPaise: plan.refundPaise,
    refundMethod: plan.refundMethod, refundMethods: plan.refundMethods, outstandingPaise: plan.outstandingPaise, completesSale: r?.completesSale ?? false, issues: plan.issues,
  };
}

// The checks a return must pass before anything is written.
export function assertReturnable(plan: ReturnPlan): ReturnResult {
  if (plan.issues.length > 0) {
    throw new AppError(plan.exceeded ? 'RETURN_QTY_EXCEEDED' : 'VALIDATION_FAILED', 'These goods cannot be returned',
      Object.fromEntries(plan.issues.map((i) => [i.lineNo === 0 ? 'refundMethod' : `lines.${i.lineNo}`, i.message])));
  }
  if (!plan.result || plan.result.totalPaise <= 0) throw new AppError('VALIDATION_FAILED', 'Nothing of value is being returned', { lines: 'the returned goods are worth ₹0' });
  return plan.result;
}
