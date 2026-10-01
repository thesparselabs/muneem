import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';

// Held carts are this till's working state: never synced, never audited as documents.
export interface HeldBillRow { id: string; label: string | null; cartJson: string; heldBy: string; heldAt: string; sessionId: string }

type Row = { id: string; label: string | null; cart_json: string; held_by: string; held_at: string; session_id: string };
const toRow = (r: Row): HeldBillRow => ({ id: r.id, label: r.label, cartJson: r.cart_json, heldBy: r.held_by, heldAt: r.held_at, sessionId: r.session_id });

export function insertHeldBill(db: Db, b: { id: string; businessId: string; terminalId: string; sessionId: string; label: string | null; cartJson: string; heldBy: string }): void {
  stmt(db, `INSERT INTO held_bill (id, business_id, terminal_id, session_id, label, cart_json, held_by, held_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(b.id, b.businessId, b.terminalId, b.sessionId, b.label, b.cartJson, b.heldBy, nowIso());
}

export function listHeldBills(db: Db, businessId: string, terminalId: string): HeldBillRow[] {
  return (stmt(db, 'SELECT * FROM held_bill WHERE business_id = ? AND terminal_id = ? ORDER BY held_at, id').all(businessId, terminalId) as Row[]).map(toRow);
}

export function takeHeldBill(db: Db, businessId: string, terminalId: string, id: string): HeldBillRow | null {
  const r = stmt(db, 'SELECT * FROM held_bill WHERE id = ? AND business_id = ? AND terminal_id = ?').get(id, businessId, terminalId) as Row | undefined;
  if (!r) return null;
  stmt(db, 'DELETE FROM held_bill WHERE id = ?').run(id);
  return toRow(r);
}
