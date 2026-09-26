-- 0001_init — Stage 1 schema (LLD §2 conventions). Products/sales/inventory/accounting arrive in later migrations.
-- Every syncable business table carries: id, business_id, created_at, updated_at, created_by, device_id, version, sync_state, deleted_at.
-- Money columns are INTEGER paise; quantities INTEGER milli; rates INTEGER basis points (CI schema-lint enforces).

CREATE TABLE app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE local_sequence (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  next_seq INTEGER NOT NULL
);
INSERT INTO local_sequence (id, next_seq) VALUES (1, 1);

CREATE TABLE organization (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'synced' CHECK (sync_state IN ('pending','synced','conflict'))
);

CREATE TABLE business (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  name            TEXT NOT NULL,
  legal_name      TEXT,
  business_type   TEXT NOT NULL CHECK (business_type IN ('retail','wholesale','distribution','service','restaurant','trading','other')),
  address_line1   TEXT, address_line2 TEXT, city TEXT,
  state_code      TEXT NOT NULL CHECK (length(state_code) = 2),
  pin_code        TEXT, phone TEXT, email TEXT, gstin TEXT, pan TEXT,
  tax_scheme      TEXT NOT NULL CHECK (tax_scheme IN ('regular','composition','unregistered')),
  fy_start_month  INTEGER NOT NULL DEFAULT 4,
  logo_document_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);

CREATE TABLE branch (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  address_line1 TEXT, city TEXT,
  state_code    TEXT NOT NULL CHECK (length(state_code) = 2),
  gstin         TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  UNIQUE (business_id, code)
);
CREATE UNIQUE INDEX ux_branch_default ON branch(business_id) WHERE is_default = 1 AND deleted_at IS NULL;

CREATE TABLE terminal (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  branch_id   TEXT NOT NULL REFERENCES branch(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  device_id_bound TEXT,                       -- the device this terminal is bound to (NULL = unbound)
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  UNIQUE (business_id, branch_id, code)
);

CREATE TABLE user (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  identifier TEXT NOT NULL,                   -- mobile or email as typed at login
  email      TEXT, mobile TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_user_identifier ON user(identifier);

-- Cloud-authoritative permission snapshot, read-only cache on device (LLD §9, §15.3)
CREATE TABLE user_membership (
  user_id         TEXT NOT NULL REFERENCES user(id),
  business_id     TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  business_name   TEXT,
  roles_json      TEXT NOT NULL,
  grants_json     TEXT NOT NULL,
  perm_ver        INTEGER NOT NULL,
  issued_at       TEXT NOT NULL,
  PRIMARY KEY (user_id, business_id)
);

-- Offline credential cache (LLD §15.2): Argon2id hashes only, never a password or token.
CREATE TABLE user_credential (
  user_id              TEXT PRIMARY KEY REFERENCES user(id),
  password_hash        TEXT NOT NULL,
  pin_hash             TEXT,
  last_online_auth_at  TEXT NOT NULL,
  failed_pin_attempts  INTEGER NOT NULL DEFAULT 0,
  pin_locked_until     TEXT,
  max_offline_days     INTEGER NOT NULL DEFAULT 30,
  updated_at           TEXT NOT NULL
);

CREATE TABLE doc_series (                      -- C-2 / LLD §6; used from Stage 3
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  branch_id   TEXT REFERENCES branch(id),
  terminal_id TEXT REFERENCES terminal(id),
  doc_type    TEXT NOT NULL,
  fy          TEXT NOT NULL,
  prefix      TEXT NOT NULL,
  pad_width   INTEGER NOT NULL DEFAULT 6,
  next_seq    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  UNIQUE (business_id, doc_type, fy, branch_id, terminal_id)
);

CREATE TABLE setting (
  business_id TEXT NOT NULL,
  key         TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (business_id, key)
);

CREATE TABLE sync_outbox (                     -- LLD §2.6, verbatim
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL, device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create','update','cancel','void')),
  payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
  depends_on_operation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_flight','sent','failed','dead','superseded')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT, last_attempt_at TEXT,
  error_code TEXT, error_message TEXT, error_class TEXT,
  created_at TEXT NOT NULL, batch_id TEXT
);
CREATE INDEX ix_outbox_ready ON sync_outbox(status, next_attempt_at, seq);
CREATE INDEX ix_outbox_entity ON sync_outbox(business_id, entity_type, entity_id, seq);

CREATE TABLE sync_cursor (                     -- FR-085
  business_id TEXT NOT NULL, stream TEXT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0, last_pulled_at TEXT,
  PRIMARY KEY (business_id, stream)
);

CREATE TABLE sync_log (                        -- last push/pull outcome for the status badge
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_push_at TEXT, last_push_ok INTEGER, last_pull_at TEXT, last_pull_ok INTEGER, last_error TEXT
);
INSERT INTO sync_log (id) VALUES (1);

CREATE TABLE audit_log (                       -- FR-078 + hash chain (LLD §16)
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT NOT NULL, device_id TEXT NOT NULL, terminal_id TEXT,
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
  before_json TEXT, after_json TEXT, reason TEXT,
  occurred_at TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL,
  UNIQUE (business_id, device_id, seq)
);
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TABLE backup_log (
  id TEXT PRIMARY KEY, path TEXT NOT NULL, bytes INTEGER NOT NULL, verified INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scheduled','manual','pre_migration')), created_at TEXT NOT NULL
);
