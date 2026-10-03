import type { AgeingBuckets, LedgerPage, Outstanding } from '@muneem/contracts';
import { ageingBucket, type PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { PARTY_DOCUMENTS_SQL, type PartyDocumentRole } from './partyDocuments.js';

type Cursor = { d: string; id: string };
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
}

export interface PartyRef { businessId: string; partyType: PartyType; partyId: string }

export interface OpenItemRow {
  role: PartyDocumentRole; type: string; id: string; docNumber: string | null; docDate: string; dueDate: string; amountPaise: number; openPaise: number;
}

// Live charges with something still owed and live settlements with something still to apply, oldest due first.
export function openItems(db: Db, p: PartyRef): OpenItemRow[] {
  return (stmt(db, `SELECT role, type, id, doc_number, doc_date, due_date, amount_paise, amount_paise - used_paise AS open_paise
      FROM (${PARTY_DOCUMENTS_SQL})
      WHERE business_id = @businessId AND party_type = @partyType AND party_id = @partyId AND live = 1 AND amount_paise > used_paise
      ORDER BY due_date, doc_date, id`).all(p) as {
    role: PartyDocumentRole; type: string; id: string; doc_number: string | null; doc_date: string; due_date: string; amount_paise: number; open_paise: number;
  }[]).map((r) => ({
    role: r.role, type: r.type, id: r.id, docNumber: r.doc_number, docDate: r.doc_date, dueDate: r.due_date, amountPaise: r.amount_paise, openPaise: r.open_paise,
  }));
}

// FR-039: entries in date order with a running balance; positive = the party owes the business.
export function partyStatement(db: Db, p: PartyRef, f: { from?: string | undefined; to?: string | undefined; limit: number; cursor?: string | undefined }): LedgerPage {
  const after = decode(f.cursor);
  const params = { ...p, from: f.from ?? null, to: f.to ?? null };
  const sumWhere = (cond: string) => stmt(db, `SELECT COALESCE(SUM(amount_paise), 0) FROM party_ledger_entry
    WHERE business_id = @businessId AND party_type = @partyType AND party_id = @partyId AND ${cond}`).pluck().get(params) as number;
  const rows = stmt(db, `SELECT e.*, d.doc_number FROM (
        SELECT id, ref_type, ref_id, entry_kind, amount_paise, doc_date, due_date,
          SUM(amount_paise) OVER (ORDER BY doc_date, id) AS balance
        FROM party_ledger_entry WHERE business_id = @businessId AND party_type = @partyType AND party_id = @partyId) e
      LEFT JOIN (${PARTY_DOCUMENTS_SQL}) d ON d.id = e.ref_id AND d.type = e.ref_type
      WHERE (@from IS NULL OR e.doc_date >= @from) AND (@to IS NULL OR e.doc_date <= @to)
        AND (@afterDate IS NULL OR (e.doc_date, e.id) > (@afterDate, @afterId))
      ORDER BY e.doc_date, e.id LIMIT @limit`).all({ ...params, afterDate: after?.d ?? null, afterId: after?.id ?? null, limit: f.limit + 1 }) as {
    id: string; ref_type: string; ref_id: string; entry_kind: 'post' | 'cancel'; amount_paise: number; doc_date: string; due_date: string | null;
    balance: number; doc_number: string | null;
  }[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    openingBalancePaise: f.from ? sumWhere('doc_date < @from') : 0,
    items: page.map((r) => ({
      id: r.id, refType: r.ref_type, refId: r.ref_id, kind: r.entry_kind, docDate: r.doc_date, amountPaise: r.amount_paise, balancePaise: r.balance,
      ...(r.doc_number !== null && { docNumber: r.doc_number }), ...(r.due_date !== null && { dueDate: r.due_date }),
    })),
    closingBalancePaise: f.to ? sumWhere('doc_date <= @to') : sumWhere('1 = 1'),
    nextCursor: rows.length > f.limit && last ? encode({ d: last.doc_date, id: last.id }) : null,
  };
}

const emptyBuckets = (): AgeingBuckets => ({
  notDuePaise: 0, days0to30Paise: 0, days31to60Paise: 0, days61to90Paise: 0, over90Paise: 0, advancePaise: 0, netPaise: 0,
});
const BUCKET_FIELD = {
  notDue: 'notDuePaise', days0to30: 'days0to30Paise', days31to60: 'days31to60Paise', days61to90: 'days61to90Paise', over90: 'over90Paise',
} as const;

// Open charges aged by days past their due date; unallocated settlements are the party's advance.
export function partyOutstanding(db: Db, businessId: string, partyType: PartyType, asOf: string, partyId?: string): Outstanding {
  const party = partyType === 'customer' ? 'customer' : 'supplier';
  const rows = stmt(db, `SELECT d.role, d.party_id, d.due_date, d.amount_paise - d.used_paise AS open_paise, n.name
      FROM (${PARTY_DOCUMENTS_SQL}) d JOIN ${party} n ON n.id = d.party_id
      WHERE d.business_id = @businessId AND d.party_type = @partyType AND d.live = 1 AND d.amount_paise > d.used_paise
        AND d.doc_date <= @asOf AND (@partyId IS NULL OR d.party_id = @partyId)
      ORDER BY n.name_norm, n.id`).all({ businessId, partyType, asOf, partyId: partyId ?? null }) as {
    role: PartyDocumentRole; party_id: string; due_date: string; open_paise: number; name: string;
  }[];
  const byParty = new Map<string, AgeingBuckets & { partyId: string; name: string }>();
  const totals = emptyBuckets();
  for (const r of rows) {
    const row = byParty.get(r.party_id) ?? { ...emptyBuckets(), partyId: r.party_id, name: r.name };
    byParty.set(r.party_id, row);
    const field = r.role === 'charge' ? BUCKET_FIELD[ageingBucket(r.due_date, asOf)] : 'advancePaise';
    const signed = r.role === 'charge' ? r.open_paise : -r.open_paise;
    for (const b of [row, totals]) { b[field] += r.open_paise; b.netPaise += signed; }
  }
  return { asOf, rows: [...byParty.values()], totals };
}
