-- 0024_estimates — FR-086 (ADR-0068): quotations priced like a bill that post nothing (no journal, stock or party entry)
-- until a sale converts them. Numbered per terminal with the kind letter Q; synced like other documents.
CREATE TABLE estimate (
  id                     TEXT PRIMARY KEY,
  business_id            TEXT NOT NULL REFERENCES business(id),
  branch_id              TEXT NOT NULL REFERENCES branch(id),
  terminal_id            TEXT NOT NULL REFERENCES terminal(id),
  command_id             TEXT NOT NULL,
  series_id              TEXT NOT NULL REFERENCES doc_series(id),
  doc_number             TEXT NOT NULL,
  doc_seq                INTEGER NOT NULL,
  doc_date               TEXT NOT NULL,
  fy                     TEXT NOT NULL,
  valid_until            TEXT NOT NULL CHECK (valid_until >= doc_date),
  customer_id            TEXT REFERENCES customer(id),
  doc_type               TEXT NOT NULL CHECK (doc_type IN ('tax_invoice','bill_of_supply')),
  place_of_supply_state  TEXT NOT NULL CHECK (length(place_of_supply_state) = 2),
  place_of_supply_reason TEXT CHECK (place_of_supply_reason IS NULL OR length(place_of_supply_reason) > 0),
  supply_type            TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  state_tax_kind         TEXT NOT NULL CHECK (state_tax_kind IN ('sgst','utgst')),
  gstr1_bucket           TEXT NOT NULL,
  bill_discount_kind     TEXT NOT NULL CHECK (bill_discount_kind IN ('amount','percent')),
  bill_discount_value    INTEGER NOT NULL CHECK (bill_discount_value >= 0),
  gross_paise            INTEGER NOT NULL,
  line_discount_paise    INTEGER NOT NULL,
  bill_discount_paise    INTEGER NOT NULL,
  taxable_paise          INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise        INTEGER NOT NULL DEFAULT 0,
  total_paise            INTEGER NOT NULL,
  notes                  TEXT,
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','converted')),
  sale_id                TEXT,                  -- no foreign key: a pulled conversion may arrive before its sale
  sale_doc_number        TEXT,
  converted_at           TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK ((status = 'converted') = (sale_id IS NOT NULL AND converted_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_estimate_doc ON estimate(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_estimate_command ON estimate(business_id, command_id);
CREATE INDEX ix_estimate_list ON estimate(business_id, doc_date, id);
CREATE INDEX ix_estimate_customer ON estimate(business_id, customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE estimate_item (
  id                              TEXT PRIMARY KEY,
  estimate_id                     TEXT NOT NULL REFERENCES estimate(id),
  business_id                     TEXT NOT NULL,
  line_no                         INTEGER NOT NULL,
  product_id                      TEXT NOT NULL REFERENCES product(id),
  product_name                    TEXT NOT NULL,
  hsn_code                        TEXT,
  uom_id                          TEXT NOT NULL REFERENCES uom(id),
  uom_code                        TEXT NOT NULL,
  qty_milli                       INTEGER NOT NULL CHECK (qty_milli > 0),
  base_qty_milli                  INTEGER NOT NULL CHECK (base_qty_milli > 0),
  unit_price_paise                INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  price_is_inclusive              INTEGER NOT NULL CHECK (price_is_inclusive IN (0,1)),
  mrp_paise                       INTEGER,
  line_discount_kind              TEXT NOT NULL CHECK (line_discount_kind IN ('amount','percent')),
  line_discount_value             INTEGER NOT NULL CHECK (line_discount_value >= 0),
  gross_paise                     INTEGER NOT NULL,
  line_discount_paise             INTEGER NOT NULL,
  apportioned_bill_discount_paise INTEGER NOT NULL,
  taxable_paise                   INTEGER NOT NULL,
  tax_treatment                   TEXT NOT NULL,
  gst_rate_bp                     INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  cess_rate_bp                    INTEGER NOT NULL DEFAULT 0,
  cess_per_unit_paise             INTEGER NOT NULL DEFAULT 0,
  cess_paise                      INTEGER NOT NULL DEFAULT 0,
  total_paise                     INTEGER NOT NULL,
  UNIQUE (estimate_id, line_no),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise)
);

-- Lines are written once with their estimate; only the conversion fields of an estimate ever change.
CREATE TRIGGER estimate_item_no_update BEFORE UPDATE ON estimate_item BEGIN SELECT RAISE(ABORT, 'estimate lines are append-only'); END;
CREATE TRIGGER estimate_item_no_delete BEFORE DELETE ON estimate_item BEGIN SELECT RAISE(ABORT, 'estimate lines are append-only'); END;
CREATE TRIGGER estimate_no_delete BEFORE DELETE ON estimate BEGIN SELECT RAISE(ABORT, 'estimates are kept'); END;
