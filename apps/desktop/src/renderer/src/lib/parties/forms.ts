import { CustomerInput, SupplierInput, type AgeingBuckets, type Customer, type Supplier } from '@muneem/contracts';
import { parseOptional, paiseToText } from '../money.js';

type Result<T> = { ok: true; input: T } | { ok: false; errors: Record<string, string> };

const issues = (error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> =>
  Object.fromEntries(error.issues.map((i) => [String(i.path[0] ?? 'form'), i.message]));
const opt = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
const days = (v: string): number | undefined | null => (v.trim() === '' ? undefined : /^\d+$/u.test(v.trim()) ? Number(v.trim()) : null);

export interface SupplierForm {
  name: string; phone: string; email: string; gstin: string; stateCode: string; taxScheme: SupplierInput['taxScheme'];
  addressLine1: string; city: string; pinCode: string; creditDays: string;
}
export const emptySupplierForm = (stateCode = ''): SupplierForm => ({
  name: '', phone: '', email: '', gstin: '', stateCode, taxScheme: 'regular', addressLine1: '', city: '', pinCode: '', creditDays: '',
});
export const supplierToForm = (s: Supplier): SupplierForm => ({
  name: s.name, phone: s.phone ?? '', email: s.email ?? '', gstin: s.gstin ?? '', stateCode: s.stateCode, taxScheme: s.taxScheme,
  addressLine1: s.addressLine1 ?? '', city: s.city ?? '', pinCode: s.pinCode ?? '', creditDays: String(s.creditDays),
});

// A GSTIN fixes the state, so the state box follows it when one is typed.
export function supplierFormToInput(f: SupplierForm): Result<SupplierInput> {
  const credit = days(f.creditDays);
  if (credit === null) return { ok: false, errors: { creditDays: 'whole days' } };
  const gstin = opt(f.gstin)?.toUpperCase();
  const parsed = SupplierInput.safeParse({
    name: f.name, phone: opt(f.phone), email: opt(f.email), gstin, stateCode: gstin ? gstin.slice(0, 2) : f.stateCode,
    taxScheme: f.taxScheme, addressLine1: opt(f.addressLine1), city: opt(f.city), pinCode: opt(f.pinCode), creditDays: credit ?? 0,
  });
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false, errors: issues(parsed.error) };
}

// Every field the customer has, so an edit sends them all back: the update replaces the whole record.
export interface CustomerForm {
  name: string; phone: string; email: string; gstin: string; stateCode: string; addressLine1: string; city: string; pinCode: string; creditDays: string;
}
export const customerToForm = (c?: Customer): CustomerForm => ({
  name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '', gstin: c?.gstin ?? '', stateCode: c?.stateCode ?? '',
  addressLine1: c?.addressLine1 ?? '', city: c?.city ?? '', pinCode: c?.pinCode ?? '', creditDays: c ? String(c.creditDays) : '',
});
export function customerFormToInput(f: CustomerForm): Result<CustomerInput> {
  const credit = days(f.creditDays);
  if (credit === null) return { ok: false, errors: { creditDays: 'whole days' } };
  const gstin = opt(f.gstin)?.toUpperCase();
  const parsed = CustomerInput.safeParse({
    name: f.name, phone: opt(f.phone), email: opt(f.email), gstin, stateCode: gstin ? gstin.slice(0, 2) : opt(f.stateCode),
    addressLine1: opt(f.addressLine1), city: opt(f.city), pinCode: opt(f.pinCode), creditDays: credit,
  });
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false, errors: issues(parsed.error) };
}

// An empty box means "no limit set", which allows no credit without a manager (ADR-0026).
export const creditLimitText = (limitPaise: number | null): string => (limitPaise === null ? '' : paiseToText(limitPaise));
export function parseCreditLimit(text: string): { ok: true; limitPaise: number | null } | { ok: false; error: string } {
  const v = parseOptional(text, 2);
  if (v === undefined) return { ok: true, limitPaise: null };
  return v === null || v < 0 ? { ok: false, error: 'Enter an amount in rupees, or leave it empty for no credit' } : { ok: true, limitPaise: v };
}

export const AGEING_COLUMNS: readonly [keyof AgeingBuckets, string][] = [
  ['notDuePaise', 'Not due'], ['days0to30Paise', '0–30 days'], ['days31to60Paise', '31–60'], ['days61to90Paise', '61–90'], ['over90Paise', '90+'],
  ['advancePaise', 'Advance'], ['netPaise', 'Net'],
];
export const overdueOver30 = (b: AgeingBuckets): number => b.days31to60Paise + b.days61to90Paise + b.over90Paise;
