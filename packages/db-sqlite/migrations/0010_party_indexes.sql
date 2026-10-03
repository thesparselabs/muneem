-- 0010_party_indexes — Stage 5h (#10): every party document can be found by its party, so statements and open items
-- read one party's documents rather than the whole shop's.

CREATE INDEX ix_expense_supplier ON expense(business_id, supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX ix_debit_note_supplier ON debit_note(business_id, supplier_id);
CREATE INDEX ix_write_off_customer ON write_off(business_id, customer_id);
