-- 0010 — documents a device asked the cloud to email (FR-085, ADR-0067). One row per (business, share): a retry of a
-- share already sent is answered without a second email. The PDF itself is never stored.
CREATE TABLE share_email (
  business_id  TEXT NOT NULL REFERENCES business(id),
  share_id     TEXT NOT NULL,
  device_id    TEXT NOT NULL REFERENCES device(id),
  recipient    TEXT NOT NULL,
  bytes        INT NOT NULL CHECK (bytes > 0),
  status       TEXT NOT NULL CHECK (status IN ('sending','sent')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  PRIMARY KEY (business_id, share_id)
);
CREATE INDEX ix_share_email_recent ON share_email(business_id, created_at);

GRANT SELECT, INSERT, UPDATE ON share_email TO muneem_api;
GRANT SELECT ON share_email TO muneem_readonly;
ALTER TABLE share_email ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_email_tenant ON share_email TO muneem_api, muneem_readonly
  USING (business_id = current_setting('app.business_id', true)) WITH CHECK (business_id = current_setting('app.business_id', true));
