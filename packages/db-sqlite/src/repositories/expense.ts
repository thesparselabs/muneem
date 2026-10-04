import type { Expense, ExpenseCategory, ExpenseListInput, ExpensePage } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';
import { documentCashMovements } from './register.js';

// LLD §5.1 expense accounts that Stage 6 posts to.
const SEEDED_CATEGORIES = [
  ['RENT', 'Rent', '5400'], ['SALARY', 'Salaries', '5410'], ['POWER', 'Electricity', '5420'], ['TRANSPORT', 'Transport', '5430'],
  ['INTERNET', 'Internet', '5440'], ['REPAIRS', 'Repairs', '5450'], ['BANK', 'Bank charges', '5460'], ['OTHER', 'Other expenses', '5900'],
] as const;

export function ensureExpenseCategories(db: Db, businessId: string, actor: Actor): void {
  const have = new Set(stmt(db, 'SELECT code FROM expense_category WHERE business_id = ?').pluck().all(businessId) as string[]);
  for (const [code, name, accountCode] of SEEDED_CATEGORIES) {
    if (have.has(code)) continue;
    const id = newUlid();
    const s = syncColumns(actor);
    stmt(db, `INSERT INTO expense_category (id, business_id, code, name, account_code, is_system, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).run(id, businessId, code, name, accountCode, s.t, s.t, s.created_by, s.device_id);
    recordChange(db, businessId, actor, { action: 'expense_category.create', entityType: 'expense_category', entityId: id, operationType: 'create', after: { id, code, name, accountCode } });
  }
}

export function listExpenseCategories(db: Db, businessId: string): (ExpenseCategory & { businessId: string })[] {
  return stmt(db, `SELECT id, business_id AS businessId, code, name, account_code AS accountCode FROM expense_category
    WHERE business_id = ? AND deleted_at IS NULL ORDER BY account_code, name`).all(businessId) as (ExpenseCategory & { businessId: string })[];
}

export interface ExpenseRecord {
  id: string; businessId: string; branchId: string; terminalId: string; sessionId: string | null; categoryId: string; supplierId: string | null;
  vendorName: string | null; vendorGstin: string | null; seriesId: string; docNumber: string; docSeq: number; expenseDate: string; fy: string;
  description: string | null; method: Expense['method']; reference: string | null; supplyType: 'intra' | 'inter' | null;
  taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number; itcPaise: number; roundOffPaise: number;
  totalPaise: number; dueDate: string | null; commandId: string; createdAt?: string;
}

export function insertExpense(db: Db, r: ExpenseRecord, actor: Actor): void {
  const t = r.createdAt ?? nowIso();
  stmt(db, `INSERT INTO expense (id, business_id, branch_id, terminal_id, session_id, category_id, supplier_id, vendor_name, vendor_gstin, series_id,
      doc_number, doc_seq, expense_date, fy, description, method, reference, supply_type, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise,
      itc_paise, round_off_paise, total_paise, due_date, command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @sessionId, @categoryId, @supplierId, @vendorName, @vendorGstin, @seriesId, @docNumber, @docSeq,
      @expenseDate, @fy, @description, @method, @reference, @supplyType, @taxablePaise, @cgstPaise, @sgstPaise, @igstPaise, @cessPaise, @itcPaise,
      @roundOffPaise, @totalPaise, @dueDate, @commandId, @t, @t, @by, @device)`).run({ ...r, createdAt: undefined, t, by: actor.userId, device: actor.deviceId });
}

export const expenseIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM expense WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;

export function markExpenseCancelled(db: Db, id: string, reason: string, actor: Actor): void {
  const t = nowIso();
  stmt(db, `UPDATE expense SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?, updated_at = ?, version = version + 1,
      sync_state = 'pending' WHERE id = ? AND status = 'posted'`).run(t, actor.userId, reason, t, id);
}

type ExpenseRow = {
  id: string; business_id: string; doc_number: string; expense_date: string; status: Expense['status']; category_id: string; category_name: string;
  method: Expense['method']; description: string | null; reference: string | null; supplier_id: string | null; vendor_name: string | null;
  vendor_gstin: string | null; supply_type: 'intra' | 'inter' | null; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number;
  cess_paise: number; itc_paise: number; total_paise: number; due_date: string | null; settled_paise: number; created_at: string; cancel_reason: string | null;
};
const SELECT = 'SELECT e.*, c.name AS category_name FROM expense e JOIN expense_category c ON c.id = e.category_id';

function toExpense(db: Db, r: ExpenseRow): Expense & { businessId: string } {
  const drawer = documentCashMovements(db, 'expense', r.id)[0];
  return {
    id: r.id, businessId: r.business_id, docNumber: r.doc_number, expenseDate: r.expense_date, status: r.status, categoryId: r.category_id,
    categoryName: r.category_name, method: r.method, taxablePaise: r.taxable_paise, cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise,
    igstPaise: r.igst_paise, cessPaise: r.cess_paise, itcPaise: r.itc_paise, totalPaise: r.total_paise, settledPaise: r.settled_paise, createdAt: r.created_at,
    ...(r.description !== null && { description: r.description }), ...(r.reference !== null && { reference: r.reference }),
    ...(r.supplier_id !== null && { supplierId: r.supplier_id }), ...(r.vendor_name !== null && { vendorName: r.vendor_name }),
    ...(r.vendor_gstin !== null && { vendorGstin: r.vendor_gstin }), ...(r.supply_type !== null && { supplyType: r.supply_type }),
    ...(r.due_date !== null && { dueDate: r.due_date }), ...(r.cancel_reason !== null && { cancelReason: r.cancel_reason }),
    ...(drawer && { drawerSessionId: drawer.sessionId }),
  };
}

export function getExpense(db: Db, id: string): (Expense & { businessId: string }) | null {
  const r = stmt(db, `${SELECT} WHERE e.id = ?`).get(id) as ExpenseRow | undefined;
  return r ? toExpense(db, r) : null;
}

type Cursor = { d: string; id: string };
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
}

export function listExpenses(db: Db, businessId: string, f: ExpenseListInput): ExpensePage {
  const after = decode(f.cursor);
  const rows = stmt(db, `${SELECT}
    WHERE e.business_id = @businessId AND (@categoryId IS NULL OR e.category_id = @categoryId) AND (@status IS NULL OR e.status = @status)
      AND (@from IS NULL OR e.expense_date >= @from) AND (@to IS NULL OR e.expense_date <= @to)
      AND (@afterDate IS NULL OR (e.expense_date, e.id) < (@afterDate, @afterId))
    ORDER BY e.expense_date DESC, e.id DESC LIMIT @limit`).all({
    businessId, categoryId: f.categoryId ?? null, status: f.status ?? null, from: f.from ?? null, to: f.to ?? null,
    afterDate: after?.d ?? null, afterId: after?.id ?? null, limit: f.limit + 1,
  }) as ExpenseRow[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return { items: page.map((r) => toExpense(db, r)), nextCursor: rows.length > f.limit && last ? encode({ d: last.expense_date, id: last.id }) : null };
}
