DELETE FROM conflict_log WHERE kind = 'audit_chain_broken';
ALTER TABLE conflict_log DROP CONSTRAINT conflict_log_kind_check;
ALTER TABLE conflict_log ADD CONSTRAINT conflict_log_kind_check
  CHECK (kind IN ('field_conflict','tombstone_wins','duplicate_barcode','late_arrival'));
DROP TABLE IF EXISTS audit_entry;
