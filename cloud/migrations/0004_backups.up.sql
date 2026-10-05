-- 0004 — encrypted device backups in object storage and their escrowed data keys (Stage 8f, ADR-0047).
CREATE TABLE backup (
  id               TEXT PRIMARY KEY,
  business_id      TEXT NOT NULL REFERENCES business(id),
  device_id        TEXT NOT NULL REFERENCES device(id),
  object_key       TEXT NOT NULL,
  bytes            BIGINT NOT NULL CHECK (bytes > 0),
  sha256           TEXT NOT NULL,
  key_id           TEXT NOT NULL,
  schema_version   INT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('pending','ready')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at     TIMESTAMPTZ
);
CREATE INDEX ix_backup_business ON backup(business_id, status, created_at);

CREATE TABLE backup_key (                          -- the data key wrapped by MUNEEM_BACKUP_MASTER_KEY
  business_id      TEXT NOT NULL REFERENCES business(id),
  key_id           TEXT NOT NULL,
  nonce            BYTEA NOT NULL,
  wrapped          BYTEA NOT NULL,
  device_id        TEXT NOT NULL REFERENCES device(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, key_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON backup TO muneem_api;
GRANT SELECT, INSERT ON backup_key TO muneem_api;
GRANT SELECT ON backup TO muneem_readonly;

ALTER TABLE backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_key ENABLE ROW LEVEL SECURITY;
CREATE POLICY backup_tenant ON backup TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));
CREATE POLICY backup_key_tenant ON backup_key TO muneem_api
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));
-- A member reads a backup by id before any business scope is set (GET /backups/{id}).
CREATE POLICY backup_member ON backup FOR SELECT TO muneem_api, muneem_readonly
  USING (EXISTS (SELECT 1 FROM business_membership m WHERE m.business_id = backup.business_id AND m.user_id = current_setting('app.user_id', true)));
