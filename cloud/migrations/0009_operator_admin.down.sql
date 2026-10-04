-- Restore 9c's probe before dropping the column it now reads.
CREATE OR REPLACE FUNCTION health_businesses(silent_after INTERVAL, breaks_within INTERVAL)
RETURNS TABLE (business_id TEXT, devices_active INT, devices_silent INT, outbox_depth_max INT, oldest_pending_at TIMESTAMPTZ,
               negative_stock_max INT, dead_letters_unresolved BIGINT, audit_chain_breaks BIGINT, newest_backup_at TIMESTAMPTZ,
               business_created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT b.id, d.active, d.silent, d.depth, d.oldest, d.negative,
    (SELECT count(DISTINCT dl.operation_id) FROM dead_letter dl WHERE dl.business_id = b.id
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
