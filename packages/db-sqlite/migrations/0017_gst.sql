-- 0017_gst — Stage 8c (ADR-0044): the monthly GST set-off and GST paid by challan. Both are numbered per terminal
-- (kind letters S and G, ADR-0028) and append-only; their journals carry the amounts into the books.

-- One month's output tax against input credit in the statutory order; what credit cannot cover moves to 2300 GST Payable.
CREATE TABLE gst_setoff (
  id                   TEXT PRIMARY KEY,
  business_id          TEXT NOT NULL REFERENCES business(id),
  branch_id            TEXT NOT NULL REFERENCES branch(id),
  terminal_id          TEXT NOT NULL REFERENCES terminal(id),
  series_id            TEXT NOT NULL REFERENCES doc_series(id),
  doc_number           TEXT NOT NULL,
  doc_seq              INTEGER NOT NULL,
  doc_date             TEXT NOT NULL,
  fy                   TEXT NOT NULL,
  period_month         TEXT NOT NULL CHECK (period_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-01'),
  liability_igst_paise INTEGER NOT NULL CHECK (liability_igst_paise >= 0),
  liability_cgst_paise INTEGER NOT NULL CHECK (liability_cgst_paise >= 0),
  liability_sgst_paise INTEGER NOT NULL CHECK (liability_sgst_paise >= 0),
  liability_cess_paise INTEGER NOT NULL CHECK (liability_cess_paise >= 0),
  credit_igst_paise    INTEGER NOT NULL CHECK (credit_igst_paise >= 0),
  credit_cgst_paise    INTEGER NOT NULL CHECK (credit_cgst_paise >= 0),
  credit_sgst_paise    INTEGER NOT NULL CHECK (credit_sgst_paise >= 0),
  credit_cess_paise    INTEGER NOT NULL CHECK (credit_cess_paise >= 0),
  igst_to_igst_paise   INTEGER NOT NULL CHECK (igst_to_igst_paise >= 0),
  igst_to_cgst_paise   INTEGER NOT NULL CHECK (igst_to_cgst_paise >= 0),
  igst_to_sgst_paise   INTEGER NOT NULL CHECK (igst_to_sgst_paise >= 0),
  cgst_to_cgst_paise   INTEGER NOT NULL CHECK (cgst_to_cgst_paise >= 0),
  cgst_to_igst_paise   INTEGER NOT NULL CHECK (cgst_to_igst_paise >= 0),
  sgst_to_sgst_paise   INTEGER NOT NULL CHECK (sgst_to_sgst_paise >= 0),
  sgst_to_igst_paise   INTEGER NOT NULL CHECK (sgst_to_igst_paise >= 0),
  cess_to_cess_paise   INTEGER NOT NULL CHECK (cess_to_cess_paise >= 0),
  cash_igst_paise      INTEGER NOT NULL CHECK (cash_igst_paise >= 0),
  cash_cgst_paise      INTEGER NOT NULL CHECK (cash_cgst_paise >= 0),
  cash_sgst_paise      INTEGER NOT NULL CHECK (cash_sgst_paise >= 0),
  cash_cess_paise      INTEGER NOT NULL CHECK (cash_cess_paise >= 0),
  command_id           TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (liability_igst_paise = igst_to_igst_paise + cgst_to_igst_paise + sgst_to_igst_paise + cash_igst_paise),
  CHECK (liability_cgst_paise = igst_to_cgst_paise + cgst_to_cgst_paise + cash_cgst_paise),
  CHECK (liability_sgst_paise = igst_to_sgst_paise + sgst_to_sgst_paise + cash_sgst_paise),
  CHECK (liability_cess_paise = cess_to_cess_paise + cash_cess_paise),
  CHECK (igst_to_igst_paise + igst_to_cgst_paise + igst_to_sgst_paise <= credit_igst_paise),
  CHECK (cgst_to_cgst_paise + cgst_to_igst_paise <= credit_cgst_paise),
  CHECK (sgst_to_sgst_paise + sgst_to_igst_paise <= credit_sgst_paise),
  CHECK (cess_to_cess_paise <= credit_cess_paise)
);
CREATE UNIQUE INDEX ux_gst_setoff_doc ON gst_setoff(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_gst_setoff_command ON gst_setoff(business_id, command_id);
-- Not unique: a month set off on two offline devices is kept on both and listed for review (ADR-0044 as built).
CREATE INDEX ix_gst_setoff_month ON gst_setoff(business_id, period_month);
CREATE TRIGGER trg_gst_setoff_no_update BEFORE UPDATE OF
  id, business_id, period_month, doc_number, doc_seq, doc_date, liability_igst_paise, liability_cgst_paise, liability_sgst_paise, liability_cess_paise,
  credit_igst_paise, credit_cgst_paise, credit_sgst_paise, credit_cess_paise, igst_to_igst_paise, igst_to_cgst_paise, igst_to_sgst_paise,
  cgst_to_cgst_paise, cgst_to_igst_paise, sgst_to_sgst_paise, sgst_to_igst_paise, cess_to_cess_paise, cash_igst_paise, cash_cgst_paise,
  cash_sgst_paise, cash_cess_paise ON gst_setoff BEGIN SELECT RAISE(ABORT, 'gst_setoff is append-only'); END;
CREATE TRIGGER trg_gst_setoff_no_delete BEFORE DELETE ON gst_setoff BEGIN SELECT RAISE(ABORT, 'gst_setoff is append-only'); END;

-- Tax deposited by challan, by head; it clears 2300 GST Payable from the bank.
CREATE TABLE gst_payment (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  branch_id    TEXT NOT NULL REFERENCES branch(id),
  terminal_id  TEXT NOT NULL REFERENCES terminal(id),
  series_id    TEXT NOT NULL REFERENCES doc_series(id),
  doc_number   TEXT NOT NULL,
  doc_seq      INTEGER NOT NULL,
  doc_date     TEXT NOT NULL,
  fy           TEXT NOT NULL,
  period_month TEXT CHECK (period_month IS NULL OR period_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-01'),
  challan_ref  TEXT NOT NULL CHECK (length(challan_ref) BETWEEN 1 AND 40),
  igst_paise   INTEGER NOT NULL DEFAULT 0 CHECK (igst_paise >= 0),
  cgst_paise   INTEGER NOT NULL DEFAULT 0 CHECK (cgst_paise >= 0),
  sgst_paise   INTEGER NOT NULL DEFAULT 0 CHECK (sgst_paise >= 0),
  cess_paise   INTEGER NOT NULL DEFAULT 0 CHECK (cess_paise >= 0),
  total_paise  INTEGER NOT NULL CHECK (total_paise > 0),
  note         TEXT,
  command_id   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = igst_paise + cgst_paise + sgst_paise + cess_paise)
);
CREATE UNIQUE INDEX ux_gst_payment_doc ON gst_payment(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_gst_payment_command ON gst_payment(business_id, command_id);
CREATE INDEX ix_gst_payment_date ON gst_payment(business_id, doc_date);
CREATE TRIGGER trg_gst_payment_no_update BEFORE UPDATE OF
  id, business_id, doc_number, doc_seq, doc_date, period_month, challan_ref, igst_paise, cgst_paise, sgst_paise, cess_paise, total_paise
  ON gst_payment BEGIN SELECT RAISE(ABORT, 'gst_payment is append-only'); END;
CREATE TRIGGER trg_gst_payment_no_delete BEFORE DELETE ON gst_payment BEGIN SELECT RAISE(ABORT, 'gst_payment is append-only'); END;

-- Returns read each document in the month its journal posted to.
CREATE INDEX ix_je_source_date ON journal_entry(business_id, source, entry_date);
