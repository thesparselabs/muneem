-- 0016_credit_notes — Stage 8b (ADR-0043): sale returns and cancellations are credit notes in their own tables, referencing the
-- sale and its lines. Allocations and party ledger entries learn the new document type; SQLite cannot widen a CHECK, so those
-- two tables are rebuilt with the same columns, indexes and triggers.

CREATE TABLE credit_note (
  id                    TEXT PRIMARY KEY,
  business_id           TEXT NOT NULL REFERENCES business(id),
  branch_id             TEXT NOT NULL REFERENCES branch(id),
  terminal_id           TEXT NOT NULL REFERENCES terminal(id),
  session_id            TEXT REFERENCES pos_session(id),
  warehouse_id          TEXT NOT NULL REFERENCES warehouse(id),
  sale_id               TEXT NOT NULL REFERENCES sale(id),
  customer_id           TEXT REFERENCES customer(id),
  series_id             TEXT NOT NULL REFERENCES doc_series(id),
  doc_number            TEXT NOT NULL,
  doc_seq               INTEGER NOT NULL,
  doc_date              TEXT NOT NULL,
  fy                    TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('return','cancel')),
  reason                TEXT NOT NULL CHECK (length(reason) > 0),
  supply_type           TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  state_tax_kind        TEXT NOT NULL DEFAULT 'sgst' CHECK (state_tax_kind IN ('sgst','utgst')),
  place_of_supply_state TEXT NOT NULL CHECK (length(place_of_supply_state) = 2),
  gstr1_bucket          TEXT NOT NULL CHECK (gstr1_bucket IN ('cdnr','cdnur','na')),
  taxable_paise         INTEGER NOT NULL CHECK (taxable_paise >= 0),
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise       INTEGER NOT NULL DEFAULT 0 CHECK (round_off_paise BETWEEN -100 AND 100),
  total_paise           INTEGER NOT NULL CHECK (total_paise > 0),
  cost_paise            INTEGER NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  refund_method         TEXT NOT NULL CHECK (refund_method IN ('cash','upi','card','credit')),
  refund_paise          INTEGER NOT NULL CHECK (refund_paise >= 0),
  credit_paise          INTEGER NOT NULL CHECK (credit_paise >= 0),
  allocated_paise       INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  command_id            TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0))),
  CHECK (refund_paise + credit_paise = total_paise),
  CHECK (refund_method <> 'credit' OR refund_paise = 0),
  CHECK (customer_id IS NOT NULL OR credit_paise = 0),
  CHECK (allocated_paise BETWEEN 0 AND credit_paise)
);
CREATE UNIQUE INDEX ux_credit_note_doc ON credit_note(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_credit_note_command ON credit_note(business_id, command_id);
CREATE INDEX ix_credit_note_sale ON credit_note(sale_id);
CREATE INDEX ix_credit_note_date ON credit_note(business_id, doc_date);
CREATE INDEX ix_credit_note_customer ON credit_note(business_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX ix_credit_note_session ON credit_note(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE credit_note_item (
  id                    TEXT PRIMARY KEY,
  credit_note_id        TEXT NOT NULL REFERENCES credit_note(id),
  business_id           TEXT NOT NULL,
  line_no               INTEGER NOT NULL,
  sale_item_id          TEXT NOT NULL REFERENCES sale_item(id),
  product_id            TEXT NOT NULL REFERENCES product(id),
  qty_milli             INTEGER NOT NULL CHECK (qty_milli > 0),
  base_qty_milli        INTEGER NOT NULL CHECK (base_qty_milli >= 0),
  returned_before_milli INTEGER NOT NULL CHECK (returned_before_milli >= 0),
  taxable_paise         INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  total_paise           INTEGER NOT NULL,
  cost_paise            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (credit_note_id, line_no),
  UNIQUE (credit_note_id, sale_item_id),
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise)
);
CREATE INDEX ix_credit_note_item_line ON credit_note_item(sale_item_id);
-- Never return more of a line than was sold on it.
CREATE TRIGGER trg_credit_note_item_qty BEFORE INSERT ON credit_note_item
  WHEN NEW.qty_milli + COALESCE((SELECT SUM(i.qty_milli) FROM credit_note_item i JOIN credit_note n ON n.id = i.credit_note_id
      WHERE i.sale_item_id = NEW.sale_item_id AND n.status = 'posted'), 0)
    > (SELECT qty_milli FROM sale_item WHERE id = NEW.sale_item_id)
  BEGIN SELECT RAISE(ABORT, 'RETURN_QTY_EXCEEDED'); END;

CREATE TRIGGER trg_credit_note_no_delete BEFORE DELETE ON credit_note BEGIN SELECT RAISE(ABORT, 'credit_note is append-only'); END;
CREATE TRIGGER trg_credit_note_frozen BEFORE UPDATE OF
  id, business_id, branch_id, terminal_id, session_id, warehouse_id, sale_id, customer_id, series_id, doc_number, doc_seq, doc_date, fy, kind,
  supply_type, place_of_supply_state, gstr1_bucket, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise, round_off_paise, total_paise,
  cost_paise, refund_method, refund_paise, credit_paise, command_id
  ON credit_note BEGIN SELECT RAISE(ABORT, 'credit_note is append-only'); END;
CREATE TRIGGER trg_credit_note_item_no_update BEFORE UPDATE ON credit_note_item BEGIN SELECT RAISE(ABORT, 'credit_note_item is append-only'); END;
CREATE TRIGGER trg_credit_note_item_no_delete BEFORE DELETE ON credit_note_item BEGIN SELECT RAISE(ABORT, 'credit_note_item is append-only'); END;

PRAGMA legacy_alter_table = ON;

CREATE TABLE allocation_next (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  party_type   TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id     TEXT NOT NULL,
  source_type  TEXT NOT NULL CHECK (source_type IN ('payment','debit_note','credit_note','write_off','opening')),
  source_id    TEXT NOT NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('sale','purchase','expense','opening')),
  target_id    TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  allocated_at TEXT NOT NULL,
  voided_at    TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  allocated_on TEXT,
  voided_on    TEXT,
  CHECK (NOT (source_type = 'opening' AND target_type = 'opening'))
);
INSERT INTO allocation_next (id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at, voided_at,
    created_at, updated_at, created_by, device_id, version, sync_state, allocated_on, voided_on)
  SELECT id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at, voided_at,
    created_at, updated_at, created_by, device_id, version, sync_state, allocated_on, voided_on FROM allocation;
DROP TABLE allocation;
ALTER TABLE allocation_next RENAME TO allocation;
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
CREATE TRIGGER trg_allocation_dated BEFORE INSERT ON allocation WHEN NEW.allocated_on IS NULL
  BEGIN SELECT RAISE(ABORT, 'allocation needs allocated_on'); END;
CREATE TRIGGER trg_allocation_on_frozen BEFORE UPDATE OF allocated_on ON allocation
  BEGIN SELECT RAISE(ABORT, 'allocation is append-only'); END;
CREATE TRIGGER trg_allocation_voided_on BEFORE UPDATE OF voided_at ON allocation WHEN NEW.voided_on IS NULL
  BEGIN SELECT RAISE(ABORT, 'a void needs voided_on'); END;

CREATE TRIGGER trg_allocation_parties BEFORE INSERT ON allocation
  WHEN NEW.party_type || ':' || NEW.party_id IS NOT CASE NEW.source_type
      WHEN 'payment'     THEN (SELECT party_type || ':' || party_id FROM payment WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'debit_note'  THEN (SELECT 'supplier:' || supplier_id FROM debit_note WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'credit_note' THEN (SELECT 'customer:' || customer_id FROM credit_note WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'write_off'   THEN (SELECT 'customer:' || customer_id FROM write_off WHERE id = NEW.source_id AND status = 'posted')
      WHEN 'opening'     THEN (SELECT party_type || ':' || party_id FROM party_opening WHERE id = NEW.source_id AND status = 'posted'
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
  UPDATE payment       SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'payment'     AND id = NEW.source_id;
  UPDATE debit_note    SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'debit_note'  AND id = NEW.source_id;
  UPDATE credit_note   SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'credit_note' AND id = NEW.source_id;
  UPDATE write_off     SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'write_off'   AND id = NEW.source_id;
  UPDATE party_opening SET allocated_paise = allocated_paise + NEW.amount_paise WHERE NEW.source_type = 'opening'     AND id = NEW.source_id;
  UPDATE sale          SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'sale'     AND id = NEW.target_id;
  UPDATE purchase      SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'purchase' AND id = NEW.target_id;
  UPDATE expense       SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'expense'  AND id = NEW.target_id;
  UPDATE party_opening SET settled_paise = settled_paise + NEW.amount_paise WHERE NEW.target_type = 'opening'  AND id = NEW.target_id;
END;
CREATE TRIGGER trg_allocation_void AFTER UPDATE OF voided_at ON allocation BEGIN
  UPDATE payment       SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'payment'     AND id = NEW.source_id;
  UPDATE debit_note    SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'debit_note'  AND id = NEW.source_id;
  UPDATE credit_note   SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'credit_note' AND id = NEW.source_id;
  UPDATE write_off     SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'write_off'   AND id = NEW.source_id;
  UPDATE party_opening SET allocated_paise = allocated_paise - NEW.amount_paise WHERE NEW.source_type = 'opening'     AND id = NEW.source_id;
  UPDATE sale          SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'sale'     AND id = NEW.target_id;
  UPDATE purchase      SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'purchase' AND id = NEW.target_id;
  UPDATE expense       SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'expense'  AND id = NEW.target_id;
  UPDATE party_opening SET settled_paise = settled_paise - NEW.amount_paise WHERE NEW.target_type = 'opening'  AND id = NEW.target_id;
END;

CREATE TABLE party_ledger_entry_next (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  party_type   TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id     TEXT NOT NULL,
  ref_type     TEXT NOT NULL CHECK (ref_type IN ('sale','purchase','debit_note','credit_note','payment','write_off','opening','expense')),
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
INSERT INTO party_ledger_entry_next (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, due_date, occurred_at,
    created_at, updated_at, created_by, device_id, version, sync_state)
  SELECT id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, due_date, occurred_at,
    created_at, updated_at, created_by, device_id, version, sync_state FROM party_ledger_entry;
DROP TABLE party_ledger_entry;
ALTER TABLE party_ledger_entry_next RENAME TO party_ledger_entry;
CREATE UNIQUE INDEX ux_party_entry_ref ON party_ledger_entry(business_id, ref_type, ref_id, entry_kind);
CREATE INDEX ix_party_entry_party ON party_ledger_entry(business_id, party_type, party_id, doc_date, id);
CREATE TRIGGER trg_party_entry_no_update BEFORE UPDATE OF
  id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, due_date, occurred_at
  ON party_ledger_entry BEGIN SELECT RAISE(ABORT, 'party_ledger_entry is append-only'); END;
CREATE TRIGGER trg_party_entry_no_delete BEFORE DELETE ON party_ledger_entry BEGIN SELECT RAISE(ABORT, 'party_ledger_entry is append-only'); END;

PRAGMA legacy_alter_table = OFF;
