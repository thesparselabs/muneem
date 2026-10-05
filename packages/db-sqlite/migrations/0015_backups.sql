-- 0015_backups — Stage 8f (ADR-0047): encrypted backups with retention and cloud upload. backup_log is rebuilt to widen
-- its kinds (a Z report, a safety copy before a restore) and to carry the encryption, upload and pruning state.

CREATE TABLE backup_log_new (
  id              TEXT PRIMARY KEY,
  path            TEXT NOT NULL,
  bytes           INTEGER NOT NULL,
  verified        INTEGER NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('scheduled','manual','pre_migration','z_report','pre_restore')),
  created_at      TEXT NOT NULL,
  business_id     TEXT,
  encrypted       INTEGER NOT NULL DEFAULT 0,
  key_id          TEXT,
  sha256          TEXT,                       -- of the file on disk (the ciphertext when encrypted)
  schema_version  INTEGER,
  error           TEXT,                       -- why the backup failed; verified = 0
  cloud_status    TEXT NOT NULL DEFAULT 'none' CHECK (cloud_status IN ('none','pending','uploading','uploaded','failed')),
  cloud_backup_id TEXT,
  cloud_attempts  INTEGER NOT NULL DEFAULT 0,
  cloud_error     TEXT,
  uploaded_at     TEXT,
  pruned_at       TEXT
);
INSERT INTO backup_log_new (id, path, bytes, verified, kind, created_at)
  SELECT id, path, bytes, verified, kind, created_at FROM backup_log;
DROP TABLE backup_log;
ALTER TABLE backup_log_new RENAME TO backup_log;
CREATE INDEX ix_backup_log_created ON backup_log(created_at);
CREATE INDEX ix_backup_log_cloud ON backup_log(cloud_status) WHERE cloud_status IN ('pending','uploading','failed');
