-- 0020_notifications — Stage 8h (ADR-0050): the in-app notification centre and DPDP consent on customers.
-- Notifications are local to this device and never synced: each device derives them from data it already holds.
CREATE TABLE notification (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL,                -- '_device' for device-wide kinds (backups, sync, updates)
  kind         TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  link         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  read_at      TEXT,
  dismissed_at TEXT,
  resolved_at  TEXT
);
CREATE UNIQUE INDEX ux_notification_open ON notification(business_id, kind, entity_type, entity_id) WHERE resolved_at IS NULL;
CREATE INDEX ix_notification_list ON notification(business_id, resolved_at, updated_at);

-- Withdrawing a consent closes that record and a new consent starts another. Two devices may each record one at once,
-- so "one active per purpose and channel" is the service's rule, not a constraint a pulled change could trip over.
CREATE TABLE customer_consent (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  customer_id  TEXT NOT NULL REFERENCES customer(id),
  purpose      TEXT NOT NULL CHECK (purpose IN ('payment_reminders')),
  channel      TEXT NOT NULL CHECK (channel IN ('sms','whatsapp')),
  method       TEXT NOT NULL CHECK (method IN ('in_person','phone','written','digital')),
  given_at     TEXT NOT NULL,
  withdrawn_at TEXT,
  captured_by  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX ix_customer_consent_customer ON customer_consent(customer_id, purpose, channel);

-- An erased customer keeps its id (invoices point at it) but not its name, phone, email, address or GSTIN.
ALTER TABLE customer ADD COLUMN erased_at TEXT;
