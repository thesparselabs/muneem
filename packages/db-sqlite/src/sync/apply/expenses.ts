import type { Expense } from '@muneem/contracts';
import { financialYearOf } from '@muneem/domain';
import { insertExpense, markExpenseCancelled } from '../../repositories/expense.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { applyDrawerMovements, applyPartyEntry, statusIs, str, type DocumentApplier } from './documents.js';
import { applyJournal } from './journals.js';

const num = (v: unknown): number => Number(v ?? 0);

function createExpense(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  insertExpense(ctx.db, {
    id, businessId: ctx.businessId, branchId: String(p.branchId), terminalId: String(p.terminalId), sessionId: str(p.sessionId),
    categoryId: resolver(ctx.db, ctx.businessId)('expense_category', p.categoryId)!, supplierId: str(p.supplierId), vendorName: str(p.vendorName),
    vendorGstin: str(p.vendorGstin), seriesId: String(p.seriesId), docNumber: String(p.docNumber), docSeq: num(p.docSeq), expenseDate: String(p.expenseDate),
    fy: str(p.fy) ?? financialYearOf(String(p.expenseDate)), description: str(p.description), method: p.method as Expense['method'], reference: str(p.reference),
    supplyType: (str(p.supplyType) as 'intra' | 'inter' | null), taxablePaise: num(p.taxablePaise), cgstPaise: num(p.cgstPaise), sgstPaise: num(p.sgstPaise),
    igstPaise: num(p.igstPaise), cessPaise: num(p.cessPaise), itcPaise: num(p.itcPaise), roundOffPaise: num(p.roundOffPaise), totalPaise: num(p.totalPaise),
    dueDate: str(p.dueDate), commandId: str(p.commandId) ?? id, ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
  applyPartyEntry(ctx, p.entry);
  applyDrawerMovements(ctx, p.drawerMovements, 'expense', id);
  applyJournal(ctx, p.journal);
}

function cancelExpense(ctx: ApplyContext, c: Payload): void {
  markExpenseCancelled(ctx.db, ctx.change.entityId, String(c.reason ?? ''), ctx.actor);
  applyPartyEntry(ctx, c.entry);
  applyDrawerMovements(ctx, c.drawerMovements, 'expense', ctx.change.entityId);
  applyJournal(ctx, c.journal);
}

export const EXPENSE: DocumentApplier = { table: 'expense', create: createExpense, cancel: cancelExpense, cancelled: statusIs('expense', 'cancelled') };
