import type { PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

// Every document that a party owes on (charge) or that clears what it owes (settlement), in one shape (ADR-0022/0025).
// usedPaise is settled_paise on a charge and allocated_paise on a settlement; both are kept by the allocation triggers.
// Each branch filters by @businessId (and by @partyId when asked) on its own index, so a query reads one party's documents, not the shop's (5h #10).
const usual = "CASE party_type WHEN 'customer' THEN 'receivable' ELSE 'payable' END";
const COLS = (role: string, type: string, party: string, partyId: string, number: string, docDate: string, dueDate: string, amount: string, used: string) =>
  `SELECT ${role} AS role, '${type}' AS type, id, business_id, ${party} AS party_type, ${partyId} AS party_id, ${number} AS doc_number, ${docDate} AS doc_date,
    ${dueDate} AS due_date, ${amount} AS amount_paise, ${used} AS used_paise, status = 'posted' AS live`;
const OPENING_ROLE = `CASE WHEN side = ${usual} THEN 'charge' ELSE 'settlement' END`;
const BRANCHES: readonly { partyType: PartyType | null; party: string; sql: string }[] = [
  { partyType: 'customer', party: 'customer_id', sql: `${COLS("'charge'", 'sale', "'customer'", 'customer_id', 'doc_number', 'doc_date', 'COALESCE(due_date, doc_date)', 'credit_paise', 'settled_paise')}
    FROM sale WHERE customer_id IS NOT NULL AND credit_paise > 0` },
  { partyType: 'supplier', party: 'supplier_id', sql: `${COLS("'charge'", 'purchase', "'supplier'", 'supplier_id', 'doc_number', 'doc_date', 'due_date', 'total_paise', 'settled_paise')} FROM purchase WHERE 1` },
  { partyType: 'supplier', party: 'supplier_id', sql: `${COLS("'charge'", 'expense', "'supplier'", 'supplier_id', 'doc_number', 'expense_date', 'due_date', 'total_paise', 'settled_paise')}
    FROM expense WHERE method = 'credit'` },
  { partyType: null, party: 'party_id', sql: `${COLS(OPENING_ROLE, 'opening', 'party_type', 'party_id', 'NULL', 'as_of_date', 'as_of_date', 'amount_paise',
    `CASE WHEN side = ${usual} THEN settled_paise ELSE allocated_paise END`)} FROM party_opening WHERE 1` },
  { partyType: null, party: 'party_id', sql: `${COLS("'settlement'", 'payment', 'party_type', 'party_id', 'doc_number', 'payment_date', 'payment_date', 'amount_paise', 'allocated_paise')} FROM payment WHERE 1` },
  { partyType: 'supplier', party: 'supplier_id', sql: `${COLS("'settlement'", 'debit_note', "'supplier'", 'supplier_id', 'doc_number', 'doc_date', 'doc_date', 'total_paise', 'allocated_paise')} FROM debit_note WHERE 1` },
  { partyType: 'customer', party: 'customer_id', sql: `${COLS("'settlement'", 'write_off', "'customer'", 'customer_id', 'NULL', 'doc_date', 'doc_date', 'amount_paise', 'allocated_paise')} FROM write_off WHERE 1` },
];

// The document union for one business, narrowed to a party type (@partyType) and to one party (@partyId) when asked.
export function partyDocumentsSql(f: { partyType?: PartyType; byParty?: boolean } = {}): string {
  return BRANCHES.filter((b) => !f.partyType || b.partyType === null || b.partyType === f.partyType).map((b) => {
    const typeFilter = f.partyType && b.partyType === null ? ' AND party_type = @partyType' : '';
    return `${b.sql} AND business_id = @businessId${typeFilter}${f.byParty ? ` AND ${b.party} = @partyId` : ''}`;
  }).join('\n  UNION ALL ');
}

export type PartyDocumentRole = 'charge' | 'settlement';
export interface PartyDocumentRow {
  role: PartyDocumentRole; type: string; id: string; party_type: 'customer' | 'supplier'; party_id: string; doc_number: string | null;
  doc_date: string; due_date: string; amount_paise: number; used_paise: number; live: 0 | 1;
}

const NUMBERED: Record<string, string> = { sale: 'sale', purchase: 'purchase', debit_note: 'debit_note', payment: 'payment', expense: 'expense' };

// Document numbers for just the rows being shown, by indexed id lookups per type.
export function docNumbers(db: Db, refs: readonly { type: string; id: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const type of new Set(refs.map((r) => r.type))) {
    const table = NUMBERED[type];
    if (!table) continue;
    const ids = [...new Set(refs.filter((r) => r.type === type).map((r) => r.id))];
    for (const id of ids) {
      const n = stmt(db, `SELECT doc_number FROM ${table} WHERE id = ?`).pluck().get(id) as string | undefined;
      if (n !== undefined) out.set(`${type}:${id}`, n);
    }
  }
  return out;
}
