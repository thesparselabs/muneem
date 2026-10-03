// Every document that a party owes on (charge) or that clears what it owes (settlement), in one shape (ADR-0022/0025).
// usedPaise is settled_paise on a charge and allocated_paise on a settlement; both are kept by the allocation triggers.
export const PARTY_DOCUMENTS_SQL = `
  SELECT 'charge' AS role, 'sale' AS type, id, business_id, 'customer' AS party_type, customer_id AS party_id, doc_number, doc_date,
    COALESCE(due_date, doc_date) AS due_date, credit_paise AS amount_paise, settled_paise AS used_paise, status = 'posted' AS live
  FROM sale WHERE customer_id IS NOT NULL AND credit_paise > 0
  UNION ALL SELECT 'charge', 'purchase', id, business_id, 'supplier', supplier_id, doc_number, doc_date, due_date, total_paise, settled_paise,
    status = 'posted' FROM purchase
  UNION ALL SELECT 'charge', 'expense', id, business_id, 'supplier', supplier_id, doc_number, expense_date, due_date, total_paise, settled_paise,
    status = 'posted' FROM expense WHERE method = 'credit'
  UNION ALL SELECT CASE WHEN side = CASE party_type WHEN 'customer' THEN 'receivable' ELSE 'payable' END THEN 'charge' ELSE 'settlement' END,
    'opening', id, business_id, party_type, party_id, NULL, as_of_date, as_of_date, amount_paise,
    CASE WHEN side = CASE party_type WHEN 'customer' THEN 'receivable' ELSE 'payable' END THEN settled_paise ELSE allocated_paise END,
    status = 'posted' FROM party_opening
  UNION ALL SELECT 'settlement', 'payment', id, business_id, party_type, party_id, doc_number, payment_date, payment_date, amount_paise,
    allocated_paise, status = 'posted' FROM payment
  UNION ALL SELECT 'settlement', 'debit_note', id, business_id, 'supplier', supplier_id, doc_number, doc_date, doc_date, total_paise,
    allocated_paise, status = 'posted' FROM debit_note
  UNION ALL SELECT 'settlement', 'write_off', id, business_id, 'customer', customer_id, NULL, doc_date, doc_date, amount_paise,
    allocated_paise, status = 'posted' FROM write_off`;

export type PartyDocumentRole = 'charge' | 'settlement';
export interface PartyDocumentRow {
  role: PartyDocumentRole; type: string; id: string; party_type: 'customer' | 'supplier'; party_id: string; doc_number: string | null;
  doc_date: string; due_date: string; amount_paise: number; used_paise: number; live: 0 | 1;
}
