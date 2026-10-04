import type { JournalLine } from '@muneem/domain';
import { postSyncedJournal, type JournalSource } from '../../repositories/journal.js';
import type { ApplyContext, Payload } from './context.js';

// ADR-0040: postJournal's synced mode, so journals and the balance cache still have one writer.
export function applyJournal(ctx: ApplyContext, j: unknown): void {
  if (!j || typeof j !== 'object') return;
  const p = j as Payload;
  postSyncedJournal(ctx.db, {
    businessId: ctx.businessId, id: String(p.id), entryNo: String(p.entryNo), entryDate: String(p.entryDate), latePosting: p.latePosting === true,
    reversalOf: typeof p.reversalOf === 'string' ? p.reversalOf : null, branchId: (p.branchId as string | null) ?? null, terminalId: (p.terminalId as string | null) ?? null,
    source: p.source as JournalSource, refType: String(p.refType), refId: String(p.refId), docDate: String(p.docDate), narration: (p.narration as string | null) ?? null,
    lines: (p.lines ?? []) as JournalLine[],
  }, ctx.actor);
}

export const applyJournals = (ctx: ApplyContext, journals: unknown): void => {
  if (Array.isArray(journals)) for (const j of journals) applyJournal(ctx, j);
};

export const applyJournalEntry = (ctx: ApplyContext): void => applyJournal(ctx, ctx.change.payload);
