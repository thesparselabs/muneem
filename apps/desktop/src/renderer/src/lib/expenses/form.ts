import { EXPENSE_METHODS, type ExpenseInput } from '@muneem/contracts';
import { parseOptional } from '../money.js';

export interface ExpenseForm {
  categoryId: string; date: string; description: string; method: (typeof EXPENSE_METHODS)[number]; reference: string;
  supplierId: string; vendorName: string; vendorGstin: string; amount: string; inclusive: boolean; gstRate: string; itc: boolean;
}
export const emptyExpenseForm = (today: string, categoryId = ''): ExpenseForm => ({
  categoryId, date: today, description: '', method: 'cash', reference: '', supplierId: '', vendorName: '', vendorGstin: '', amount: '',
  inclusive: true, gstRate: '', itc: true,
});

// GST is offered only with a GSTIN (the supplier's or the vendor's), as the server requires.
export const gstAllowed = (f: ExpenseForm, supplierHasGstin: boolean): boolean => supplierHasGstin || f.vendorGstin.trim().length === 15;

export function expenseFormToInput(f: ExpenseForm, commandId: string, supplierHasGstin: boolean): { ok: true; input: ExpenseInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!f.categoryId) errors.categoryId = 'choose a category';
  if (f.method === 'credit' && !f.supplierId) errors.supplierId = 'an expense on credit needs a supplier';
  const amount = parseOptional(f.amount, 2);
  if (!amount || amount <= 0) errors.amount = 'enter the amount';
  const rate = gstAllowed(f, supplierHasGstin) ? parseOptional(f.gstRate.replace(/%$/u, ''), 2) : undefined;
  if (rate === null || (rate !== undefined && (rate < 0 || rate > 10_000))) errors.gstRate = 'a GST percent';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      categoryId: f.categoryId, expenseDate: f.date, method: f.method, amountPaise: amount!, amountIsInclusive: f.inclusive, commandId,
      ...(f.description.trim() && { description: f.description.trim() }), ...(f.reference.trim() && { reference: f.reference.trim() }),
      ...(f.supplierId && { supplierId: f.supplierId }), ...(!f.supplierId && f.vendorName.trim() && { vendorName: f.vendorName.trim() }),
      ...(!f.supplierId && f.vendorGstin.trim() && { vendorGstin: f.vendorGstin.trim().toUpperCase() }),
      ...(rate !== undefined && rate !== null && { gstRateBp: rate, itcEligible: f.itc }),
    },
  };
}
