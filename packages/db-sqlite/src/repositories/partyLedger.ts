import { AppError } from '@muneem/contracts';
import { newUlid, reconcileParties, type PartyType, type Reconciliation } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import type { Actor } from './business.js';
import { syncColumns } from './catalogWrite.js';
import { PARTY_DOCUMENTS_SQL, type PartyDocumentRow } from './partyDocuments.js';

export type PartyRefType = 'sale' | 'purchase' | 'debit_note' | 'payment' | 'write_off' | 'opening' | 'expense';

export interface PartyEntryInput {
  businessId: string; partyType: PartyType; partyId: string; refType: PartyRefType; refId: string; kind: 'post' | 'cancel';
  amountPaise: number;         // positive = the party owes the business
  docDate: string; dueDate?: string | null;
}
export interface PartyEntry extends PartyEntryInput { id: string; dueDate: string | null }

type EntryRow = {
  id: string; business_id: string; party_type: PartyType; party_id: string; ref_type: PartyRefType; ref_id: string; entry_kind: 'post' | 'cancel';
  amount_paise: number; doc_date: string; due_date: string | null;
};
const toEntry = (r: EntryRow): PartyEntry => ({
  id: r.id, businessId: r.business_id, partyType: r.party_type, partyId: r.party_id, refType: r.ref_type, refId: r.ref_id, kind: r.entry_kind,
  amountPaise: r.amount_paise, docDate: r.doc_date, dueDate: r.due_date,
});

function findEntry(db: Db, businessId: string, refType: PartyRefType, refId: string, kind: 'post' | 'cancel'): PartyEntry | null {
  const r = stmt(db, 'SELECT * FROM party_ledger_entry WHERE business_id = ? AND ref_type = ? AND ref_id = ? AND entry_kind = ?')
    .get(businessId, refType, refId, kind) as EntryRow | undefined;
  return r ? toEntry(r) : null;
}

const sameEntry = (a: PartyEntry, b: PartyEntryInput): boolean =>
  a.partyType === b.partyType && a.partyId === b.partyId && a.amountPaise === b.amountPaise && a.docDate === b.docDate;

// The only writer of party_ledger_entry (ADR-0022); runs inside the document's transaction and travels in its sync payload.
export function postPartyEntry(db: Db, e: PartyEntryInput, actor: Actor): PartyEntry {
  if (!Number.isSafeInteger(e.amountPaise) || e.amountPaise === 0) throw new AppError('INVALID_STATE', 'A ledger entry needs a non-zero amount');
  const existing = findEntry(db, e.businessId, e.refType, e.refId, e.kind);
  if (existing) {
    if (sameEntry(existing, e)) return existing;
    throw new AppError('INVALID_STATE', `${e.refType} ${e.refId} already has a different ${e.kind} entry`);
  }
  if (e.kind === 'cancel') {
    const posted = findEntry(db, e.businessId, e.refType, e.refId, 'post');
    if (!posted || posted.partyId !== e.partyId || posted.partyType !== e.partyType || posted.amountPaise !== -e.amountPaise) {
      throw new AppError('INVALID_STATE', `a cancel entry must reverse the posted entry of ${e.refType} ${e.refId}`);
    }
  }
  const s = syncColumns(actor);
  const id = newUlid();
  stmt(db, `INSERT INTO party_ledger_entry (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, due_date,
      occurred_at, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @partyType, @partyId, @refType, @refId, @kind, @amountPaise, @docDate, @dueDate, @t, @t, @t, @created_by, @device_id)`)
    .run({ id, ...e, dueDate: e.dueDate ?? null, t: s.t, created_by: s.created_by, device_id: s.device_id });
  return { ...e, id, dueDate: e.dueDate ?? null };
}

export const entriesForRef = (db: Db, businessId: string, refType: PartyRefType, refId: string): PartyEntry[] =>
  (stmt(db, 'SELECT * FROM party_ledger_entry WHERE business_id = ? AND ref_type = ? AND ref_id = ? ORDER BY rowid')
    .all(businessId, refType, refId) as EntryRow[]).map(toEntry);

// The Stage 5 exit check against the database: Σ entries per party = open charges − unallocated settlements.
export function reconcilePartiesDb(db: Db, businessId: string): Reconciliation {
  const entries = (stmt(db, 'SELECT party_type, party_id, amount_paise FROM party_ledger_entry WHERE business_id = ?').all(businessId) as {
    party_type: PartyType; party_id: string; amount_paise: number;
  }[]).map((r) => ({ partyType: r.party_type, partyId: r.party_id, amountPaise: r.amount_paise }));
  const docs = (stmt(db, `SELECT * FROM (${PARTY_DOCUMENTS_SQL}) WHERE business_id = ?`).all(businessId) as PartyDocumentRow[])
    .map((d) => ({ role: d.role, doc: { id: d.id, partyType: d.party_type, partyId: d.party_id, amountPaise: d.amount_paise, live: d.live === 1 } }));
  const allocations = (stmt(db, 'SELECT source_id, target_id, amount_paise, voided_at IS NULL AS live FROM allocation WHERE business_id = ?').all(businessId) as {
    source_id: string; target_id: string; amount_paise: number; live: number;
  }[]).map((a) => ({ sourceId: a.source_id, targetId: a.target_id, amountPaise: a.amount_paise, live: a.live === 1 }));
  return reconcileParties({
    entries,
    charges: docs.filter((d) => d.role === 'charge').map((d) => d.doc),
    settlements: docs.filter((d) => d.role === 'settlement').map((d) => d.doc),
    allocations,
  });
}
