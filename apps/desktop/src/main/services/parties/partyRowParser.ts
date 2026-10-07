import type { OPENING_SIDES, PartyImportField, PartyImportMapping } from '@muneem/contracts';
import { parseScaled, type PartyType } from '@muneem/domain';

export type PartyRowErrors = Partial<Record<PartyImportField, string>>;
export interface OpeningDraft { side: (typeof OPENING_SIDES)[number]; amountPaise: number; asOfDate: string }
export interface PartyRowDraft { fields: Record<string, string | number>; opening?: OpeningDraft }

const TAX_SCHEMES = ['regular', 'composition', 'unregistered'];
const USUAL_SIDE = { customer: 'receivable', supplier: 'payable' } as const;
const OTHER_SIDE = { receivable: 'payable', payable: 'receivable' } as const;

// 2026-04-01, 01/04/2026 or 01-04-2026; anything that is not a real calendar day is refused.
export function parseBusinessDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/u.exec(text);
  const [y, m, d] = iso ? [iso[1]!, iso[2]!, iso[3]!] : dmy ? [dmy[3]!, dmy[2]!.padStart(2, '0'), dmy[1]!.padStart(2, '0')] : [];
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? `${y}-${m}-${d}` : null;
}

function openingOf(amountText: string | undefined, dateText: string | undefined, partyType: PartyType, today: string, errors: PartyRowErrors): OpeningDraft | undefined {
  if (amountText === undefined) return undefined;
  const amount = parseScaled(amountText, 2);
  if (amount === null) { errors.openingBalance = `"${amountText}" is not a valid amount`; return undefined; }
  if (amount === 0) return undefined;
  const asOfDate = dateText === undefined ? today : parseBusinessDate(dateText);
  if (asOfDate === null) { errors.openingDate = `"${dateText}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`; return undefined; }
  if (asOfDate > today) { errors.openingDate = 'the opening date is in the future'; return undefined; }
  const usual = USUAL_SIDE[partyType];
  return { side: amount > 0 ? usual : OTHER_SIDE[usual], amountPaise: Math.abs(amount), asOfDate };
}

export function parsePartyRow(cells: readonly string[], mapping: PartyImportMapping, partyType: PartyType, today: string): { draft: PartyRowDraft; errors: PartyRowErrors } {
  const errors: PartyRowErrors = {};
  const text = (field: PartyImportField): string | undefined => {
    const index = mapping[field];
    const value = index === undefined ? undefined : cells[index]?.trim();
    return value ? value : undefined;
  };
  const gstin = text('gstin')?.toUpperCase();
  const stateText = text('stateCode');
  const stateCode = stateText !== undefined && /^\d{1,2}$/u.test(stateText) ? stateText.padStart(2, '0') : stateText;
  if (gstin && stateCode && gstin.slice(0, 2) !== stateCode) errors.stateCode = `the GSTIN is from state ${gstin.slice(0, 2)}`;
  const creditText = text('creditDays');
  if (creditText !== undefined && !/^\d{1,3}$/u.test(creditText)) errors.creditDays = `"${creditText}" is not a number of days`;
  const scheme = text('taxScheme')?.toLowerCase() ?? (gstin ? 'regular' : 'unregistered');
  if (partyType === 'supplier' && !TAX_SCHEMES.includes(scheme)) errors.taxScheme = `use ${TAX_SCHEMES.join(', ')}`;

  const fields: Record<string, string | number | undefined> = {
    name: text('name') ?? '', phone: text('phone')?.replace(/[\s\-()]/gu, ''), email: text('email'), gstin, stateCode: stateCode ?? gstin?.slice(0, 2),
    addressLine1: text('addressLine1'), city: text('city'), pinCode: text('pinCode'),
    creditDays: creditText !== undefined && !errors.creditDays ? Number(creditText) : undefined,
    taxScheme: partyType === 'supplier' ? scheme : undefined,
  };
  const opening = openingOf(text('openingBalance'), text('openingDate'), partyType, today, errors);
  const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Record<string, string | number>;
  return { draft: { fields: defined, ...(opening && { opening }) }, errors };
}
