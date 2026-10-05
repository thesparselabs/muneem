-- 0007 — the backup master key is a versioned keyring (Stage 9b, ADR-0052). Every key wrapped so far was wrapped by
-- the single MUNEEM_BACKUP_MASTER_KEY, which the keyring names v1. Re-wrapping runs as the owner role, so the app role
-- keeps no UPDATE on backup_key.
ALTER TABLE backup_key ADD COLUMN master_key_version TEXT NOT NULL DEFAULT 'v1';
