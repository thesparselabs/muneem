import type { Db } from '../open.js';
import { stmt } from '../statements.js';

// The stored columns another device needs to file a document exactly as its origin did (7e), beyond what the document's view carries.
const COLUMNS = {
  sale: ['branch_id', 'series_id', 'doc_seq', 'fy', 'command_id', 'tax_scheme', 'price_list_id', 'place_of_supply_reason'],
  purchase: ['series_id', 'doc_seq', 'fy', 'place_of_supply_state', 'command_id', 'note'],
  debit_note: ['branch_id', 'warehouse_id', 'series_id', 'doc_seq', 'fy', 'command_id'],
  payment: ['branch_id', 'terminal_id', 'session_id', 'series_id', 'doc_seq', 'fy', 'command_id', 'reference', 'note'],
  expense: ['branch_id', 'terminal_id', 'session_id', 'series_id', 'doc_seq', 'fy', 'command_id', 'round_off_paise', 'supplier_id', 'vendor_name',
    'vendor_gstin', 'supply_type', 'due_date', 'reference', 'description'],
  write_off: ['command_id'],
  credit_note: ['branch_id', 'terminal_id', 'session_id', 'warehouse_id', 'series_id', 'doc_seq', 'fy', 'command_id'],
} as const;
export type KeyedDocument = keyof typeof COLUMNS;

const camel = (c: string): string => c.replace(/_([a-z])/gu, (_, x: string) => x.toUpperCase());

export function documentKeys(db: Db, table: KeyedDocument, id: string): Record<string, unknown> {
  const cols = COLUMNS[table];
  const row = stmt(db, `SELECT ${cols.join(', ')} FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? Object.fromEntries(cols.map((c) => [camel(c), row[c] ?? null])) : {};
}

export interface DrawerMovement { id: string; sessionId: string; kind: string; amountPaise: number; reason: string; createdAt: string }

// Cash a payment or expense moved through a drawer travels with the document (5d details).
export const drawerMovements = (db: Db, refType: 'payment' | 'expense', refId: string): DrawerMovement[] =>
  stmt(db, `SELECT id, session_id AS sessionId, kind, amount_paise AS amountPaise, reason, created_at AS createdAt FROM cash_movement
    WHERE ref_type = ? AND ref_id = ? ORDER BY rowid`).all(refType, refId) as DrawerMovement[];
