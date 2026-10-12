-- 0023_share_log — FR-085 (ADR-0067): every document this device shared by WhatsApp or email, and the email queue.
-- Local and never synced, like notifications (ADR-0050): it is this till's record of what it sent and to whom.
CREATE TABLE share_log (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES business(id),
  doc_type        TEXT NOT NULL,
  doc_id          TEXT NOT NULL,
  doc_label       TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  recipient       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  message         TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  pdf             BLOB,                          -- an email's PDF, kept only until it is sent or fails for good
  status          TEXT NOT NULL CHECK (status IN ('opened','queued','sending','sent','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error      TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  sent_at         TEXT,
  CHECK (status NOT IN ('queued','sending') OR (channel = 'email' AND pdf IS NOT NULL))
);
CREATE INDEX ix_share_log_doc ON share_log(business_id, doc_type, doc_id, created_at);
CREATE INDEX ix_share_log_due ON share_log(business_id, next_attempt_at) WHERE status = 'queued';
