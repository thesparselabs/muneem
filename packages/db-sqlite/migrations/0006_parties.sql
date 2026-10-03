-- 0006_parties — Stage 5 (LLD §2.5, §5.2; ADR-0022–0026): suppliers, purchases, debit notes, payments, allocations,
-- expenses, opening balances, write-offs and the party sub-ledger. Allocation totals are kept by triggers, so
-- over-allocating a document is impossible to persist.

CREATE TABLE supplier (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  name          TEXT NOT NULL,
  name_norm     TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  gstin         TEXT,
  state_code    TEXT NOT NULL CHECK (length(state_code) = 2),
  tax_scheme    TEXT NOT NULL DEFAULT 'regular' CHECK (tax_scheme IN ('regular','composition','unregistered')),
  address_line1 TEXT, city TEXT, pin_code TEXT,
  credit_days   INTEGER NOT NULL DEFAULT 0 CHECK (credit_days >= 0),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  CHECK (gstin IS NULL OR substr(gstin, 1, 2) = state_code),
  CHECK ((tax_scheme = 'unregistered') = (gstin IS NULL))
);
CREATE INDEX ix_supplier_name ON supplier(business_id, name_norm);
CREATE UNIQUE INDEX ux_supplier_gstin ON supplier(business_id, gstin) WHERE gstin IS NOT NULL AND deleted_at IS NULL;

-- NULL limit = no credit allowed (ADR-0026).
ALTER TABLE customer ADD COLUMN credit_limit_paise INTEGER CHECK (credit_limit_paise IS NULL OR credit_limit_paise >= 0);
ALTER TABLE customer ADD COLUMN credit_days INTEGER NOT NULL DEFAULT 0 CHECK (credit_days >= 0);

ALTER TABLE sale ADD COLUMN due_date TEXT;
ALTER TABLE sale ADD COLUMN settled_paise INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER trg_sale_settled BEFORE UPDATE OF settled_paise ON sale
  WHEN NEW.settled_paise < 0 OR NEW.settled_paise > NEW.credit_paise
  BEGIN SELECT RAISE(ABORT, 'sale is over-allocated'); END;

ALTER TABLE cash_movement ADD COLUMN ref_type TEXT CHECK (ref_type IS NULL OR ref_type IN ('payment','expense'));
ALTER TABLE cash_movement ADD COLUMN ref_id TEXT;

CREATE TABLE party_opening (
  id             TEXT PRIMARY KEY,
  business_id    TEXT NOT NULL REFERENCES business(id),
  party_type     TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id       TEXT NOT NULL,
  side           TEXT NOT NULL CHECK (side IN ('receivable','payable')),
  amount_paise   INTEGER NOT NULL CHECK (amount_paise > 0),
  as_of_date     TEXT NOT NULL,
  allocated_paise INTEGER NOT NULL DEFAULT 0,
  settled_paise  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (allocated_paise BETWEEN 0 AND amount_paise),
  CHECK (settled_paise BETWEEN 0 AND amount_paise),
  CHECK (allocated_paise = 0 OR settled_paise = 0)
);
CREATE UNIQUE INDEX ux_party_opening ON party_opening(business_id, party_type, party_id) WHERE status = 'posted';

CREATE TABLE purchase (
  id                    TEXT PRIMARY KEY,
  business_id           TEXT NOT NULL REFERENCES business(id),
  branch_id             TEXT NOT NULL REFERENCES branch(id),
  warehouse_id          TEXT NOT NULL REFERENCES warehouse(id),
  supplier_id           TEXT NOT NULL REFERENCES supplier(id),
  supplier_snapshot_json TEXT NOT NULL,
  supplier_invoice_no   TEXT NOT NULL CHECK (length(supplier_invoice_no) > 0),
  supplier_invoice_date TEXT NOT NULL,
  series_id             TEXT NOT NULL REFERENCES doc_series(id),
  doc_number            TEXT NOT NULL,
  doc_seq               INTEGER NOT NULL,
  doc_date              TEXT NOT NULL,
  fy                    TEXT NOT NULL,
  place_of_supply_state TEXT NOT NULL CHECK (length(place_of_supply_state) = 2),
  supply_type           TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  state_tax_kind        TEXT NOT NULL DEFAULT 'sgst' CHECK (state_tax_kind IN ('sgst','utgst')),
  supplier_tax_scheme   TEXT NOT NULL CHECK (supplier_tax_scheme IN ('regular','composition','unregistered')),
  is_reverse_charge     INTEGER NOT NULL DEFAULT 0 CHECK (is_reverse_charge IN (0,1)),
  gross_paise           INTEGER NOT NULL,
  line_discount_paise   INTEGER NOT NULL DEFAULT 0,
  bill_discount_paise   INTEGER NOT NULL DEFAULT 0,
  taxable_paise         INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  charges_paise         INTEGER NOT NULL DEFAULT 0 CHECK (charges_paise >= 0),
  round_off_paise       INTEGER NOT NULL DEFAULT 0 CHECK (round_off_paise BETWEEN -100 AND 100),
  total_paise           INTEGER NOT NULL CHECK (total_paise >= 0),
  itc_paise             INTEGER NOT NULL DEFAULT 0,
  due_date              TEXT NOT NULL,
  settled_paise         INTEGER NOT NULL DEFAULT 0,
  note                  TEXT,
  status                TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + charges_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK (supplier_tax_scheme = 'regular' OR cgst_paise + sgst_paise + igst_paise + cess_paise = 0),
  CHECK (itc_paise BETWEEN 0 AND cgst_paise + sgst_paise + igst_paise + cess_paise),
  CHECK (settled_paise BETWEEN 0 AND total_paise),
  CHECK (status = 'posted' OR settled_paise = 0)
);
CREATE UNIQUE INDEX ux_purchase_doc ON purchase(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_purchase_supplier_invoice ON purchase(business_id, supplier_id, fy, supplier_invoice_no COLLATE NOCASE)
  WHERE status = 'posted';
CREATE INDEX ix_purchase_date ON purchase(business_id, doc_date);
CREATE INDEX ix_purchase_supplier ON purchase(business_id, supplier_id, due_date);

CREATE TABLE purchase_item (
  id                              TEXT PRIMARY KEY,
  purchase_id                     TEXT NOT NULL REFERENCES purchase(id),
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
  itc_eligible                    INTEGER NOT NULL CHECK (itc_eligible IN (0,1)),
  charges_paise                   INTEGER NOT NULL DEFAULT 0 CHECK (charges_paise >= 0),
  landed_value_paise              INTEGER NOT NULL CHECK (landed_value_paise >= 0),
  unit_cost_paise                 INTEGER NOT NULL CHECK (unit_cost_paise >= 0),
  UNIQUE (purchase_id, line_no),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise),
  CHECK (landed_value_paise = taxable_paise + charges_paise
    + CASE WHEN itc_eligible = 1 THEN 0 ELSE cgst_paise + sgst_paise + igst_paise + cess_paise END)
);
CREATE INDEX ix_purchase_item_product ON purchase_item(business_id, product_id);

CREATE TABLE purchase_charge (
  id           TEXT PRIMARY KEY,
  purchase_id  TEXT NOT NULL REFERENCES purchase(id),
  business_id  TEXT NOT NULL,
  line_no      INTEGER NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('freight','loading','insurance','other')),
  description  TEXT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  UNIQUE (purchase_id, line_no)
);

CREATE TABLE debit_note (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES business(id),
  branch_id         TEXT NOT NULL REFERENCES branch(id),
  warehouse_id      TEXT NOT NULL REFERENCES warehouse(id),
  purchase_id       TEXT NOT NULL REFERENCES purchase(id),
  supplier_id       TEXT NOT NULL REFERENCES supplier(id),
  series_id         TEXT NOT NULL REFERENCES doc_series(id),
  doc_number        TEXT NOT NULL,
  doc_seq           INTEGER NOT NULL,
  doc_date          TEXT NOT NULL,
  fy                TEXT NOT NULL,
  reason            TEXT NOT NULL CHECK (length(reason) > 0),
  supply_type       TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  taxable_paise     INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  charges_paise     INTEGER NOT NULL DEFAULT 0 CHECK (charges_paise >= 0),
  round_off_paise   INTEGER NOT NULL DEFAULT 0 CHECK (round_off_paise BETWEEN -100 AND 100),
  total_paise       INTEGER NOT NULL CHECK (total_paise > 0),
  itc_reversed_paise INTEGER NOT NULL DEFAULT 0,
  allocated_paise   INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + charges_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK (itc_reversed_paise BETWEEN 0 AND cgst_paise + sgst_paise + igst_paise + cess_paise),
  CHECK (allocated_paise BETWEEN 0 AND total_paise)
);
CREATE UNIQUE INDEX ux_debit_note_doc ON debit_note(business_id, series_id, doc_seq);
CREATE INDEX ix_debit_note_purchase ON debit_note(purchase_id);

CREATE TABLE debit_note_item (
  id                 TEXT PRIMARY KEY,
  debit_note_id      TEXT NOT NULL REFERENCES debit_note(id),
  business_id        TEXT NOT NULL,
  line_no            INTEGER NOT NULL,
  purchase_item_id   TEXT NOT NULL REFERENCES purchase_item(id),
  product_id         TEXT NOT NULL REFERENCES product(id),
  qty_milli          INTEGER NOT NULL CHECK (qty_milli > 0),
  base_qty_milli     INTEGER NOT NULL CHECK (base_qty_milli > 0),
  taxable_paise      INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  total_paise        INTEGER NOT NULL,
  landed_value_paise INTEGER NOT NULL CHECK (landed_value_paise >= 0),
  UNIQUE (debit_note_id, line_no),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise)
);
CREATE INDEX ix_debit_note_item_line ON debit_note_item(purchase_item_id);
-- FR-044: never return more than was bought on the line.
CREATE TRIGGER trg_debit_note_item_qty BEFORE INSERT ON debit_note_item
  WHEN NEW.base_qty_milli + COALESCE((SELECT SUM(i.base_qty_milli) FROM debit_note_item i JOIN debit_note n ON n.id = i.debit_note_id
      WHERE i.purchase_item_id = NEW.purchase_item_id AND n.status = 'posted'), 0)
    > (SELECT base_qty_milli FROM purchase_item WHERE id = NEW.purchase_item_id)
  BEGIN SELECT RAISE(ABORT, 'RETURN_QTY_EXCEEDED'); END;

CREATE TABLE payment (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES business(id),
  branch_id       TEXT NOT NULL REFERENCES branch(id),
  terminal_id     TEXT REFERENCES terminal(id),
  session_id      TEXT REFERENCES pos_session(id),
  direction       TEXT NOT NULL CHECK (direction IN ('in','out')),
  party_type      TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id        TEXT NOT NULL,
  series_id       TEXT NOT NULL REFERENCES doc_series(id),
  doc_number      TEXT NOT NULL,
  doc_seq         INTEGER NOT NULL,
  payment_date    TEXT NOT NULL,
  fy              TEXT NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('cash','upi','card','bank','cheque','other')),
  account_id      TEXT,
  amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0),
  allocated_paise INTEGER NOT NULL DEFAULT 0,
  reference       TEXT,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (allocated_paise BETWEEN 0 AND amount_paise),
  CHECK ((party_type = 'customer') = (direction = 'in')),
  CHECK (status = 'posted' OR allocated_paise = 0)
);
CREATE UNIQUE INDEX ux_payment_doc ON payment(business_id, series_id, doc_seq);
CREATE INDEX ix_payment_party ON payment(business_id, party_type, party_id, payment_date);

CREATE TABLE write_off (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES business(id),
  customer_id     TEXT NOT NULL REFERENCES customer(id),
  doc_date        TEXT NOT NULL,
  amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0),
  allocated_paise INTEGER NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL CHECK (length(reason) > 0),
  status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (allocated_paise BETWEEN 0 AND amount_paise),
  CHECK (status = 'posted' OR allocated_paise = 0)
);

CREATE TABLE expense_category (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  account_code TEXT NOT NULL,
  is_system    INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  UNIQUE (business_id, code)
);

CREATE TABLE expense (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES business(id),
  branch_id       TEXT NOT NULL REFERENCES branch(id),
  terminal_id     TEXT REFERENCES terminal(id),
  session_id      TEXT REFERENCES pos_session(id),
  category_id     TEXT NOT NULL REFERENCES expense_category(id),
  supplier_id     TEXT REFERENCES supplier(id),
  vendor_name     TEXT,
  vendor_gstin    TEXT,
  series_id       TEXT NOT NULL REFERENCES doc_series(id),
  doc_number      TEXT NOT NULL,
  doc_seq         INTEGER NOT NULL,
  expense_date    TEXT NOT NULL,
  fy              TEXT NOT NULL,
  description     TEXT,
  method          TEXT NOT NULL CHECK (method IN ('cash','upi','card','bank','cheque','credit','other')),
  reference       TEXT,
  supply_type     TEXT CHECK (supply_type IS NULL OR supply_type IN ('intra','inter')),
  taxable_paise   INTEGER NOT NULL CHECK (taxable_paise >= 0),
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  itc_paise       INTEGER NOT NULL DEFAULT 0,
  round_off_paise INTEGER NOT NULL DEFAULT 0 CHECK (round_off_paise BETWEEN -100 AND 100),
  total_paise     INTEGER NOT NULL CHECK (total_paise > 0),
  due_date        TEXT,
  settled_paise   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + round_off_paise),
  CHECK (cgst_paise + sgst_paise + igst_paise + cess_paise = 0 OR supply_type IS NOT NULL),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK (itc_paise BETWEEN 0 AND cgst_paise + sgst_paise + igst_paise + cess_paise),
  CHECK (method <> 'credit' OR (supplier_id IS NOT NULL AND due_date IS NOT NULL)),
  CHECK (settled_paise BETWEEN 0 AND CASE WHEN method = 'credit' THEN total_paise ELSE 0 END),
  CHECK (status = 'posted' OR settled_paise = 0)
);
CREATE UNIQUE INDEX ux_expense_doc ON expense(business_id, series_id, doc_seq);
CREATE INDEX ix_expense_date ON expense(business_id, expense_date);

-- Settlements (payments, debit notes, write-offs, openings in the party's favour) applied to charges (ADR-0025).
CREATE TABLE allocation (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  party_type   TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id     TEXT NOT NULL,
  source_type  TEXT NOT NULL CHECK (source_type IN ('payment','debit_note','write_off','opening')),
  source_id    TEXT NOT NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('sale','purchase','expense','opening')),
  target_id    TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  allocated_at TEXT NOT NULL,
  voided_at    TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (NOT (source_type = 'opening' AND target_type = 'opening'))
);
CREATE INDEX ix_allocation_source ON allocation(business_id, source_type, source_id);
CREATE INDEX ix_allocation_target ON allocation(business_id, target_type, target_id);
CREATE INDEX ix_allocation_party ON allocation(business_id, party_type, party_id);
CREATE TRIGGER trg_allocation_no_delete BEFORE DELETE ON allocation BEGIN SELECT RAISE(ABORT, 'allocation is append-only'); END;
CREATE TRIGGER trg_allocation_frozen BEFORE UPDATE OF
  id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at
  ON allocation BEGIN SELECT RAISE(ABORT, 'allocation is append-only'); END;
CREATE TRIGGER trg_allocation_void_once BEFORE UPDATE OF voided_at ON allocation
  WHEN OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL
  BEGIN SELECT RAISE(ABORT, 'allocation is append-only'); END;

-- Both documents must be live and belong to the allocation's party.
CREATE TRIGGER trg_allocation_parties BEFORE INSERT ON allocation
  WHEN NEW.party_type || ':' || NEW.party_id IS NOT CASE NEW.source_type
      WHEN 'payment'    THEN (SELECT party_type || ':' || party_id FROM payment WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'debit_note' THEN (SELECT 'supplier:' || supplier_id FROM debit_note WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'write_off'  THEN (SELECT 'customer:' || customer_id FROM write_off WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'opening'    THEN (SELECT party_type || ':' || party_id FROM party_opening WHERE id = NEW.source_id AND status = 'posted'
                                AND side = CASE party_type WHEN 'customer' THEN 'payable' ELSE 'receivable' END)
    END
    OR NEW.party_type || ':' || NEW.party_id IS NOT CASE NEW.target_type
      WHEN 'sale'     THEN (SELECT 'customer:' || customer_id FROM sale WHERE id = NEW.target_id AND status = 'posted')
      WHEN 'purchase' THEN (SELECT 'supplier:' || supplier_id FROM purchase WHERE id = NEW.target_id AND status = 'posted')
      WHEN 'expense'  THEN (SELECT 'supplier:' || supplier_id FROM expense WHERE id = NEW.target_id AND status = 'posted' AND method = 'credit')
      WHEN 'opening'  THEN (SELECT party_type || ':' || party_id FROM party_opening WHERE id = NEW.target_id AND status = 'posted'
                              AND side = CASE party_type WHEN 'customer' THEN 'receivable' ELSE 'payable' END)
    END
  BEGIN SELECT RAISE(ABORT, 'allocation documents must be live and belong to its party'); END;

CREATE TRIGGER trg_allocation_apply AFTER INSERT ON allocation BEGIN
  UPDATE payment       SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'payment'    AND id = NEW.source_id;
  UPDATE debit_note    SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'debit_note' AND id = NEW.source_id;
  UPDATE write_off     SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'write_off'  AND id = NEW.source_id;
  UPDATE party_opening SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'opening'    AND id = NEW.source_id;
  UPDATE sale          SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'sale'     AND id = NEW.target_id;
  UPDATE purchase      SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'purchase' AND id = NEW.target_id;
  UPDATE expense       SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'expense'  AND id = NEW.target_id;
  UPDATE party_opening SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'opening'  AND id = NEW.target_id;
END;
CREATE TRIGGER trg_allocation_void AFTER UPDATE OF voided_at ON allocation BEGIN
  UPDATE payment       SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'payment'    AND id = NEW.source_id;
  UPDATE debit_note    SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'debit_note' AND id = NEW.source_id;
  UPDATE write_off     SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'write_off'  AND id = NEW.source_id;
  UPDATE party_opening SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'opening'    AND id = NEW.source_id;
  UPDATE sale          SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'sale'     AND id = NEW.target_id;
  UPDATE purchase      SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'purchase' AND id = NEW.target_id;
  UPDATE expense       SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'expense'  AND id = NEW.target_id;
  UPDATE party_opening SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'opening'  AND id = NEW.target_id;
END;

-- The party sub-ledger (ADR-0022): positive = the party owes the business. Never synced as a balance (LLD §9).
CREATE TABLE party_ledger_entry (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  party_type   TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id     TEXT NOT NULL,
  ref_type     TEXT NOT NULL CHECK (ref_type IN ('sale','purchase','debit_note','payment','write_off','opening','expense')),
  ref_id       TEXT NOT NULL,
  entry_kind   TEXT NOT NULL CHECK (entry_kind IN ('post','cancel')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise <> 0),
  doc_date     TEXT NOT NULL,
  due_date     TEXT,
  occurred_at  TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict'))
);
CREATE UNIQUE INDEX ux_party_entry_ref ON party_ledger_entry(business_id, ref_type, ref_id, entry_kind);
CREATE INDEX ix_party_entry_party ON party_ledger_entry(business_id, party_type, party_id, doc_date, id);
CREATE TRIGGER trg_party_entry_no_update BEFORE UPDATE OF
  id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, due_date, occurred_at
  ON party_ledger_entry BEGIN SELECT RAISE(ABORT, 'party_ledger_entry is append-only'); END;
CREATE TRIGGER trg_party_entry_no_delete BEFORE DELETE ON party_ledger_entry BEGIN SELECT RAISE(ABORT, 'party_ledger_entry is append-only'); END;

-- Documents: amounts frozen; only status, cancellation, allocation totals and sync bookkeeping change.
CREATE TRIGGER trg_purchase_no_delete BEFORE DELETE ON purchase BEGIN SELECT RAISE(ABORT, 'purchase is append-only'); END;
CREATE TRIGGER trg_purchase_frozen BEFORE UPDATE OF
  id, business_id, branch_id, warehouse_id, supplier_id, supplier_snapshot_json, supplier_invoice_no, supplier_invoice_date, series_id,
  doc_number, doc_seq, doc_date, fy, place_of_supply_state, supply_type, supplier_tax_scheme, gross_paise, line_discount_paise,
  bill_discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, charges_paise, round_off_paise, total_paise,
  itc_paise, due_date
  ON purchase BEGIN SELECT RAISE(ABORT, 'purchase is append-only'); END;
CREATE TRIGGER trg_purchase_item_no_update BEFORE UPDATE ON purchase_item BEGIN SELECT RAISE(ABORT, 'purchase_item is append-only'); END;
CREATE TRIGGER trg_purchase_item_no_delete BEFORE DELETE ON purchase_item BEGIN SELECT RAISE(ABORT, 'purchase_item is append-only'); END;
CREATE TRIGGER trg_purchase_charge_no_update BEFORE UPDATE ON purchase_charge BEGIN SELECT RAISE(ABORT, 'purchase_charge is append-only'); END;
CREATE TRIGGER trg_purchase_charge_no_delete BEFORE DELETE ON purchase_charge BEGIN SELECT RAISE(ABORT, 'purchase_charge is append-only'); END;
CREATE TRIGGER trg_debit_note_no_delete BEFORE DELETE ON debit_note BEGIN SELECT RAISE(ABORT, 'debit_note is append-only'); END;
CREATE TRIGGER trg_debit_note_frozen BEFORE UPDATE OF
  id, business_id, branch_id, warehouse_id, purchase_id, supplier_id, series_id, doc_number, doc_seq, doc_date, fy, supply_type,
  taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, charges_paise, round_off_paise, total_paise, itc_reversed_paise
  ON debit_note BEGIN SELECT RAISE(ABORT, 'debit_note is append-only'); END;
CREATE TRIGGER trg_debit_note_item_no_update BEFORE UPDATE ON debit_note_item BEGIN SELECT RAISE(ABORT, 'debit_note_item is append-only'); END;
CREATE TRIGGER trg_debit_note_item_no_delete BEFORE DELETE ON debit_note_item BEGIN SELECT RAISE(ABORT, 'debit_note_item is append-only'); END;
CREATE TRIGGER trg_payment_no_delete BEFORE DELETE ON payment BEGIN SELECT RAISE(ABORT, 'payment is append-only'); END;
CREATE TRIGGER trg_payment_frozen BEFORE UPDATE OF
  id, business_id, branch_id, terminal_id, session_id, direction, party_type, party_id, series_id, doc_number, doc_seq, payment_date, fy,
  method, amount_paise
  ON payment BEGIN SELECT RAISE(ABORT, 'payment is append-only'); END;
CREATE TRIGGER trg_write_off_no_delete BEFORE DELETE ON write_off BEGIN SELECT RAISE(ABORT, 'write_off is append-only'); END;
CREATE TRIGGER trg_write_off_frozen BEFORE UPDATE OF id, business_id, customer_id, doc_date, amount_paise, reason
  ON write_off BEGIN SELECT RAISE(ABORT, 'write_off is append-only'); END;
CREATE TRIGGER trg_party_opening_no_delete BEFORE DELETE ON party_opening BEGIN SELECT RAISE(ABORT, 'party_opening is append-only'); END;
CREATE TRIGGER trg_party_opening_frozen BEFORE UPDATE OF id, business_id, party_type, party_id, side, amount_paise, as_of_date
  ON party_opening BEGIN SELECT RAISE(ABORT, 'party_opening is append-only'); END;
CREATE TRIGGER trg_expense_no_delete BEFORE DELETE ON expense BEGIN SELECT RAISE(ABORT, 'expense is append-only'); END;
CREATE TRIGGER trg_expense_frozen BEFORE UPDATE OF
  id, business_id, branch_id, terminal_id, session_id, category_id, supplier_id, series_id, doc_number, doc_seq, expense_date, fy, method,
  supply_type, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, itc_paise, round_off_paise, total_paise, due_date
  ON expense BEGIN SELECT RAISE(ABORT, 'expense is append-only'); END;
