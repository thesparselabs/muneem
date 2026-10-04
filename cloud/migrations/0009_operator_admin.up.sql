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

-- A dead letter an operator resolved no longer counts as unresolved, so the dead-letters alert clears (9c's probe).
CREATE OR REPLACE FUNCTION health_businesses(silent_after INTERVAL, breaks_within INTERVAL)
RETURNS TABLE (business_id TEXT, devices_active INT, devices_silent INT, outbox_depth_max INT, oldest_pending_at TIMESTAMPTZ,
               negative_stock_max INT, dead_letters_unresolved BIGINT, audit_chain_breaks BIGINT, newest_backup_at TIMESTAMPTZ,
               business_created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT b.id, d.active, d.silent, d.depth, d.oldest, d.negative,
    (SELECT count(DISTINCT dl.operation_id) FROM dead_letter dl WHERE dl.business_id = b.id AND dl.resolved_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM sync_operation s WHERE s.business_id = dl.business_id AND s.operation_id = dl.operation_id AND s.status = 'applied')),
    (SELECT count(*) FROM conflict_log c WHERE c.business_id = b.id AND c.kind = 'audit_chain_broken' AND c.created_at > now() - breaks_within),
    (SELECT max(k.confirmed_at) FROM backup k WHERE k.business_id = b.id AND k.status = 'ready'),
    b.created_at
  FROM business b
  JOIN LATERAL (
    SELECT count(*)::INT AS active,
      count(*) FILTER (WHERE dv.last_seen_at IS NULL OR dv.last_seen_at < now() - silent_after)::INT AS silent,
      coalesce(max(dv.outbox_depth), 0)::INT AS depth,
      min(dv.oldest_pending_at) AS oldest,
      coalesce(max(dv.negative_stock_count), 0)::INT AS negative
    FROM device dv WHERE dv.business_id = b.id AND dv.status = 'active'
  ) d ON d.active > 0
$$;
