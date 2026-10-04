-- 0009 — operator tooling (Stage 9i, ADR-0057). Operators are granted on the server only (muneem-api grant-operator).
-- muneem_admin reads across shops through its own SELECT policies, and writes only dead-letter resolutions and its
-- own audit rows; business-scoped actions (revoke, resend) still run as the RLS app role inside the shop's scope.
CREATE TABLE operator_grant (
  user_id    TEXT PRIMARY KEY REFERENCES app_user(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by TEXT NOT NULL,                        -- the database role that ran grant-operator
  revoked_at TIMESTAMPTZ
);

ALTER TABLE dead_letter
  ADD COLUMN resolved_at     TIMESTAMPTZ,
  ADD COLUMN resolved_by     TEXT,
  ADD COLUMN resolution      TEXT CHECK (resolution IN ('resent','dismissed')),
  ADD COLUMN resolution_note TEXT;
CREATE INDEX ix_dead_letter_open ON dead_letter(business_id, id) WHERE resolved_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'muneem_admin') THEN CREATE ROLE muneem_admin NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO muneem_admin;
GRANT SELECT ON organization, business, device, entitlement, sync_operation, dead_letter, conflict_log, backup, audit_log,
  operator_grant TO muneem_admin;
GRANT SELECT (id, name, identifier, password_hash, is_active) ON app_user TO muneem_admin;
GRANT UPDATE (resolved_at, resolved_by, resolution, resolution_note) ON dead_letter TO muneem_admin;
GRANT INSERT ON audit_log TO muneem_admin;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO muneem_admin;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['business','device','entitlement','sync_operation','dead_letter','conflict_log','backup','audit_log'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO muneem_admin USING (true)', t || '_admin_read', t);
  END LOOP;
END $$;
CREATE POLICY dead_letter_admin_resolve ON dead_letter FOR UPDATE TO muneem_admin USING (true) WITH CHECK (resolved_at IS NOT NULL);
CREATE POLICY audit_log_admin_append ON audit_log FOR INSERT TO muneem_admin WITH CHECK (action LIKE 'admin.%');
