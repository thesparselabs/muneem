import { AppError, type JournalView, type ManualJournalInput } from '@muneem/contracts';
import type { AccountRole, JournalLine } from '@muneem/domain';
import { journalForRef, listAccounts, postJournal, recordChange, reverseJournal, stmt, withTransaction } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

// ADR-0035: these move only through documents, so their tie-outs with the sub-ledgers always hold.
const CONTROL_ROLES = new Set<AccountRole>([
  'ar', 'ap', 'inventory', 'input_cgst', 'input_sgst', 'input_igst', 'input_cess', 'output_cgst', 'output_sgst', 'output_igst', 'output_cess',
]);

export class ManualJournalService {
  constructor(private readonly ctx: PosContext) {}

  post(input: ManualJournalInput): JournalView {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const done = journalForRef(db, businessId, 'manual', input.commandId);
    if (done) return this.view(done.id);
    const date = input.date ?? this.ctx.today();
    const lines = this.lines(input);
    this.refuseLocked(date);
    const id = withTransaction(db, () => {
      const again = journalForRef(db, businessId, 'manual', input.commandId);
      if (again) return again.id;
      const till = this.ctx.till();
      const j = postJournal(db, { businessId, branchId: till.branchId, terminalId: till.terminalId, source: 'manual', refType: 'manual', refId: input.commandId,
        docDate: date, narration: input.narration, lines }, this.ctx.actor())!;
      recordChange(db, businessId, this.ctx.actor(), { action: 'journal.manual', entityType: 'journal_entry', entityId: j.id, operationType: 'create', after: { ...j, narration: input.narration } });
      return j.id;
    });
    return this.view(id);
  }

  // Only a typed journal can be reversed here; a document's journal is reversed by cancelling the document.
  reverse(id: string, reason: string, dateIn?: string): JournalView {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const e = stmt(db, 'SELECT source, ref_id, is_reversal_of FROM journal_entry WHERE id = ? AND business_id = ?').get(id, businessId) as
      { source: string; ref_id: string; is_reversal_of: string | null } | undefined;
    if (!e) throw new AppError('NOT_FOUND', 'Journal not found');
    if (e.source !== 'manual' || e.is_reversal_of) throw new AppError('INVALID_STATE', 'Only a manual journal can be reversed here; cancel the document instead');
    const date = dateIn ?? this.ctx.today();
    this.refuseLocked(date);
    const reversalId = withTransaction(db, () => {
      const till = this.ctx.till();
      const j = reverseJournal(db, { businessId, branchId: till.branchId, terminalId: till.terminalId, source: 'manual', refType: 'manual', refId: e.ref_id, docDate: date,
        narration: `Reversal: ${reason}` }, this.ctx.actor());
      if (!j) throw new AppError('INVALID_STATE', 'Nothing to reverse');
      recordChange(db, businessId, this.ctx.actor(), { action: 'journal.reverse', entityType: 'journal_entry', entityId: j.id, operationType: 'create', after: { ...j, reversalOf: id, reason } });
      return j.id;
    });
    return this.view(reversalId);
  }

  private lines(input: ManualJournalInput): JournalLine[] {
    const accounts = new Map(listAccounts(this.ctx.db(), this.ctx.businessId()).map((a) => [a.id, a]));
    const fields: Record<string, string> = {};
    const lines = input.lines.map((l, i): JournalLine => {
      const a = accounts.get(l.accountId);
      if (!a) fields[`lines.${i}.accountId`] = 'not an account of this business';
      else if (a.isGroup) fields[`lines.${i}.accountId`] = `${a.name} is a group; choose an account under it`;
      else if (a.role && CONTROL_ROLES.has(a.role)) fields[`lines.${i}.accountId`] = `${a.name} changes only through documents`;
      if ((l.debitPaise === 0) === (l.creditPaise === 0)) fields[`lines.${i}`] = 'enter either a debit or a credit';
      return { account: { code: a?.code ?? '' }, debitPaise: l.debitPaise, creditPaise: l.creditPaise };
    });
    const debit = lines.reduce((s, l) => s + l.debitPaise, 0);
    const credit = lines.reduce((s, l) => s + l.creditPaise, 0);
    if (debit !== credit) fields.lines = `debits ${debit / 100} and credits ${credit / 100} must be equal`;
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'This journal cannot be posted', fields);
    return lines;
  }

  // Typed journals are refused in a locked month; late posting is for documents (ADR-0035).
  private refuseLocked(date: string): void {
    const status = stmt(this.ctx.db(), 'SELECT status FROM accounting_period WHERE business_id = ? AND period_start = ?').pluck()
      .get(this.ctx.businessId(), `${date.slice(0, 7)}-01`) as string | undefined;
    if (status === 'locked') throw new AppError('PERIOD_LOCKED', `${date.slice(0, 7)} is locked`);
  }

  private view(id: string): JournalView {
    const e = stmt(this.ctx.db(), 'SELECT id, entry_no, entry_date, debit_total_paise FROM journal_entry WHERE id = ?').get(id) as
      { id: string; entry_no: string; entry_date: string; debit_total_paise: number };
    return { id: e.id, entryNo: e.entry_no, date: e.entry_date, totalPaise: e.debit_total_paise };
  }
}
