-- 0003_pos — Stage 3 billing (LLD §2.2, §2.6; HLD §8): customers, register sessions, sales, held bills, print jobs.
-- Stock movements and journal entries join the sale commit in Stages 4 and 6 (ADR-0013).

-- SQLite treats NULLs as distinct in doc_series' table UNIQUE, so business-wide series could duplicate.
CREATE UNIQUE INDEX ux_doc_series_key ON doc_series(business_id, doc_type, fy, COALESCE(branch_id, ''), COALESCE(terminal_id, ''));

CREATE TABLE customer (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  name          TEXT NOT NULL,
  name_norm     TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  gstin         TEXT,
  state_code    TEXT CHECK (state_code IS NULL OR length(state_code) = 2),
  address_line1 TEXT, city TEXT, pin_code TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  CHECK (gstin IS NULL OR substr(gstin, 1, 2) = state_code)
);
CREATE INDEX ix_customer_name ON customer(business_id, name_norm);
CREATE INDEX ix_customer_phone ON customer(business_id, phone);
CREATE UNIQUE INDEX ux_customer_gstin ON customer(business_id, gstin) WHERE gstin IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE pos_session (
  id                   TEXT PRIMARY KEY,
  business_id          TEXT NOT NULL REFERENCES business(id),
  branch_id            TEXT NOT NULL REFERENCES branch(id),
  terminal_id          TEXT NOT NULL REFERENCES terminal(id),
  session_no           INTEGER NOT NULL,
  opened_by            TEXT NOT NULL,
  opened_at            TEXT NOT NULL,
  opening_cash_paise   INTEGER NOT NULL CHECK (opening_cash_paise >= 0),
  closed_by            TEXT,
  closed_at            TEXT,
  expected_cash_paise  INTEGER,
  counted_cash_paise   INTEGER CHECK (counted_cash_paise IS NULL OR counted_cash_paise >= 0),
  variance_paise       INTEGER,
  denomination_json    TEXT,
  blind_close          INTEGER NOT NULL DEFAULT 0 CHECK (blind_close IN (0,1)),
  variance_approved_by TEXT,
  z_report_json        TEXT,
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closing','closed')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  UNIQUE (business_id, terminal_id, session_no),
  CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND counted_cash_paise IS NOT NULL AND variance_paise = counted_cash_paise - expected_cash_paise))
);
-- FR-099: one open session per terminal, enforced by the database
CREATE UNIQUE INDEX ux_session_open ON pos_session(business_id, terminal_id) WHERE status <> 'closed';

CREATE TABLE cash_movement (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  session_id   TEXT NOT NULL REFERENCES pos_session(id),
  kind         TEXT NOT NULL CHECK (kind IN ('cash_in','cash_out','safe_drop','expense','refund')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  reason       TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict'))
);
CREATE INDEX ix_cash_movement_session ON cash_movement(session_id);

CREATE TABLE sale (
  id                     TEXT PRIMARY KEY,
  business_id            TEXT NOT NULL REFERENCES business(id),
  branch_id              TEXT NOT NULL REFERENCES branch(id),
  terminal_id            TEXT NOT NULL REFERENCES terminal(id),
  session_id             TEXT NOT NULL REFERENCES pos_session(id),
  command_id             TEXT NOT NULL,
  doc_type               TEXT NOT NULL CHECK (doc_type IN ('tax_invoice','bill_of_supply','credit_note','delivery_challan')),
  series_id              TEXT NOT NULL REFERENCES doc_series(id),
  doc_number             TEXT NOT NULL,
  doc_seq                INTEGER NOT NULL,
  doc_date               TEXT NOT NULL,
  fy                     TEXT NOT NULL,
  customer_id            TEXT REFERENCES customer(id),
  customer_snapshot_json TEXT NOT NULL,
  place_of_supply_state  TEXT NOT NULL CHECK (length(place_of_supply_state) = 2),
  place_of_supply_reason TEXT,
  supply_type            TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  state_tax_kind         TEXT NOT NULL DEFAULT 'sgst' CHECK (state_tax_kind IN ('sgst','utgst')),
  gstr1_bucket           TEXT NOT NULL,
  tax_scheme             TEXT NOT NULL CHECK (tax_scheme IN ('regular','composition','unregistered')),
  is_reverse_charge      INTEGER NOT NULL DEFAULT 0,
  price_list_id          TEXT REFERENCES price_list(id),
  gross_paise            INTEGER NOT NULL,
  line_discount_paise    INTEGER NOT NULL DEFAULT 0,
  bill_discount_paise    INTEGER NOT NULL DEFAULT 0,
  taxable_paise          INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise        INTEGER NOT NULL DEFAULT 0,
  total_paise            INTEGER NOT NULL,
  paid_paise             INTEGER NOT NULL DEFAULT 0,
  change_paise           INTEGER NOT NULL DEFAULT 0 CHECK (change_paise >= 0),
  credit_paise           INTEGER NOT NULL DEFAULT 0,
  cogs_paise             INTEGER NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT,
  returned_qty_flag      INTEGER NOT NULL DEFAULT 0,
  original_sale_id       TEXT REFERENCES sale(id),
  irn TEXT, irn_ack_no TEXT, irn_ack_date TEXT, qr_payload TEXT, einvoice_status TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK (paid_paise - change_paise + credit_paise = total_paise),
  CHECK (place_of_supply_reason IS NULL OR length(place_of_supply_reason) > 0)
);
CREATE UNIQUE INDEX ux_sale_doc ON sale(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_sale_command ON sale(business_id, command_id);
CREATE INDEX ix_sale_date ON sale(business_id, doc_date);
CREATE INDEX ix_sale_cust ON sale(business_id, customer_id, doc_date);
CREATE INDEX ix_sale_session ON sale(session_id);

CREATE TABLE sale_item (
  id                              TEXT PRIMARY KEY,
  sale_id                         TEXT NOT NULL REFERENCES sale(id),
  business_id                     TEXT NOT NULL,
  line_no                         INTEGER NOT NULL,
  product_id                      TEXT NOT NULL REFERENCES product(id),
  variant_id                      TEXT, batch_id TEXT,
  product_name                    TEXT NOT NULL,
  hsn_code                        TEXT,
  uom_id                          TEXT NOT NULL REFERENCES uom(id),
  uom_code                        TEXT NOT NULL,
  qty_milli                       INTEGER NOT NULL CHECK (qty_milli > 0),
  base_qty_milli                  INTEGER NOT NULL CHECK (base_qty_milli > 0),
  unit_price_paise                INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  price_is_inclusive              INTEGER NOT NULL CHECK (price_is_inclusive IN (0,1)),
  mrp_paise                       INTEGER,
  gross_paise                     INTEGER NOT NULL,
  line_discount_paise             INTEGER NOT NULL DEFAULT 0,
  apportioned_bill_discount_paise INTEGER NOT NULL DEFAULT 0,
  taxable_paise                   INTEGER NOT NULL,
  tax_treatment                   TEXT NOT NULL,
  gst_rate_bp                     INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  cess_rate_bp                    INTEGER NOT NULL DEFAULT 0,
  cess_per_unit_paise             INTEGER NOT NULL DEFAULT 0,
  cess_paise                      INTEGER NOT NULL DEFAULT 0,
  total_paise                     INTEGER NOT NULL,
  unit_cost_paise                 INTEGER NOT NULL DEFAULT 0,
  cogs_paise                      INTEGER NOT NULL DEFAULT 0,
  returned_qty_milli              INTEGER NOT NULL DEFAULT 0,
  original_sale_item_id           TEXT,
  UNIQUE (sale_id, line_no),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise)
);
CREATE INDEX ix_sale_item_product ON sale_item(business_id, product_id);

CREATE TABLE sale_tender (
  id               TEXT PRIMARY KEY,
  sale_id          TEXT NOT NULL REFERENCES sale(id),
  business_id      TEXT NOT NULL,
  line_no          INTEGER NOT NULL,
  method           TEXT NOT NULL CHECK (method IN ('cash','upi','card','bank','credit','wallet','other')),
  amount_paise     INTEGER NOT NULL CHECK (amount_paise > 0),
  change_paise     INTEGER NOT NULL DEFAULT 0 CHECK (change_paise >= 0),
  reference        TEXT, instrument_last4 TEXT, approval_code TEXT,
  account_id       TEXT,
  UNIQUE (sale_id, line_no),
  CHECK (method = 'cash' OR change_paise = 0)
);

-- Financial documents are never edited or removed; corrections are new documents (cancel/credit notes, later stages).
CREATE TRIGGER trg_sale_no_delete BEFORE DELETE ON sale BEGIN SELECT RAISE(ABORT, 'sale is append-only'); END;
CREATE TRIGGER trg_sale_frozen BEFORE UPDATE OF
  id, business_id, branch_id, terminal_id, session_id, command_id, doc_type, series_id, doc_number, doc_seq, doc_date, fy,
  customer_id, customer_snapshot_json, place_of_supply_state, supply_type, gstr1_bucket, tax_scheme, gross_paise,
  line_discount_paise, bill_discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise,
  round_off_paise, total_paise, paid_paise, change_paise, credit_paise
  ON sale BEGIN SELECT RAISE(ABORT, 'sale is append-only'); END;
CREATE TRIGGER trg_sale_item_no_update BEFORE UPDATE ON sale_item BEGIN SELECT RAISE(ABORT, 'sale_item is append-only'); END;
CREATE TRIGGER trg_sale_item_no_delete BEFORE DELETE ON sale_item BEGIN SELECT RAISE(ABORT, 'sale_item is append-only'); END;
CREATE TRIGGER trg_sale_tender_no_update BEFORE UPDATE ON sale_tender BEGIN SELECT RAISE(ABORT, 'sale_tender is append-only'); END;
CREATE TRIGGER trg_sale_tender_no_delete BEFORE DELETE ON sale_tender BEGIN SELECT RAISE(ABORT, 'sale_tender is append-only'); END;

-- Device-local working state: never synced.
CREATE TABLE held_bill (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  terminal_id TEXT NOT NULL REFERENCES terminal(id),
  session_id  TEXT NOT NULL REFERENCES pos_session(id),
  label       TEXT,
  cart_json   TEXT NOT NULL,
  held_by     TEXT NOT NULL,
  held_at     TEXT NOT NULL
);
CREATE INDEX ix_held_bill_terminal ON held_bill(business_id, terminal_id);

CREATE TABLE print_job (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  doc_type      TEXT NOT NULL,
  doc_id        TEXT NOT NULL,
  printer_id    TEXT,
  copy_no       INTEGER NOT NULL DEFAULT 1,
  is_duplicate  INTEGER NOT NULL DEFAULT 0 CHECK (is_duplicate IN (0,1)),
  doc_json      TEXT NOT NULL,
  open_drawer   INTEGER NOT NULL DEFAULT 0 CHECK (open_drawer IN (0,1)),
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printing','done','failed','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  completed_at  TEXT
);
CREATE INDEX ix_print_job_status ON print_job(status, created_at);
CREATE INDEX ix_print_job_doc ON print_job(doc_id, copy_no);
