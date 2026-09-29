-- 0002_catalog — Stage 2 catalog (LLD §2.1): units, categories, brands, products, barcodes, price lists, search index.
-- Selling prices live in price_list_item (ADR-0011); product_fts is maintained by the repository (ADR-0009).

CREATE TABLE uom (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  decimals    INTEGER NOT NULL DEFAULT 0 CHECK (decimals BETWEEN 0 AND 3),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_uom_code ON uom(business_id, code) WHERE deleted_at IS NULL;

CREATE TABLE category (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  parent_id   TEXT REFERENCES category(id),
  name        TEXT NOT NULL,
  name_norm   TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_category_name ON category(business_id, COALESCE(parent_id, ''), name_norm) WHERE deleted_at IS NULL;

CREATE TABLE brand (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  name        TEXT NOT NULL,
  name_norm   TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_brand_name ON brand(business_id, name_norm) WHERE deleted_at IS NULL;

CREATE TABLE product (
  id                  TEXT PRIMARY KEY,
  business_id         TEXT NOT NULL REFERENCES business(id),
  name                TEXT NOT NULL,
  name_norm           TEXT NOT NULL,
  sku                 TEXT,
  hsn_code            TEXT,
  category_id         TEXT REFERENCES category(id),
  brand_id            TEXT REFERENCES brand(id),
  base_uom_id         TEXT NOT NULL REFERENCES uom(id),
  tax_treatment       TEXT NOT NULL DEFAULT 'taxable'
    CHECK (tax_treatment IN ('taxable','nil_rated','exempt','non_gst','zero_rated')),
  gst_rate_bp         INTEGER NOT NULL DEFAULT 0 CHECK (gst_rate_bp BETWEEN 0 AND 10000),
  cess_rate_bp        INTEGER NOT NULL DEFAULT 0 CHECK (cess_rate_bp BETWEEN 0 AND 10000),
  cess_per_unit_paise INTEGER NOT NULL DEFAULT 0 CHECK (cess_per_unit_paise >= 0),
  price_is_inclusive  INTEGER NOT NULL DEFAULT 1 CHECK (price_is_inclusive IN (0,1)),
  mrp_paise           INTEGER CHECK (mrp_paise >= 0),
  purchase_price_paise INTEGER CHECK (purchase_price_paise >= 0),
  tracks_batch        INTEGER NOT NULL DEFAULT 0 CHECK (tracks_batch IN (0,1)),
  tracks_serial       INTEGER NOT NULL DEFAULT 0 CHECK (tracks_serial IN (0,1)),
  allow_negative_stock INTEGER CHECK (allow_negative_stock IN (0,1)),
  reorder_level_milli INTEGER CHECK (reorder_level_milli >= 0),
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_product_sku ON product(business_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_product_search ON product(business_id, name_norm);
CREATE INDEX ix_product_active ON product(business_id, is_active, name_norm);
CREATE INDEX ix_product_category ON product(business_id, category_id);
CREATE INDEX ix_product_brand ON product(business_id, brand_id);

CREATE TABLE product_variant (              -- schema-ready; no API until variants are in scope (ADR-0008)
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  product_id  TEXT NOT NULL REFERENCES product(id),
  sku         TEXT,
  attrs_json  TEXT NOT NULL DEFAULT '{}',
  mrp_paise   INTEGER CHECK (mrp_paise >= 0),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);

CREATE TABLE barcode (
  id             TEXT PRIMARY KEY,
  business_id    TEXT NOT NULL REFERENCES business(id),
  product_id     TEXT NOT NULL REFERENCES product(id),
  variant_id     TEXT REFERENCES product_variant(id),
  code           TEXT NOT NULL,
  symbology      TEXT NOT NULL DEFAULT 'EAN13' CHECK (symbology IN ('EAN13','EAN8','UPCA','CODE128')),
  uom_id         TEXT REFERENCES uom(id),
  pack_qty_milli INTEGER NOT NULL DEFAULT 1000 CHECK (pack_qty_milli > 0),
  is_primary     INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);
-- NFR-001: the most latency-critical index in the product
CREATE UNIQUE INDEX ux_barcode ON barcode(business_id, code) WHERE deleted_at IS NULL;
CREATE INDEX ix_barcode_product ON barcode(product_id);

CREATE TABLE uom_conversion (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  product_id   TEXT NOT NULL REFERENCES product(id),
  from_uom_id  TEXT NOT NULL REFERENCES uom(id),
  to_uom_id    TEXT NOT NULL REFERENCES uom(id),
  factor_milli INTEGER NOT NULL CHECK (factor_milli > 0),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  CHECK (from_uom_id <> to_uom_id)
);
CREATE UNIQUE INDEX ux_uom_conversion ON uom_conversion(product_id, from_uom_id) WHERE deleted_at IS NULL;

CREATE TABLE price_list (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('retail','wholesale','distributor','custom')),
  is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_price_list_name ON price_list(business_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_price_list_default ON price_list(business_id) WHERE is_default = 1 AND deleted_at IS NULL;

CREATE TABLE price_list_item (
  id             TEXT PRIMARY KEY,
  business_id    TEXT NOT NULL REFERENCES business(id),
  price_list_id  TEXT NOT NULL REFERENCES price_list(id),
  product_id     TEXT NOT NULL REFERENCES product(id),
  variant_id     TEXT REFERENCES product_variant(id),
  uom_id         TEXT NOT NULL REFERENCES uom(id),
  min_qty_milli  INTEGER NOT NULL DEFAULT 0 CHECK (min_qty_milli >= 0),
  price_paise    INTEGER NOT NULL CHECK (price_paise >= 0),
  is_inclusive   INTEGER NOT NULL DEFAULT 1 CHECK (is_inclusive IN (0,1)),
  effective_from TEXT NOT NULL,
  effective_to   TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE UNIQUE INDEX ux_price_list_item ON price_list_item(
  price_list_id, product_id, COALESCE(variant_id, ''), uom_id, min_qty_milli, effective_from
) WHERE deleted_at IS NULL;
CREATE INDEX ix_price_list_item_product ON price_list_item(product_id, price_list_id);

CREATE VIRTUAL TABLE product_fts USING fts5(
  product_id UNINDEXED, business_id UNINDEXED, name, sku, hsn_code, brand_name,
  tokenize = 'unicode61 remove_diacritics 2'
);
