-- 0006 — each device's audit hash chain, verified on ingest (Stage 8g, ADR-0048). Append-only: no UPDATE or DELETE grant.
CREATE TABLE audit_entry (
  business_id   TEXT NOT NULL REFERENCES business(id),
  device_id     TEXT NOT NULL,                       -- the chain's device (the row's device_id), not necessarily the pusher
  seq           BIGINT NOT NULL CHECK (seq > 0),
  prev_hash     TEXT NOT NULL,
  hash          TEXT NOT NULL,
  row           JSONB NOT NULL,                      -- the audit_log row as the device stored it
  operation_id  TEXT NOT NULL,
  pushed_by     TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, device_id, seq)
);

GRANT SELECT, INSERT ON audit_entry TO muneem_api;
GRANT SELECT ON audit_entry TO muneem_readonly;
ALTER TABLE audit_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_entry_tenant ON audit_entry TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));

-- A broken chain is a review item every device lists.
ALTER TABLE conflict_log DROP CONSTRAINT conflict_log_kind_check;
ALTER TABLE conflict_log ADD CONSTRAINT conflict_log_kind_check
  CHECK (kind IN ('field_conflict','tombstone_wins','duplicate_barcode','late_arrival','audit_chain_broken'));
