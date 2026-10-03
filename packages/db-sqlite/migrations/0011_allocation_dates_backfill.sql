-- 0011_allocation_dates_backfill — Stage 5i (#2): 0009 dated old allocations by the UTC day they were written. Re-date
-- only those rows by the 5h rule: made with its document → the later of the settling and settled documents' dates;
-- made later → the later of the day it was made and the settled document's date. Voids take the source's cancel date.

DROP TRIGGER trg_allocation_on_frozen;

UPDATE allocation SET allocated_on = (
  SELECT MAX(COALESCE(
      CASE WHEN abs(julianday(allocation.allocated_at) - julianday(src.created_at)) * 86400 < 60 THEN src.doc_date END,
      substr(allocation.allocated_at, 1, 10)),
    COALESCE(tgt.doc_date, substr(allocation.allocated_at, 1, 10)))
  FROM (SELECT
      CASE allocation.source_type
        WHEN 'payment' THEN (SELECT payment_date FROM payment WHERE id = allocation.source_id)
        WHEN 'debit_note' THEN (SELECT doc_date FROM debit_note WHERE id = allocation.source_id)
        WHEN 'write_off' THEN (SELECT doc_date FROM write_off WHERE id = allocation.source_id)
        WHEN 'opening' THEN (SELECT as_of_date FROM party_opening WHERE id = allocation.source_id) END AS doc_date,
      CASE allocation.source_type
        WHEN 'payment' THEN (SELECT created_at FROM payment WHERE id = allocation.source_id)
        WHEN 'debit_note' THEN (SELECT created_at FROM debit_note WHERE id = allocation.source_id)
        WHEN 'write_off' THEN (SELECT created_at FROM write_off WHERE id = allocation.source_id)
        WHEN 'opening' THEN (SELECT created_at FROM party_opening WHERE id = allocation.source_id) END AS created_at) src,
    (SELECT CASE allocation.target_type
        WHEN 'sale' THEN (SELECT doc_date FROM sale WHERE id = allocation.target_id)
        WHEN 'purchase' THEN (SELECT doc_date FROM purchase WHERE id = allocation.target_id)
        WHEN 'expense' THEN (SELECT expense_date FROM expense WHERE id = allocation.target_id)
        WHEN 'opening' THEN (SELECT as_of_date FROM party_opening WHERE id = allocation.target_id) END AS doc_date) tgt)
WHERE allocated_on = substr(allocated_at, 1, 10);

UPDATE allocation SET voided_on = (
  SELECT e.doc_date FROM party_ledger_entry e WHERE e.business_id = allocation.business_id AND e.ref_type = allocation.source_type
    AND e.ref_id = allocation.source_id AND e.entry_kind = 'cancel')
WHERE voided_at IS NOT NULL AND voided_on = substr(voided_at, 1, 10)
  AND EXISTS (SELECT 1 FROM party_ledger_entry e WHERE e.business_id = allocation.business_id AND e.ref_type = allocation.source_type
    AND e.ref_id = allocation.source_id AND e.entry_kind = 'cancel');

CREATE TRIGGER trg_allocation_on_frozen BEFORE UPDATE OF allocated_on ON allocation
  BEGIN SELECT RAISE(ABORT, 'allocation is append-only'); END;
