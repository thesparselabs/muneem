import { AppError } from '@muneem/contracts';
import { docSeriesPrefix, financialYearOf, monthEnd, monthStart, newUlid, nextMonthStart, reverse, totals, type JournalLine } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { appendAudit } from '../audit.js';
import { accountIdsByRoleAndCode, ensureChartOfAccounts, type AccountIds } from './account.js';
import type { Actor } from './business.js';
import { getTerminal } from './business.js';
import { syncColumns } from './catalogWrite.js';
import { allocateDocNumber } from './docSeries.js';
import { findOrCreateSeries } from './sale.js';

export type JournalSource =
  | 'sale' | 'sale_return' | 'purchase' | 'purchase_return' | 'receipt' | 'payment' | 'expense' | 'stock_adjustment' | 'transfer'
  | 'manual' | 'opening' | 'closing' | 'round_off' | 'write_off' | 'register_close' | 'cash_movement';

export interface JournalInput {
  businessId: string; branchId?: string | null; terminalId?: string | null;
  source: JournalSource; refType: string; refId: string;
  entryNo?: string;            // the document's own number; otherwise a J number from the terminal's journal series
  docDate: string; narration?: string | null; lines: readonly JournalLine[];
}
// Everything another device needs to store the same journal (Stage 7a).
export interface PostedJournal {
  id: string; entryNo: string; entryDate: string; periodId: string; lines: readonly JournalLine[];
  source: JournalSource; refType: string; refId: string; docDate: string; narration: string | null; branchId: string | null; terminalId: string | null;
  latePosting: boolean; reversalOf: string | null;
}

// ADR-0033: a document dated into a locked month posts into the earliest open month after it, on that month's first day.
function postingPeriod(db: Db, businessId: string, docDate: string, actor: Actor): { periodId: string; entryDate: string; late: boolean } {
  let start = monthStart(docDate);
  let periodId = ensurePeriod(db, businessId, start, actor);
  let late = false;
  while ((stmt(db, 'SELECT status FROM accounting_period WHERE id = ?').pluck().get(periodId) as string) === 'locked') {
    late = true;
    start = nextMonthStart(start);
    periodId = ensurePeriod(db, businessId, start, actor);
  }
  return { periodId, entryDate: late ? start : docDate, late };
}

// Calendar months, made on demand (ADR-0033).
export function ensurePeriod(db: Db, businessId: string, date: string, actor: Actor): string {
  const start = monthStart(date);
  const found = stmt(db, 'SELECT id FROM accounting_period WHERE business_id = ? AND period_start = ?').pluck().get(businessId, start) as string | undefined;
  if (found) return found;
  const id = newUlid();
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO accounting_period (id, business_id, fy, period_start, period_end, created_at, updated_at, created_by, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, financialYearOf(date), start, monthEnd(start), s.t, s.t, s.created_by, s.device_id);
  return id;
}

function journalNumber(db: Db, j: JournalInput, actor: Actor): string {
  if (j.entryNo) return j.entryNo;
  if (!j.terminalId || !j.branchId) throw new AppError('INVALID_STATE', 'A journal without a document number needs a terminal to number it');
  const prefix = docSeriesPrefix(getTerminal(db, j.terminalId)!.invoicePrefix, 'journal');
  const seriesId = findOrCreateSeries(db, { businessId: j.businessId, branchId: j.branchId, terminalId: j.terminalId, docType: 'journal', fy: financialYearOf(j.docDate) }, prefix, actor, 5);
  return allocateDocNumber(db, seriesId).number;
}

const accountFor = (accounts: AccountIds, l: JournalLine): string | undefined =>
  'role' in l.account ? accounts.byRole.get(l.account.role) : accounts.byCode.get(l.account.code);

// The chart is seeded only when a line names an account the business does not have yet.
function resolveAccounts(db: Db, j: JournalInput, actor: Actor): string[] {
  let accounts = accountIdsByRoleAndCode(db, j.businessId);
  if (j.lines.some((l) => !accountFor(accounts, l))) {
    ensureChartOfAccounts(db, j.businessId, actor);
    accounts = accountIdsByRoleAndCode(db, j.businessId);
  }
  return j.lines.map((l) => {
    const id = accountFor(accounts, l);
    if (!id) throw new AppError('INVALID_STATE', `no account for ${'role' in l.account ? l.account.role : l.account.code}`);
    return id;
  });
}

interface Placement { id: string; entryNo: string; entryDate: string; periodId: string; late: boolean; reversalOf: string | null; createdAt?: string }

function assertBalanced(j: JournalInput): number {
  const { debit, credit } = totals(j.lines);
  if (debit !== credit) throw new AppError('LEDGER_IMBALANCE', `journal for ${j.source} ${j.refId} does not balance: ${debit} ≠ ${credit}`);
  return debit;
}

function writeJournal(db: Db, j: JournalInput, p: Placement, actor: Actor): PostedJournal {
  const total = assertBalanced(j);
  const accountIds = resolveAccounts(db, j, actor);
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO journal_entry (id, business_id, branch_id, terminal_id, entry_no, entry_date, doc_date, fy, period_id, source, ref_type, ref_id,
      narration, debit_total_paise, credit_total_paise, is_reversal_of, late_posting, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @entryNo, @entryDate, @docDate, @fy, @periodId, @source, @refType, @refId, @narration, @total, @total,
      @reversalOf, @late, @t, @t, @created_by, @device_id)`).run({
    id: p.id, businessId: j.businessId, branchId: j.branchId ?? null, terminalId: j.terminalId ?? null, entryNo: p.entryNo, entryDate: p.entryDate, docDate: j.docDate,
    fy: financialYearOf(p.entryDate), periodId: p.periodId, source: j.source, refType: j.refType, refId: j.refId, narration: j.narration ?? null, total,
    reversalOf: p.reversalOf, late: p.late ? 1 : 0, ...s, ...(p.createdAt && { t: p.createdAt }),
  });
  const line = stmt(db, `INSERT INTO journal_line (id, entry_id, business_id, line_no, account_id, debit_paise, credit_paise, party_type, party_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const balance = stmt(db, `INSERT INTO account_balance (business_id, account_id, period_id, debit_paise, credit_paise) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (account_id, period_id) DO UPDATE SET debit_paise = debit_paise + excluded.debit_paise, credit_paise = credit_paise + excluded.credit_paise`);
  j.lines.forEach((l, i) => {
    line.run(`${p.id}-${String(i + 1).padStart(3, '0')}`, p.id, j.businessId, i + 1, accountIds[i], l.debitPaise, l.creditPaise, l.party?.partyType ?? null, l.party?.partyId ?? null);
    balance.run(j.businessId, accountIds[i], p.periodId, l.debitPaise, l.creditPaise);
  });
  return {
    id: p.id, entryNo: p.entryNo, entryDate: p.entryDate, periodId: p.periodId, lines: j.lines, source: j.source, refType: j.refType, refId: j.refId,
    docDate: j.docDate, narration: j.narration ?? null, branchId: j.branchId ?? null, terminalId: j.terminalId ?? null, latePosting: p.late, reversalOf: p.reversalOf,
  };
}

// The only writer of journals and their balance cache (ADR-0030); runs in the document's transaction.
export function postJournal(db: Db, j: JournalInput, actor: Actor, reversalOf: string | null = null): PostedJournal | null {
  if (j.lines.length === 0) return null;
  assertBalanced(j);
  const { periodId, entryDate, late } = postingPeriod(db, j.businessId, j.docDate, actor);
  const posted = writeJournal(db, j, { id: newUlid(), entryNo: journalNumber(db, j, actor), entryDate, periodId, late, reversalOf }, actor);
  if (late) {
    appendAudit(db, {
      businessId: j.businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId,
      action: 'journal.late_posting', entityType: 'journal_entry', entityId: posted.id, after: { source: j.source, refId: j.refId, docDate: j.docDate, entryDate },
    });
  }
  return posted;
}

export interface SyncedJournalInput extends JournalInput { id: string; entryNo: string; entryDate: string; latePosting: boolean; reversalOf: string | null; createdAt?: string }

// ADR-0040: another device's journal keeps its id, number and entry date; its period is this device's month. Applying it twice writes nothing.
export function postSyncedJournal(db: Db, j: SyncedJournalInput, actor: Actor): PostedJournal | null {
  if (j.lines.length === 0 || stmt(db, 'SELECT 1 FROM journal_entry WHERE id = ?').get(j.id)) return null;
  const periodId = ensurePeriod(db, j.businessId, j.entryDate, actor);
  return writeJournal(db, j, {
    id: j.id, entryNo: j.entryNo, entryDate: j.entryDate, periodId, late: j.latePosting, reversalOf: j.reversalOf, ...(j.createdAt && { createdAt: j.createdAt }),
  }, actor);
}

type LineRow = { debit_paise: number; credit_paise: number; party_type: 'customer' | 'supplier' | null; party_id: string | null; code: string; role: string | null };

export interface StoredJournal { id: string; entryNo: string; branchId: string | null; terminalId: string | null; lines: JournalLine[] }

export function journalForRef(db: Db, businessId: string, source: JournalSource, refId: string): StoredJournal | null {
  const e = stmt(db, 'SELECT id, entry_no, branch_id, terminal_id FROM journal_entry WHERE business_id = ? AND source = ? AND ref_id = ? AND is_reversal_of IS NULL')
    .get(businessId, source, refId) as { id: string; entry_no: string; branch_id: string | null; terminal_id: string | null } | undefined;
  if (!e) return null;
  const lines = (stmt(db, `SELECT l.debit_paise, l.credit_paise, l.party_type, l.party_id, a.code, a.role FROM journal_line l JOIN account a ON a.id = l.account_id
      WHERE l.entry_id = ? ORDER BY l.line_no`).all(e.id) as LineRow[]).map((r): JournalLine => ({
    account: { code: r.code }, debitPaise: r.debit_paise, creditPaise: r.credit_paise,
    ...(r.party_type && r.party_id && { party: { partyType: r.party_type, partyId: r.party_id } }),
  }));
  return { id: e.id, entryNo: e.entry_no, branchId: e.branch_id, terminalId: e.terminal_id, lines };
}

// A cancellation: the same lines on the other side, dated the day of the cancel (ADR-0030/0033).
export function reverseJournal(db: Db, j: Omit<JournalInput, 'lines'>, actor: Actor): PostedJournal | null {
  const original = journalForRef(db, j.businessId, j.source, j.refId);
  if (!original) return null;
  if (stmt(db, 'SELECT 1 FROM journal_entry WHERE is_reversal_of = ?').pluck().get(original.id)) throw new AppError('INVALID_STATE', `${original.entryNo} is already reversed`);
  return postJournal(db, {
    ...j, branchId: j.branchId ?? original.branchId, terminalId: j.terminalId ?? original.terminalId, entryNo: j.entryNo ?? `${original.entryNo} (rev)`,
    lines: reverse(original.lines),
  }, actor, original.id);
}
