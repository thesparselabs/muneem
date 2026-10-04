import type { SyncErrorCode } from '@muneem/contracts';

type Payload = Record<string, unknown>;
interface Line { debitPaise: number; creditPaise: number }
interface Heads { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number }

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const sum = <T>(xs: readonly T[] | undefined, f: (x: T) => number): number => (xs ?? []).reduce((s, x) => s + f(x), 0);
const taxed = (h: Partial<Heads>): number => num(h.taxablePaise) + num(h.cgstPaise) + num(h.sgstPaise) + num(h.igstPaise) + num(h.cessPaise);

function journalsOf(entityType: string, p: Payload): Payload[] {
  if (entityType === 'journal_entry') return [p];
  const out: Payload[] = [];
  if (p.journal && typeof p.journal === 'object') out.push(p.journal as Payload);
  if (Array.isArray(p.corrections)) out.push(...(p.corrections as Payload[]));
  return out;
}

const balanced = (j: Payload): boolean => {
  const lines = (j.lines ?? []) as Line[];
  return lines.length > 0 && sum(lines, (l) => l.debitPaise) === sum(lines, (l) => l.creditPaise);
};

function saleTotalsHold(p: Payload): boolean {
  const t = (p.totals ?? {}) as Partial<Heads> & { roundOffPaise?: number; totalPaise?: number };
  const lines = (p.lines ?? []) as { totalPaise: number }[];
  const tenders = (p.tenders ?? []) as { amountPaise: number; changePaise: number }[];
  const total = num(t.totalPaise);
  return taxed(t) + num(t.roundOffPaise) === total && sum(lines, (l) => l.totalPaise) + num(t.roundOffPaise) === total
    && sum(tenders, (x) => x.amountPaise - x.changePaise) === total;
}

function purchaseTotalsHold(p: Payload): boolean {
  const t = (p.totals ?? {}) as Partial<Heads> & { chargesPaise?: number; roundOffPaise?: number; totalPaise?: number };
  const lines = (p.lines ?? []) as { totalPaise: number }[];
  const extra = num(t.chargesPaise) + num(t.roundOffPaise);
  return taxed(t) + extra === num(t.totalPaise) && sum(lines, (l) => l.totalPaise) + extra === num(t.totalPaise);
}

const debitNoteTotalsHold = (p: Payload): boolean =>
  taxed(p as Partial<Heads>) + num(p.chargesPaise) + num(p.roundOffPaise) === num(p.totalPaise);

const TOTALS: Record<string, (p: Payload) => boolean> = { sale: saleTotalsHold, purchase: purchaseTotalsHold, debit_note: debitNoteTotalsHold };

// The light verifier (ADR-0042): document totals add up and every journal in the payload balances.
export function verifyOperation(entityType: string, operationType: string, payload: Payload): SyncErrorCode | null {
  const totals = operationType === 'create' ? TOTALS[entityType] : undefined;
  if (totals && !totals(payload)) return 'TOTAL_MISMATCH';
  if (!journalsOf(entityType, payload).every(balanced)) return 'JOURNAL_IMBALANCE';
  return null;
}
