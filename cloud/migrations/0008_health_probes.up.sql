-- 0008 — business-health probes (Stage 9c, ADR-0053). The device's push heartbeat lands on its row; the probe job reads
-- cross-tenant aggregates through SECURITY DEFINER functions, so the API role sees counts and ages but never tenant rows.
ALTER TABLE device
  ADD COLUMN oldest_pending_at    TIMESTAMPTZ,
  ADD COLUMN negative_stock_count INT,
  ADD COLUMN heartbeat_at         TIMESTAMPTZ;

CREATE INDEX ix_dead_letter_created ON dead_letter(created_at);

-- Each device's latest integrity run (ADR-0054), carried on its push heartbeat.
CREATE TABLE device_integrity (
  device_id            TEXT PRIMARY KEY REFERENCES device(id),
  business_id          TEXT NOT NULL REFERENCES business(id),
  checked_at           TIMESTAMPTZ NOT NULL,
  tie_out_failures     INT NOT NULL,
  replay_mismatches    INT NOT NULL,
  audit_chain_ok       BOOLEAN NOT NULL,
  journal_count        BIGINT NOT NULL,
  journal_debit_paise  BIGINT NOT NULL,
  journal_credit_paise BIGINT NOT NULL,
  documents_seq        BIGINT NOT NULL,                -- the device's documents cursor when it totalled its journals
  outbox_depth         INT NOT NULL,                   -- unsent operations then; the totals compare only when 0
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_journal_entry_seq ON journal_entry(business_id, server_seq);
GRANT SELECT, INSERT, UPDATE ON device_integrity TO muneem_api;
GRANT SELECT ON device_integrity TO muneem_readonly;
ALTER TABLE device_integrity ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_integrity_tenant ON device_integrity TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));

CREATE FUNCTION health_businesses(silent_after INTERVAL, breaks_within INTERVAL)
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

CREATE FUNCTION health_devices(top_n INT)
RETURNS TABLE (business_id TEXT, device_id TEXT, outbox_depth INT, oldest_pending_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT dv.business_id, dv.id, coalesce(dv.outbox_depth, 0), dv.oldest_pending_at, dv.last_seen_at
  FROM device dv WHERE dv.business_id IS NOT NULL AND dv.status = 'active'
  ORDER BY dv.oldest_pending_at ASC NULLS LAST, dv.last_seen_at ASC NULLS FIRST, dv.outbox_depth DESC NULLS LAST, dv.id
  LIMIT top_n
$$;

CREATE FUNCTION health_rejections(within INTERVAL)
RETURNS TABLE (business_id TEXT, code TEXT, rejected BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT dl.business_id, dl.error_code, count(*) FROM dead_letter dl WHERE dl.created_at > now() - within GROUP BY 1, 2
$$;

-- The slow probe: journals whose lines do not balance. Ingest refuses them, so any row here is a defect.
CREATE FUNCTION health_unbalanced_journals()
RETURNS TABLE (business_id TEXT, journals BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT j.business_id, count(*) FROM (
    SELECT l.business_id, l.journal_id FROM journal_line l GROUP BY 1, 2 HAVING sum(l.debit_paise) <> sum(l.credit_paise)
  ) j GROUP BY 1
$$;

-- The slow probe: each active device's last integrity report, with its journal totals against the cloud's journals up
-- to the same seq. The difference is NULL when the device still had operations to send.
CREATE FUNCTION health_device_integrity()
RETURNS TABLE (business_id TEXT, device_id TEXT, checked_at TIMESTAMPTZ, tie_out_failures INT, replay_mismatches INT, audit_chain_ok BOOLEAN,
               journal_count_diff BIGINT, journal_debit_diff_paise BIGINT, journal_credit_diff_paise BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT i.business_id, i.device_id, i.checked_at, i.tie_out_failures, i.replay_mismatches, i.audit_chain_ok,
    CASE WHEN i.outbox_depth = 0 THEN i.journal_count - c.n END,
    CASE WHEN i.outbox_depth = 0 THEN i.journal_debit_paise - c.debit END,
    CASE WHEN i.outbox_depth = 0 THEN i.journal_credit_paise - c.credit END
  FROM device_integrity i
  JOIN device dv ON dv.id = i.device_id AND dv.status = 'active'
  CROSS JOIN LATERAL (
    SELECT count(DISTINCT e.id) AS n, coalesce(sum(l.debit_paise), 0)::BIGINT AS debit, coalesce(sum(l.credit_paise), 0)::BIGINT AS credit
    FROM journal_entry e LEFT JOIN journal_line l ON l.journal_id = e.id
    WHERE e.business_id = i.business_id AND e.server_seq <= i.documents_seq
  ) c
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['health_businesses(INTERVAL, INTERVAL)','health_devices(INT)','health_rejections(INTERVAL)','health_unbalanced_journals()','health_device_integrity()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO muneem_api, muneem_readonly', f);
  END LOOP;
END $$;
