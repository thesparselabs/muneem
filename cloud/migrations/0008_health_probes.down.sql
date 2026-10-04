DROP FUNCTION IF EXISTS health_device_integrity();
DROP FUNCTION IF EXISTS health_unbalanced_journals();
DROP FUNCTION IF EXISTS health_rejections(INTERVAL);
DROP FUNCTION IF EXISTS health_devices(INT);
DROP FUNCTION IF EXISTS health_businesses(INTERVAL, INTERVAL);
DROP INDEX IF EXISTS ix_journal_entry_seq;
DROP TABLE IF EXISTS device_integrity;
DROP INDEX IF EXISTS ix_dead_letter_created;
ALTER TABLE device DROP COLUMN heartbeat_at, DROP COLUMN negative_stock_count, DROP COLUMN oldest_pending_at;
