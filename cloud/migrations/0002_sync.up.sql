-- 0002_sync — Stage 7 ingest, pull and review (ADR-0038/0039/0041).

CREATE TABLE sync_operation (                      -- idempotency record (ADR-0039)
  business_id   TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  operation_id  TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  payload_hash  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('applied','rejected')),
  server_seq    BIGINT,
  error_code    TEXT,
  device_seq    BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, device_id, operation_id)
);
CREATE INDEX ix_sync_operation_op ON sync_operation(business_id, operation_id) WHERE status = 'applied';

CREATE TABLE change_log (                          -- the pull cursor and hydration watermark
  seq              BIGSERIAL PRIMARY KEY,
  business_id      TEXT NOT NULL,
  stream           TEXT NOT NULL CHECK (stream IN ('masters','config','documents','control')),
  entity_type      TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  op               TEXT NOT NULL CHECK (op IN ('upsert','delete')),
  version          INT NOT NULL,
  payload          JSONB NOT NULL,
  origin_device_id TEXT,                           -- NULL when the stored result differs from what the device sent
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_change_log_pull ON change_log(business_id, stream, seq);
CREATE INDEX ix_change_log_entity ON change_log(business_id, entity_type, entity_id, version);

CREATE TABLE entity_state (                        -- latest payload per entity (ADR-0038)
  business_id      TEXT NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  version          INT NOT NULL,
  payload          JSONB NOT NULL,
  origin_device_id TEXT,
  writer_device_id TEXT NOT NULL,                  -- the last signed pusher; breaks last-writer-wins ties
  last_seq         BIGINT NOT NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, entity_type, entity_id)
);
CREATE INDEX ix_entity_state_barcode ON entity_state(business_id, (payload->>'code')) WHERE entity_type = 'barcode' AND deleted_at IS NULL;

CREATE TABLE journal_entry (
  id               TEXT PRIMARY KEY,
  business_id      TEXT NOT NULL,
  entry_no         TEXT NOT NULL,
  entry_date       DATE NOT NULL,
  doc_date         DATE NOT NULL,
  period_id        TEXT NOT NULL,
  source           TEXT NOT NULL,
  ref_type         TEXT NOT NULL,
  ref_id           TEXT NOT NULL,
  narration        TEXT,
  branch_id        TEXT,
  terminal_id      TEXT,
  late_posting     BOOLEAN NOT NULL,
  reversal_of      TEXT,
  origin_device_id TEXT NOT NULL,
  server_seq       BIGINT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_journal_entry_business ON journal_entry(business_id, entry_date);

CREATE TABLE journal_line (
  journal_id   TEXT NOT NULL REFERENCES journal_entry(id),
  line_no      INT NOT NULL,
  business_id  TEXT NOT NULL,
  account_role TEXT,
  account_code TEXT,
  debit_paise  BIGINT NOT NULL CHECK (debit_paise >= 0),
  credit_paise BIGINT NOT NULL CHECK (credit_paise >= 0),
  party_type   TEXT,
  party_id     TEXT,
  PRIMARY KEY (journal_id, line_no),
  CHECK (account_role IS NOT NULL OR account_code IS NOT NULL)
);
CREATE INDEX ix_journal_line_business ON journal_line(business_id);

CREATE TABLE dead_letter (                         -- rejected operations, kept whole (ADR-0038)
  id           BIGSERIAL PRIMARY KEY,
  business_id  TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  operation    JSONB NOT NULL,
  error_code   TEXT NOT NULL,
  error_detail TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_dead_letter_business ON dead_letter(business_id, created_at);

CREATE TABLE conflict_log (                        -- review items: merges, duplicates, late arrivals (ADR-0041)
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('field_conflict','tombstone_wins','duplicate_barcode','late_arrival')),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  detail       JSONB NOT NULL,
  server_seq   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_conflict_log_business ON conflict_log(business_id, created_at);

CREATE TABLE snapshot (                            -- hydration bundles (7f)
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('building','ready','failed')),
  as_of_seq   BIGINT,
  object_key  TEXT,
  bytes       BIGINT,
  error       TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_snapshot_business ON snapshot(business_id, created_at);

GRANT SELECT, INSERT, UPDATE ON sync_operation, entity_state, snapshot TO muneem_api;
GRANT SELECT, INSERT ON change_log, journal_entry, journal_line, dead_letter, conflict_log TO muneem_api;
GRANT USAGE, SELECT ON SEQUENCE change_log_seq_seq, dead_letter_id_seq TO muneem_api;
GRANT SELECT ON sync_operation, change_log, entity_state, journal_entry, journal_line, dead_letter, conflict_log, snapshot TO muneem_readonly;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sync_operation','change_log','entity_state','journal_entry','journal_line','dead_letter','conflict_log','snapshot'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I TO muneem_api, muneem_readonly USING (business_id = current_setting(''app.business_id'', true)) WITH CHECK (business_id = current_setting(''app.business_id'', true))', t || '_tenant', t);
  END LOOP;
END $$;
