import { DomainError } from '../errors.js';

// CGST Rule 46(b): at most 16 characters of letters, digits, '-' and '/', unique per GSTIN per financial year.
export const INVOICE_PREFIX = /^[A-Z0-9]{1,4}$/u;
export const MAX_INVOICE_SEQ = 999_999;
const MAX_LENGTH = 16;

// '2026-27' → '2627'
export const compactFy = (fy: string): string => `${fy.slice(2, 4)}${fy.slice(5, 7)}`;

export function formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
  if (!INVOICE_PREFIX.test(prefix)) throw new DomainError('INVALID_INPUT', `invoice prefix must be 1–4 capital letters or digits, got "${prefix}"`);
  if (!Number.isSafeInteger(seq) || seq < 1) throw new DomainError('INVALID_INPUT', `invoice sequence must be positive, got ${seq}`);
  if (seq > MAX_INVOICE_SEQ) throw new DomainError('OVERFLOW', `this terminal has issued all ${MAX_INVOICE_SEQ} invoice numbers for ${fy}`);
  const number = `${prefix}/${compactFy(fy)}/${String(seq).padStart(6, '0')}`;
  if (number.length > MAX_LENGTH) throw new DomainError('INVALID_INPUT', `invoice number ${number} is longer than ${MAX_LENGTH} characters`);
  return number;
}

// ADR-0028: other documents put a kind letter after the terminal prefix and use 5 digits, staying within 16 characters.
export const DOC_KIND_LETTER = { purchase: 'P', debit_note: 'D', credit_note: 'C', receipt: 'R', payment: 'Y', expense: 'E', journal: 'J' } as const;
export type DocKind = keyof typeof DOC_KIND_LETTER;
export const MAX_DOC_SEQ = 99_999;
const DOC_PREFIX = /^[A-Z0-9]{1,4}[A-Z]$/u;

export function docSeriesPrefix(terminalPrefix: string, kind: DocKind): string {
  if (!INVOICE_PREFIX.test(terminalPrefix)) throw new DomainError('INVALID_INPUT', `terminal prefix must be 1–4 capital letters or digits, got "${terminalPrefix}"`);
  return `${terminalPrefix}${DOC_KIND_LETTER[kind]}`;
}

export function formatDocNumber(prefix: string, fy: string, seq: number): string {
  if (!DOC_PREFIX.test(prefix)) throw new DomainError('INVALID_INPUT', `document prefix must be a terminal prefix and a kind letter, got "${prefix}"`);
  if (!Number.isSafeInteger(seq) || seq < 1) throw new DomainError('INVALID_INPUT', `document sequence must be positive, got ${seq}`);
  if (seq > MAX_DOC_SEQ) throw new DomainError('OVERFLOW', `this terminal has used all ${MAX_DOC_SEQ} ${prefix} numbers for ${fy}`);
  return `${prefix}/${compactFy(fy)}/${String(seq).padStart(5, '0')}`;
}

export function suggestInvoicePrefix(branchCode: string, terminalCode: string, taken: ReadonlySet<string>): string {
  const digits = terminalCode.replace(/\D/gu, '');
  const fromCodes = `${branchCode.slice(0, 2)}${(digits || terminalCode).slice(-2)}`.toUpperCase().replace(/[^A-Z0-9]/gu, '').slice(0, 4);
  if (INVOICE_PREFIX.test(fromCodes) && !taken.has(fromCodes)) return fromCodes;
  for (let n = 1; ; n++) if (!taken.has(`T${n}`)) return `T${n}`;
}
