-- 0026_reminder_log — FR-088 (ADR-0070): payment reminders this device sent, each through the share it opened (0023).
-- Local and never synced, like share_log: the record of what this till sent and to whom.
CREATE TABLE reminder_log (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES business(id),
  customer_id     TEXT NOT NULL REFERENCES customer(id),
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  recipient       TEXT NOT NULL,
  share_id        TEXT NOT NULL REFERENCES share_log(id),
  overdue_paise   INTEGER NOT NULL CHECK (overdue_paise > 0),
  balance_paise   INTEGER NOT NULL,
  oldest_due_date TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX ix_reminder_log_customer ON reminder_log(business_id, customer_id, created_at);
CREATE INDEX ix_reminder_log_recent ON reminder_log(business_id, created_at);
