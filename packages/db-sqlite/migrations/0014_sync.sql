-- 0014_sync — Stage 7 (ADR-0039–0041): the device's cloud identity, review items pulled from the cloud, hydration progress,
-- the cloud version applied per entity, and the natural-key aliases for rows each device seeds under its own ids.

CREATE TABLE sync_device (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  installation_id TEXT NOT NULL,
  cloud_device_id TEXT NOT NULL,
  protocol        INTEGER NOT NULL,
  schema_version  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','upgrade_required')),
  status_detail   TEXT,
  updated_at      TEXT NOT NULL
);

-- Review items (ADR-0041): conflicts, duplicate barcodes and late arrivals, as the cloud resolved them. Read-only here.
CREATE TABLE conflict_log (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL,
  kind              TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  device_id         TEXT,
  rule              TEXT NOT NULL,
  winner            TEXT NOT NULL,
  field             TEXT,
  cloud_value_json  TEXT,
  device_value_json TEXT,
  occurred_at       TEXT NOT NULL,
  received_at       TEXT NOT NULL,
  reviewed_at       TEXT,
  reviewed_by       TEXT
);
CREATE INDEX ix_conflict_log_open ON conflict_log(business_id, reviewed_at, occurred_at);

CREATE TABLE hydration_state (
  business_id      TEXT PRIMARY KEY,
  snapshot_id      TEXT,
  url              TEXT,
  as_of_seq        INTEGER,
  bytes_total      INTEGER,
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  lines_imported   INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','downloading','importing','ready','failed')),
  error            TEXT,
  updated_at       TEXT NOT NULL
);

-- The cloud version last applied per entity, so a page applied twice changes nothing (7e).
CREATE TABLE sync_entity_version (
  business_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  version     INTEGER NOT NULL,
  PRIMARY KEY (business_id, entity_type, entity_id)
);

-- ADR-0040 natural keys: another device's unit, account, category, price list or warehouse that this device already has under its own id.
CREATE TABLE sync_id_alias (
  business_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  remote_id   TEXT NOT NULL,
  local_id    TEXT NOT NULL,
  PRIMARY KEY (business_id, entity_type, remote_id)
);

-- ADR-0040: movements replay by (occurred_at, origin device, origin order) on every device.
CREATE INDEX ix_mov_replay ON stock_movement(business_id, warehouse_id, product_id, occurred_at, device_id, id);
