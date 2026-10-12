-- 0025_delivery_challans — FR-087 (ADR-0069): goods sent without a tax invoice (CGST Rule 55), valued like a bill and
-- posting nothing (no journal, stock or party entry) until a sale invoices them. Numbered per terminal with kind letter H.
CREATE TABLE delivery_challan (
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
  purpose                TEXT NOT NULL CHECK (purpose IN ('supply','job_work','approval','branch_transfer','other')),
  customer_id            TEXT REFERENCES customer(id),
  consignee_name         TEXT CHECK (consignee_name IS NULL OR length(consignee_name) > 0),
  consignee_address      TEXT,
  consignee_gstin        TEXT,
  doc_type               TEXT NOT NULL CHECK (doc_type IN ('tax_invoice','bill_of_supply')),
  place_of_supply_state  TEXT NOT NULL CHECK (length(place_of_supply_state) = 2),
  place_of_supply_reason TEXT CHECK (place_of_supply_reason IS NULL OR length(place_of_supply_reason) > 0),
  supply_type            TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  state_tax_kind         TEXT NOT NULL CHECK (state_tax_kind IN ('sgst','utgst')),
  gstr1_bucket           TEXT NOT NULL,
  gross_paise            INTEGER NOT NULL,
  line_discount_paise    INTEGER NOT NULL DEFAULT 0,
  bill_discount_paise    INTEGER NOT NULL DEFAULT 0,
  taxable_paise          INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise        INTEGER NOT NULL DEFAULT 0,
  total_paise            INTEGER NOT NULL,
  transport_mode         TEXT NOT NULL CHECK (transport_mode IN ('road','rail','air','ship')),
  vehicle_no             TEXT,
  transporter_name       TEXT,
  transporter_id         TEXT,
  distance_km            INTEGER CHECK (distance_km IS NULL OR distance_km >= 0),
  transport_doc_no       TEXT,
  notes                  TEXT,
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','billed')),
  sale_id                TEXT,                  -- no foreign key: a pulled invoice link may arrive before its sale
  sale_doc_number        TEXT,
  billed_at              TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (customer_id IS NOT NULL OR consignee_name IS NOT NULL),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK ((status = 'billed') = (sale_id IS NOT NULL AND billed_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_delivery_challan_doc ON delivery_challan(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_delivery_challan_command ON delivery_challan(business_id, command_id);
CREATE INDEX ix_delivery_challan_list ON delivery_challan(business_id, doc_date, id);
CREATE INDEX ix_delivery_challan_customer ON delivery_challan(business_id, customer_id) WHERE customer_id IS NOT NULL;

-- The same line columns as estimate_item, so both are read and written by one module.
CREATE TABLE delivery_challan_item (
  id                              TEXT PRIMARY KEY,
  challan_id                      TEXT NOT NULL REFERENCES delivery_challan(id),
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
  UNIQUE (challan_id, line_no),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise)
);

CREATE TRIGGER delivery_challan_item_no_update BEFORE UPDATE ON delivery_challan_item BEGIN SELECT RAISE(ABORT, 'challan lines are append-only'); END;
CREATE TRIGGER delivery_challan_item_no_delete BEFORE DELETE ON delivery_challan_item BEGIN SELECT RAISE(ABORT, 'challan lines are append-only'); END;
CREATE TRIGGER delivery_challan_no_delete BEFORE DELETE ON delivery_challan BEGIN SELECT RAISE(ABORT, 'challans are kept'); END;
