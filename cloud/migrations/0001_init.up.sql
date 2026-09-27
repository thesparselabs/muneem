-- 0001_init — Stage 1 cloud schema (LLD §11). Ids are TEXT ULIDs (device-minted). Money = BIGINT paise.

CREATE TABLE organization (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  identifier    TEXT NOT NULL UNIQUE,            -- lower-cased mobile or email
  email         TEXT,
  mobile        TEXT,
  password_hash TEXT NOT NULL,                   -- Argon2id PHC string
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_member (
  organization_id TEXT NOT NULL REFERENCES organization(id),
  user_id         TEXT NOT NULL REFERENCES app_user(id),
  role            TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE business (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  name            TEXT NOT NULL,
  legal_name      TEXT,
  business_type   TEXT NOT NULL CHECK (business_type IN ('retail','wholesale','distribution','service','restaurant','trading','other')),
  address_line1   TEXT, address_line2 TEXT, city TEXT,
  state_code      TEXT NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
  pin_code        TEXT, phone TEXT, email TEXT, gstin TEXT, pan TEXT,
  tax_scheme      TEXT NOT NULL CHECK (tax_scheme IN ('regular','composition','unregistered')),
  fy_start_month  INT NOT NULL DEFAULT 4,
  version         INT NOT NULL DEFAULT 1,
  created_by      TEXT NOT NULL REFERENCES app_user(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX ix_business_org ON business(organization_id);

-- Cloud-authoritative permission snapshot per (user, business) — LLD §9 / §15.3
CREATE TABLE business_membership (
  user_id     TEXT NOT NULL REFERENCES app_user(id),
  business_id TEXT NOT NULL REFERENCES business(id),
  roles_json  JSONB NOT NULL,
  grants_json JSONB NOT NULL,
  perm_ver    INT NOT NULL DEFAULT 1,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);
CREATE INDEX ix_membership_business ON business_membership(business_id);

CREATE TABLE branch (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  address_line1 TEXT, city TEXT,
  state_code    TEXT NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
  gstin         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  version       INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (business_id, code)
);

CREATE TABLE terminal (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  branch_id   TEXT NOT NULL REFERENCES branch(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  device_id   TEXT,
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (business_id, branch_id, code)
);

CREATE TABLE device (                               -- LLD §11
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL REFERENCES organization(id),
  business_id         TEXT REFERENCES business(id),  -- NULL until a business is chosen
  registered_by       TEXT NOT NULL REFERENCES app_user(id),
  installation_id     TEXT NOT NULL UNIQUE,
  name                TEXT,
  machine_fingerprint TEXT,
  public_key          TEXT NOT NULL,                 -- base64 Ed25519
  platform            TEXT NOT NULL,
  app_version         TEXT NOT NULL,
  schema_version      INT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  last_seen_at        TIMESTAMPTZ,
  last_push_seq       BIGINT,
  last_pull_seq       BIGINT,
  outbox_depth        INT,
  clock_skew_ms       INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_device_business ON device(business_id);

CREATE TABLE refresh_token (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES app_user(id),
  family_id  TEXT NOT NULL,                        -- rotation chain; reuse detection revokes the family
  token_hash TEXT NOT NULL UNIQUE,                 -- sha256 hex of the opaque token
  device_id  TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,                          -- set when rotated
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_family ON refresh_token(family_id);

CREATE TABLE entitlement (                          -- LLD §11 / FR-102
  business_id        TEXT PRIMARY KEY REFERENCES business(id),
  plan               TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('trial','active','past_due','expired')),
  device_limit       INT NOT NULL,
  valid_until        DATE NOT NULL,
  offline_grace_days INT NOT NULL DEFAULT 14,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  business_id TEXT,                                -- NULL for account-level events
  user_id     TEXT,
  device_id   TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  before_json JSONB,
  after_json  JSONB,
  request_id  TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_business ON audit_log(business_id, occurred_at);

CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- ---- Roles (NOLOGIN; a deployment grants them to its login user) ----
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'muneem_api') THEN CREATE ROLE muneem_api NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'muneem_readonly') THEN CREATE ROLE muneem_readonly NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO muneem_api, muneem_readonly;
GRANT SELECT, INSERT, UPDATE ON organization, app_user, organization_member, business, business_membership,
  branch, terminal, device, refresh_token, entitlement TO muneem_api;
GRANT DELETE ON refresh_token, organization_member, business_membership TO muneem_api;
GRANT SELECT, INSERT ON audit_log TO muneem_api;             -- no UPDATE/DELETE, ever
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO muneem_api;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO muneem_readonly;

-- ---- Row-level security (NFR-008, HLD §5.2) ----
-- The API sets, per transaction: SET LOCAL app.user_id = <sub>; and for business-scoped work SET LOCAL app.business_id = <id>.
-- Policies apply to muneem_api/muneem_readonly only; the migration/admin owner is unrestricted.
ALTER TABLE business ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_tenant ON business TO muneem_api, muneem_readonly
  USING (id = current_setting('app.business_id', true)
      OR (current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) <> ''
          AND (created_by = current_setting('app.user_id', true)
               OR EXISTS (SELECT 1 FROM business_membership m WHERE m.business_id = business.id AND m.user_id = current_setting('app.user_id', true)))))
  WITH CHECK (created_by = current_setting('app.user_id', true));

ALTER TABLE business_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_tenant ON business_membership TO muneem_api, muneem_readonly
  USING (user_id = current_setting('app.user_id', true) OR business_id = current_setting('app.business_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true) OR business_id = current_setting('app.business_id', true));

ALTER TABLE branch ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_tenant ON branch TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE terminal ENABLE ROW LEVEL SECURITY;
CREATE POLICY terminal_tenant ON terminal TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));

ALTER TABLE entitlement ENABLE ROW LEVEL SECURITY;
CREATE POLICY entitlement_tenant ON entitlement TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));

-- device: visible to its registering user (pre-business) or within its business tenant; signature
-- verification happens before any tenant context exists, so lookup by id is allowed for the API role.
ALTER TABLE device ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_tenant ON device TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)
      OR registered_by = current_setting('app.user_id', true)
      OR id = current_setting('app.device_id', true))
  WITH CHECK (registered_by = current_setting('app.user_id', true) OR business_id = current_setting('app.business_id', true));

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant ON audit_log TO muneem_api, muneem_readonly
  USING (business_id IS NULL OR business_id = current_setting('app.business_id', true))
  WITH CHECK (true);

-- refresh_token / app_user / organization: user-scoped tables; authentication happens before app.user_id is set,
-- so these remain readable by the API role without RLS (they hold no tenant business data).
