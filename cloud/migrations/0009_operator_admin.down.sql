DROP POLICY IF EXISTS audit_log_admin_append ON audit_log;
DROP POLICY IF EXISTS dead_letter_admin_resolve ON dead_letter;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['business','device','entitlement','sync_operation','dead_letter','conflict_log','backup','audit_log'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_read', t);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM muneem_admin;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM muneem_admin;
REVOKE ALL ON SCHEMA public FROM muneem_admin;
DROP INDEX IF EXISTS ix_dead_letter_open;
ALTER TABLE dead_letter DROP COLUMN resolution_note, DROP COLUMN resolution, DROP COLUMN resolved_by, DROP COLUMN resolved_at;
DROP TABLE IF EXISTS operator_grant;
