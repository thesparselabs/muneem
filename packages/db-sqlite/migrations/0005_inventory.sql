-- 0005_inventory — Stage 4 (LLD §2.3, §4.1; ADR-0018–0021). Movements are the source of truth; stock_level is a cache
-- written in the same transaction. Each movement stores the exact change it made to the level's value.

CREATE TABLE warehouse (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  branch_id   TEXT NOT NULL REFERENCES branch(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  UNIQUE (business_id, code)
);
CREATE UNIQUE INDEX ux_warehouse_default ON warehouse(branch_id) WHERE is_default = 1 AND deleted_at IS NULL;

CREATE TABLE stock_adjustment (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouse(id),
  kind         TEXT NOT NULL CHECK (kind IN ('opening','adjustment','stock_take')),
  note         TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict'))
);

CREATE TABLE stock_movement (
  id               TEXT PRIMARY KEY,
  business_id      TEXT NOT NULL REFERENCES business(id),
  warehouse_id     TEXT NOT NULL REFERENCES warehouse(id),
  product_id       TEXT NOT NULL REFERENCES product(id),
  variant_id       TEXT, batch_id TEXT, serial_id TEXT,
  movement_type    TEXT NOT NULL CHECK (movement_type IN
    ('opening','purchase','purchase_return','sale','sale_return','transfer_in','transfer_out','adjustment',
     'production','consumption','cost_correction')),
  signed_qty_milli INTEGER NOT NULL,
  unit_cost_paise  INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_paise >= 0),
  value_paise      INTEGER NOT NULL DEFAULT 0,
  cost_provisional INTEGER NOT NULL DEFAULT 0 CHECK (cost_provisional IN (0,1)),
  ref_type         TEXT NOT NULL CHECK (ref_type IN ('sale','opening','adjustment','stock_take','purchase','sale_return','purchase_return','correction')),
  ref_id           TEXT NOT NULL,
  ref_line_id      TEXT,
  reason_code      TEXT CHECK (reason_code IS NULL OR reason_code IN ('damage','theft','expiry','counting_error','opening','other')),
  note             TEXT,
  occurred_at      TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK ((movement_type = 'cost_correction') = (signed_qty_milli = 0)),
  CHECK (movement_type <> 'cost_correction' OR value_paise <> 0)
);
CREATE UNIQUE INDEX ux_movement_ref ON stock_movement(business_id, ref_type, ref_id, COALESCE(ref_line_id, ''), movement_type);
CREATE INDEX ix_mov_stock ON stock_movement(business_id, warehouse_id, product_id, created_at, id);
CREATE INDEX ix_mov_ref ON stock_movement(business_id, ref_type, ref_id);
CREATE TRIGGER trg_movement_no_update BEFORE UPDATE OF
  id, business_id, warehouse_id, product_id, movement_type, signed_qty_milli, unit_cost_paise, value_paise, cost_provisional,
  ref_type, ref_id, ref_line_id, occurred_at
  ON stock_movement BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;
CREATE TRIGGER trg_movement_no_delete BEFORE DELETE ON stock_movement BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;

-- Cache of the movements; rebuildable at any time (never synced, LLD §9).
CREATE TABLE stock_level (
  business_id          TEXT NOT NULL,
  warehouse_id         TEXT NOT NULL REFERENCES warehouse(id),
  product_id           TEXT NOT NULL REFERENCES product(id),
  variant_id           TEXT NOT NULL DEFAULT '',
  qty_milli            INTEGER NOT NULL DEFAULT 0,
  value_paise          INTEGER NOT NULL DEFAULT 0,
  avg_cost_paise       INTEGER NOT NULL DEFAULT 0,
  last_unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  last_movement_at     TEXT,
  PRIMARY KEY (business_id, warehouse_id, product_id, variant_id),
  CHECK (qty_milli <> 0 OR value_paise = 0)
);
CREATE INDEX ix_stock_level_product ON stock_level(business_id, product_id);

CREATE TABLE batch (                          -- schema-ready; batch/serial tracking is deferred (ADR-0021)
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business(id), product_id TEXT NOT NULL REFERENCES product(id),
  batch_no TEXT NOT NULL, mfg_date TEXT, expiry_date TEXT,
  mrp_paise INTEGER, unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  UNIQUE (business_id, product_id, batch_no)
);
CREATE INDEX ix_batch_expiry ON batch(business_id, expiry_date);
