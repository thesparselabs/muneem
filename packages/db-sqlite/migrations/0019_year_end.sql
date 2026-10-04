-- 0019_year_end — Stage 8d (ADR-0045): a financial year closed to 3300 Retained Earnings, one per business and year.
-- The closing journal and any adjusting ones are ordinary journal_entry rows (source 'closing', ref_type 'fy_close').
CREATE TABLE fy_close (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  fy            TEXT NOT NULL CHECK (fy GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  -- requested: sent to the cloud and not yet accepted; closed: its journals are posted; superseded: another device's close won.
  status        TEXT NOT NULL CHECK (status IN ('requested','closed','superseded')),
  closings_json TEXT NOT NULL DEFAULT '[]',
  pending_json  TEXT,
  closed_at     TEXT,
  closed_by     TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict'))
);
CREATE UNIQUE INDEX ux_fy_close_year ON fy_close(business_id, fy) WHERE status <> 'superseded';
CREATE TRIGGER trg_fy_close_no_delete BEFORE DELETE ON fy_close BEGIN SELECT RAISE(ABORT, 'fy_close is append-only'); END;
