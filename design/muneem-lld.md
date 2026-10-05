# Muneem — Low-Level Design (LLD)

**Version:** 1.0 · **Date:** 2026-09-26 · **Depends on:** `muneem-hld.md` · **Gaps addressed:** `muneem-prd-review.md`

Contents: 1 Money & ids · 2 SQLite schema · 3 GST engine · 4 Costing/inventory engine · 5 Accounting engine · 6 Numbering · 7 Sync protocol · 8 Sync engine internals · 9 Conflict matrix · 10 IPC contract · 11 PostgreSQL · 12 Migrations · 13 Hardware · 14 Reports · 15 Auth/RBAC · 16 Audit · 17 Errors · 18 Performance · 19 Testing.

---

## 1. Money, quantity and identifier kernel

### 1.1 Types

```ts
type Paise    = number & { __brand: 'Paise' };    // integer, 1 INR = 100
type MilliQty = number & { __brand: 'MilliQty' }; // integer, 1 unit = 1000
type BasisPts = number & { __brand: 'BasisPts' }; // integer, 18% = 1800
```

All three are safe as JS integers (`Number.MAX_SAFE_INTEGER` ≈ 9.0e15 ⇒ ₹90,071,992,547 in paise — far beyond any SMB total). SQLite `INTEGER` is 64-bit; Postgres uses `BIGINT`. A CI lint rejects `REAL`/`FLOAT`/`DOUBLE` in any column whose name matches `_paise|_qty|_bp|amount|price|rate|total|tax`.

### 1.2 Rounding — one function, used everywhere

```ts
// HALF_UP on the absolute value, sign preserved (₹ convention, matches GSTN examples)
export function divRound(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const n = Math.abs(numerator), d = Math.abs(denominator);
  return sign * Math.floor((2 * n + d) / (2 * d));
}
export const pctOf = (base: number, bp: BasisPts) => divRound(base * bp, 10_000);
```

Nothing in the codebase is permitted to use `Math.round`, `toFixed`, or float division on a financial value. `divRound` is exhaustively unit-tested including ties, negatives and the paise boundary.

### 1.3 Largest-remainder apportionment (bill discount, tender rounding, cess)

```ts
// BigInt intermediates: total x weight can exceed Number.MAX_SAFE_INTEGER on a
// 500-line wholesale invoice, and a silent 1-ulp float error here is a paise error
// on the invoice. No float ever touches an apportioned amount.
export function apportion(total: Paise, weights: number[]): Paise[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0 as Paise);
  const S = BigInt(sum), T = BigInt(total);
  const base: number[] = [], rem: bigint[] = [];
  for (const w of weights) {
    const num = T * BigInt(w);
    base.push(Number(num / S));
    rem.push(num % S);                                  // exact fractional part
  }
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = rem.map((r, i) => ({ i, r }))
                   .sort((a, b) => (a.r < b.r ? 1 : a.r > b.r ? -1 : a.i - b.i)); // deterministic
  for (const { i } of order) { if (left <= 0) break; base[i]++; left--; }
  return base as Paise[];
}
```

Guarantee: `Σ apportion(total, w) === total`, exactly, always, with a deterministic tie-break so device and cloud agree byte-for-byte.

### 1.4 Identifiers

| Kind | Format | Notes |
|---|---|---|
| Entity PK | ULID (26 chars, Crockford base32) | Monotonic per process, time-sortable, no coordination — ideal for offline creation (FR-064) |
| Local trace | `(business_id, device_id, local_seq)` | `local_seq` from a single `local_sequence` row bumped in-transaction; gives human-orderable device history |
| Idempotency | `operation_id` = ULID per outbox row | Unique `(business_id, device_id, operation_id)` on the server |
| Command id | `command_id` = ULID minted by the renderer per commit attempt | Prevents double-submit (FR-108); stored on the sale |
| Document number | `<series_code>/<fy>/<seq>` | Per §6 |

---

## 2. SQLite schema (core tables)

Conventions on every syncable business table:

```sql
id           TEXT PRIMARY KEY,          -- ULID
business_id  TEXT NOT NULL,
branch_id    TEXT,
created_at   TEXT NOT NULL,            -- ISO-8601 UTC, 'YYYY-MM-DDTHH:MM:SS.sssZ'
updated_at   TEXT NOT NULL,
created_by   TEXT NOT NULL,
device_id    TEXT NOT NULL,            -- origin device
version      INTEGER NOT NULL DEFAULT 1,
sync_state   TEXT NOT NULL DEFAULT 'pending'  -- pending|synced|conflict
              CHECK (sync_state IN ('pending','synced','conflict')),
deleted_at   TEXT                      -- soft delete; financial docs never set this
```

Pragmas applied on every connection open:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = FULL;      -- financial durability over raw speed (NFR-019)
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store   = MEMORY;
PRAGMA mmap_size    = 268435456;
PRAGMA cache_size   = -65536;    -- 64 MB
```

### 2.1 Products, barcodes, pricing, UOM

```sql
CREATE TABLE product (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  name TEXT NOT NULL, name_norm TEXT NOT NULL,     -- lowercased, unaccented, for prefix search
  sku TEXT, hsn_code TEXT,
  category_id TEXT REFERENCES category(id), brand_id TEXT REFERENCES brand(id),
  base_uom_id TEXT NOT NULL REFERENCES uom(id),
  tax_treatment TEXT NOT NULL DEFAULT 'taxable'
    CHECK (tax_treatment IN ('taxable','nil_rated','exempt','non_gst','zero_rated')),
  gst_rate_bp INTEGER NOT NULL DEFAULT 0,          -- current default; snapshot on lines (FR-092)
  cess_rate_bp INTEGER NOT NULL DEFAULT 0,
  cess_per_unit_paise INTEGER NOT NULL DEFAULT 0,
  price_is_inclusive INTEGER NOT NULL DEFAULT 1,   -- Indian retail default: MRP-inclusive
  mrp_paise INTEGER, purchase_price_paise INTEGER,
  tracks_batch INTEGER NOT NULL DEFAULT 0, tracks_serial INTEGER NOT NULL DEFAULT 0,
  allow_negative_stock INTEGER,                    -- NULL = inherit business policy (FR-088)
  reorder_level_milli INTEGER, is_active INTEGER NOT NULL DEFAULT 1,
  /* + standard sync columns */
  UNIQUE (business_id, sku)
);
CREATE INDEX ix_product_search  ON product(business_id, name_norm);
CREATE INDEX ix_product_active  ON product(business_id, is_active, name_norm);

CREATE TABLE product_variant (              -- size/color/model; pack sizes are UOM, not variants
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES product(id),
  business_id TEXT NOT NULL, sku TEXT, attrs_json TEXT NOT NULL DEFAULT '{}',
  mrp_paise INTEGER, is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE barcode (                      -- FR-015 multiple barcodes
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES product(id),
  variant_id TEXT REFERENCES product_variant(id),
  code TEXT NOT NULL, symbology TEXT NOT NULL DEFAULT 'EAN13',
  uom_id TEXT REFERENCES uom(id),           -- a case barcode scans as 1 case
  pack_qty_milli INTEGER NOT NULL DEFAULT 1000,
  is_primary INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ux_barcode ON barcode(business_id, code) WHERE deleted_at IS NULL;
-- the single most latency-critical index in the product (NFR-001: <100 ms barcode lookup)

CREATE TABLE uom (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 0       -- 0 for pcs, 3 for kg
);
CREATE TABLE uom_conversion (               -- FR-090
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, product_id TEXT NOT NULL,
  from_uom_id TEXT NOT NULL, to_uom_id TEXT NOT NULL,
  factor_milli INTEGER NOT NULL             -- 1 case = 24000 milli-pcs
);

CREATE TABLE price_list (                   -- FR-091
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retail','wholesale','distributor','custom')),
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE price_list_item (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  price_list_id TEXT NOT NULL REFERENCES price_list(id),
  product_id TEXT NOT NULL, variant_id TEXT, uom_id TEXT NOT NULL,
  min_qty_milli INTEGER NOT NULL DEFAULT 0, -- quantity breaks
  price_paise INTEGER NOT NULL, is_inclusive INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL, effective_to TEXT,
  UNIQUE (price_list_id, product_id, variant_id, uom_id, min_qty_milli, effective_from)
);
```

```sql
CREATE TABLE category (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, parent_id TEXT REFERENCES category(id),
  name TEXT NOT NULL, name_norm TEXT NOT NULL /* + standard sync columns */);
CREATE TABLE brand (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, name_norm TEXT NOT NULL
  /* + standard sync columns */);
CREATE VIRTUAL TABLE product_fts USING fts5(product_id UNINDEXED, business_id UNINDEXED,
  name, sku, hsn_code, brand_name, tokenize = 'unicode61 remove_diacritics 2');
```

There is no selling-price column on `product`: the selling price is a `price_list_item` in the business's default `Retail` list, and every price is chosen by the pure `resolvePrice` function (ADR-0011). Unique keys that include a nullable column (`sku`, `variant_id`, `parent_id`) are partial or `COALESCE` expression indexes, because SQLite treats NULLs as distinct.

Product search uses an FTS5 table over name, SKU, HSN and brand name for token search, with the plain `name_norm` index serving prefix search — FTS5 alone is poor at short prefixes, and prefix is what cashiers type. `product_fts` is written by the product repository in the same transaction (not triggers), because `brand_name` is copied from `brand` and a rename must re-index. `name_norm` strips accents only after Latin letters; Indic vowel signs are kept (ADR-0009).

### 2.2 Sales (append-only)

```sql
CREATE TABLE sale (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, branch_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES pos_session(id),
  command_id TEXT NOT NULL,                       -- double-submit guard (FR-108)
  doc_type TEXT NOT NULL CHECK (doc_type IN ('tax_invoice','bill_of_supply','credit_note','delivery_challan')),
  series_id TEXT NOT NULL REFERENCES doc_series(id),
  doc_number TEXT NOT NULL, doc_seq INTEGER NOT NULL,
  doc_date TEXT NOT NULL,                         -- business date (not created_at)
  fy TEXT NOT NULL,                               -- '2026-27'
  customer_id TEXT REFERENCES customer(id),
  customer_snapshot_json TEXT NOT NULL,           -- name/gstin/address as billed (FR-092 snapshot rule)
  place_of_supply_state TEXT NOT NULL,            -- 2-digit GST state code (FR-093)
  supply_type TEXT NOT NULL CHECK (supply_type IN ('intra','inter')),
  gstr1_bucket TEXT NOT NULL,                     -- b2b|b2cl|b2cs|cdnr|cdnur|exempt|nil|non_gst (FR-094)
  is_reverse_charge INTEGER NOT NULL DEFAULT 0,
  price_list_id TEXT,
  gross_paise INTEGER NOT NULL,                   -- Σ line qty×rate before any discount
  line_discount_paise INTEGER NOT NULL DEFAULT 0,
  bill_discount_paise INTEGER NOT NULL DEFAULT 0,
  taxable_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  paid_paise INTEGER NOT NULL DEFAULT 0, credit_paise INTEGER NOT NULL DEFAULT 0,
  cogs_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT,   -- FR-079: never deleted
  returned_qty_flag INTEGER NOT NULL DEFAULT 0,
  original_sale_id TEXT REFERENCES sale(id),      -- credit notes
  irn TEXT, irn_ack_no TEXT, irn_ack_date TEXT, qr_payload TEXT, einvoice_status TEXT,
  /* + sync columns */
  CHECK (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise + round_off_paise),
  CHECK (NOT (supply_type = 'intra' AND igst_paise <> 0)),
  CHECK (NOT (supply_type = 'inter' AND (cgst_paise <> 0 OR sgst_paise <> 0)))
);
CREATE UNIQUE INDEX ux_sale_doc     ON sale(business_id, series_id, doc_seq);
CREATE UNIQUE INDEX ux_sale_command ON sale(business_id, command_id);
CREATE INDEX ix_sale_date ON sale(business_id, doc_date);
CREATE INDEX ix_sale_cust ON sale(business_id, customer_id, doc_date);
```

The three `CHECK` constraints are deliberate: they make an incorrect tax split **impossible to persist**, not merely unlikely. `ux_sale_command` makes double-submit a no-op at the storage layer.

```sql
CREATE TABLE sale_item (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sale(id), business_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  product_id TEXT NOT NULL, variant_id TEXT, batch_id TEXT,
  -- snapshot: a report must reproduce the invoice even if the product is later renamed or re-rated
  product_name TEXT NOT NULL, hsn_code TEXT, uom_code TEXT NOT NULL,
  qty_milli INTEGER NOT NULL CHECK (qty_milli > 0),
  rate_paise INTEGER NOT NULL,                  -- per base UOM, exclusive of tax
  mrp_paise INTEGER,
  gross_paise INTEGER NOT NULL,
  line_discount_paise INTEGER NOT NULL DEFAULT 0,
  apportioned_bill_discount_paise INTEGER NOT NULL DEFAULT 0,   -- C-4
  taxable_paise INTEGER NOT NULL,
  tax_treatment TEXT NOT NULL, gst_rate_bp INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0, sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  cess_rate_bp INTEGER NOT NULL DEFAULT 0, cess_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0, cogs_paise INTEGER NOT NULL DEFAULT 0,
  returned_qty_milli INTEGER NOT NULL DEFAULT 0,
  original_sale_item_id TEXT,                   -- credit-note line ← original line (C-6)
  UNIQUE (sale_id, line_no)
);

-- As built (Stage 8b, ADR-0043): credit notes live in their own credit_note / credit_note_item tables (each item names
-- its sale_item_id), not as sale rows; original_sale_id, returned_qty_flag and original_sale_item_id stay unused.

CREATE TABLE sale_tender (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sale(id), business_id TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','upi','card','bank','credit','wallet','other')),
  amount_paise INTEGER NOT NULL,
  change_paise INTEGER NOT NULL DEFAULT 0,
  reference TEXT, instrument_last4 TEXT, approval_code TEXT,
  account_id TEXT                              -- bank/clearing account for non-cash
);
```

### 2.3 Inventory ledger and projection

```sql
CREATE TABLE stock_movement (                  -- immutable, append-only (AD-4)
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL, variant_id TEXT, batch_id TEXT, serial_id TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN
    ('opening','purchase','purchase_return','sale','sale_return',
     'transfer_in','transfer_out','adjustment','production','consumption')),
  signed_qty_milli INTEGER NOT NULL CHECK (signed_qty_milli <> 0),   -- C-1: sign lives in the data
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  value_paise INTEGER NOT NULL DEFAULT 0,      -- signed; issues are negative
  ref_type TEXT NOT NULL, ref_id TEXT NOT NULL, ref_line_id TEXT,
  reason_code TEXT, note TEXT,
  occurred_at TEXT NOT NULL,
  /* + sync columns */
  UNIQUE (business_id, ref_type, ref_id, ref_line_id, movement_type)   -- idempotent replay
);
CREATE INDEX ix_mov_stock ON stock_movement(business_id, warehouse_id, product_id, variant_id, occurred_at);
CREATE INDEX ix_mov_ref   ON stock_movement(business_id, ref_type, ref_id);

CREATE TABLE stock_level (                     -- cached projection, rebuildable
  business_id TEXT NOT NULL, warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL, variant_id TEXT NOT NULL DEFAULT '',
  qty_milli INTEGER NOT NULL DEFAULT 0,
  value_paise INTEGER NOT NULL DEFAULT 0,      -- for moving-average cost
  avg_cost_paise INTEGER NOT NULL DEFAULT 0,   -- derived, denormalized for speed
  last_movement_at TEXT,
  PRIMARY KEY (business_id, warehouse_id, product_id, variant_id)
);

CREATE TABLE batch (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, product_id TEXT NOT NULL,
  batch_no TEXT NOT NULL, mfg_date TEXT, expiry_date TEXT,
  mrp_paise INTEGER, unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  UNIQUE (business_id, product_id, batch_no)
);
CREATE INDEX ix_batch_expiry ON batch(business_id, expiry_date);
```

*As built (Stage 4, ADR-0018/0021):* a `warehouse` table (one default per branch) and a `stock_adjustment` document header are added; `stock_movement` gains `cost_provisional` and a value-only `cost_correction` type, its unique key uses `COALESCE(ref_line_id,'')`, and **`value_paise` is the exact change the movement made to the level's value**, so Σ movement values always equals `stock_level.value_paise` despite the zero clamp and negative-stock re-valuation in §4.1. `stock_level` gains `last_unit_cost_paise` (the fallback for issues below zero). Costing below zero differs from §4.1: units already below zero keep their cost (an issue adds only its own units), and a receipt re-costs only the units it covers, booking the difference as a `cost_correction`; §4.1's `value = qty × unit_cost` re-valued the whole negative balance and charged it to the next sale.

### 2.4 Accounting

```sql
CREATE TABLE account (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  code TEXT NOT NULL, name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  subtype TEXT NOT NULL,                       -- cash|bank|ar|ap|inventory|input_tax|output_tax|cogs|...
  parent_id TEXT REFERENCES account(id),
  normal_side TEXT NOT NULL CHECK (normal_side IN ('debit','credit')),
  is_system INTEGER NOT NULL DEFAULT 0,        -- system accounts cannot be deleted or retyped
  party_type TEXT, party_id TEXT,              -- subledger link for customer/supplier control accounts
  UNIQUE (business_id, code)
);

CREATE TABLE journal_entry (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, branch_id TEXT,
  entry_no TEXT NOT NULL, entry_date TEXT NOT NULL, fy TEXT NOT NULL,
  period_id TEXT NOT NULL REFERENCES accounting_period(id),
  source TEXT NOT NULL CHECK (source IN
    ('sale','sale_return','purchase','purchase_return','receipt','payment',
     'expense','stock_adjustment','transfer','manual','opening','closing','round_off')),
  ref_type TEXT, ref_id TEXT,
  narration TEXT,
  debit_total_paise INTEGER NOT NULL, credit_total_paise INTEGER NOT NULL,
  is_reversal_of TEXT REFERENCES journal_entry(id),
  /* + sync columns */
  CHECK (debit_total_paise = credit_total_paise)            -- FR-052, enforced by the engine
);
CREATE UNIQUE INDEX ux_je_ref ON journal_entry(business_id, source, ref_id) WHERE ref_id IS NOT NULL;

CREATE TABLE journal_line (
  id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES journal_entry(id),
  business_id TEXT NOT NULL, line_no INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES account(id),
  debit_paise INTEGER NOT NULL DEFAULT 0, credit_paise INTEGER NOT NULL DEFAULT 0,
  party_type TEXT, party_id TEXT,              -- drives customer/supplier ledgers
  cost_center TEXT, note TEXT,
  CHECK (debit_paise >= 0 AND credit_paise >= 0),
  CHECK ((debit_paise = 0) <> (credit_paise = 0))           -- exactly one side per line
);
CREATE INDEX ix_jl_acct  ON journal_line(business_id, account_id);
CREATE INDEX ix_jl_party ON journal_line(business_id, party_type, party_id);

CREATE TABLE accounting_period (               -- FR-096
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, fy TEXT NOT NULL,
  period_start TEXT NOT NULL, period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','soft_closed','locked')),
  locked_at TEXT, locked_by TEXT
);
```

`account_balance(business_id, account_id, fy, period_id, debit_paise, credit_paise)` is a maintained projection updated in the same transaction as the journal, so a trial balance is a single indexed scan rather than an aggregate over every line.

*As built (Stage 6, ADR-0030–0034):*
- **`account`** gains `role` (what posting rules name; one account per role), `is_group` (headers nothing posts to)
  and sync columns. A system account can be renamed but not retyped or deleted.
- **`journal_entry`** gains `doc_date`, `late_posting` and `terminal_id`.
- **Sources** add `write_off`, `register_close` and `cash_movement`.
- **`ux_je_ref`** is `(business, source, ref_id, COALESCE(is_reversal_of, ''))`, so a document has one journal and at
  most one reversal.
- **`accounting_period`** is `open` / `locked` only, with `unlock_reason`.

### 2.5 Payments

```sql
CREATE TABLE payment (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, branch_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  party_type TEXT NOT NULL CHECK (party_type IN ('customer','supplier','other')),
  party_id TEXT, doc_number TEXT NOT NULL, series_id TEXT NOT NULL,
  payment_date TEXT NOT NULL, method TEXT NOT NULL,
  account_id TEXT NOT NULL,                    -- cash / bank / clearing
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  allocated_paise INTEGER NOT NULL DEFAULT 0,
  reference TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled')),
  CHECK (allocated_paise <= amount_paise)      -- §17 invariant, enforced structurally
);
CREATE TABLE payment_allocation (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  payment_id TEXT NOT NULL REFERENCES payment(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('sale','purchase','credit_note','debit_note','advance')),
  target_id TEXT, amount_paise INTEGER NOT NULL CHECK (amount_paise > 0)
);
CREATE INDEX ix_alloc_target ON payment_allocation(business_id, target_type, target_id);
```

Unallocated remainder sits as an advance (`allocated_paise < amount_paise`) and shows on the party ledger as an on-account credit. Auto-allocation default: oldest due date first, user-overridable (FR-055/056 clarification).

*As built (Stage 5, ADR-0022–0025):* `payment_allocation` is generalised to **`allocation`**: the source is a payment, debit note, write-off or opening balance, the target a credit sale, purchase, credit expense or opening balance. Triggers keep `allocated_paise` on the source and `settled_paise` on the target, and CHECKs on both make over-allocation impossible to store; allocations are append-only and end only by `voided_at`. Each carries business dates `allocated_on` / `voided_on` (never before the settled document), so ageing as of a past date ignores later settlements (5h, migration 0009). Customers pay in and suppliers are paid out (a CHECK); `account_id` is nullable until Stage 6. New tables: `supplier`, `purchase` / `purchase_item` / `purchase_charge`, `debit_note` / `debit_note_item`, `party_opening`, `write_off`, `expense_category`, `expense`, and the append-only **`party_ledger_entry`** (signed, positive = the party owes the business), which is the sub-ledger Stage 6 ties to 1300 / 2100. `customer` gains `credit_limit_paise` (NULL = no credit) and `credit_days`; `sale` gains `due_date` and `settled_paise`. Purchase lines store `landed_value_paise` = taxable + apportioned charges + tax that cannot be claimed, enforced by a CHECK.

### 2.6 POS session, series, operational tables

```sql
CREATE TABLE terminal (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, branch_id TEXT NOT NULL,
  code TEXT NOT NULL, name TEXT NOT NULL, device_id TEXT,
  UNIQUE (business_id, branch_id, code)
);

CREATE TABLE pos_session (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, branch_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL REFERENCES terminal(id),
  session_no INTEGER NOT NULL, opened_by TEXT NOT NULL, opened_at TEXT NOT NULL,
  opening_cash_paise INTEGER NOT NULL,
  closed_by TEXT, closed_at TEXT,
  expected_cash_paise INTEGER, counted_cash_paise INTEGER, variance_paise INTEGER,
  denomination_json TEXT, blind_close INTEGER NOT NULL DEFAULT 0,
  variance_approved_by TEXT, z_report_json TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closing','closed')),
  UNIQUE (business_id, terminal_id, session_no)
);
CREATE UNIQUE INDEX ux_session_open ON pos_session(business_id, terminal_id) WHERE status <> 'closed';
-- one open session per terminal, enforced by the database (FR-099)

CREATE TABLE cash_movement (                   -- petty cash in/out, safe drop
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cash_in','cash_out','safe_drop','expense','refund')),
  amount_paise INTEGER NOT NULL, reason TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE doc_series (                      -- C-2 / §6
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, branch_id TEXT, terminal_id TEXT,
  doc_type TEXT NOT NULL, fy TEXT NOT NULL,
  prefix TEXT NOT NULL, pad_width INTEGER NOT NULL DEFAULT 6,
  next_seq INTEGER NOT NULL DEFAULT 1,
  UNIQUE (business_id, doc_type, fy, branch_id, terminal_id)
);

CREATE TABLE held_bill (                       -- FR-030
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, terminal_id TEXT NOT NULL,
  session_id TEXT NOT NULL, label TEXT, cart_json TEXT NOT NULL,
  held_by TEXT NOT NULL, held_at TEXT NOT NULL
);

CREATE TABLE sync_outbox (                     -- §20 of the PRD, refined
  seq INTEGER PRIMARY KEY AUTOINCREMENT,       -- per-device total order
  operation_id TEXT NOT NULL UNIQUE,           -- ULID, the idempotency key
  business_id TEXT NOT NULL, device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create','update','cancel','void')),
  payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
  depends_on_operation_id TEXT,                -- ordering across entities
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_flight','sent','failed','dead','superseded')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT, last_attempt_at TEXT,
  error_code TEXT, error_message TEXT, error_class TEXT,
  created_at TEXT NOT NULL, batch_id TEXT
);
CREATE INDEX ix_outbox_ready ON sync_outbox(status, next_attempt_at, seq);

CREATE TABLE sync_cursor (                     -- FR-085 down-sync
  business_id TEXT NOT NULL, stream TEXT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0, last_pulled_at TEXT,
  PRIMARY KEY (business_id, stream)
);

CREATE TABLE print_job (                       -- FR-100
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  doc_type TEXT NOT NULL, doc_id TEXT NOT NULL, printer_id TEXT NOT NULL,
  copy_no INTEGER NOT NULL DEFAULT 1, is_duplicate INTEGER NOT NULL DEFAULT 0,
  payload_blob BLOB, status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','printing','done','failed','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0, error_message TEXT,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
);

CREATE TABLE audit_log (                       -- FR-078 + hash chain
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
  seq INTEGER NOT NULL,                        -- per device, gap-free
  user_id TEXT NOT NULL, device_id TEXT NOT NULL, terminal_id TEXT,
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
  before_json TEXT, after_json TEXT, reason TEXT,
  occurred_at TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL,
  UNIQUE (business_id, device_id, seq)
);
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
```

Equivalent append-only triggers guard `stock_movement`, `journal_entry`, `journal_line` and `sale_item`. Immutability that is only a convention gets violated by the third developer; immutability enforced by `RAISE(ABORT)` does not.

---

## 3. GST engine

Pure function, no I/O. Identical *results* on device (TypeScript) and cloud (Go port in `cloud/internal/domain`), proven by the shared fixture suite (AD-2).

```ts
computeInvoice(input: {
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  isUnionTerritoryWithoutLegislature: boolean;
  taxScheme: 'regular' | 'composition' | 'unregistered';
  customerGstin?: string;
  billDiscount: { kind: 'amount' | 'percent'; value: number };
  roundToRupee: boolean;
  lines: Array<{
    qtyMilli: MilliQty; unitPrice: Paise; priceIsInclusive: boolean;
    lineDiscount: { kind: 'amount' | 'percent'; value: number };
    gstRateBp: BasisPts; cessRateBp: BasisPts; cessPerUnitPaise: Paise;
    taxTreatment: TaxTreatment;
  }>;
}): InvoiceTotals
```

### 3.1 Algorithm (exact order — order changes results)

```text
1  supply_type = intra if placeOfSupply == supplierState else inter
2  per line:
     gross          = divRound(qtyMilli * unitPrice, 1000)
     if priceIsInclusive:                      // C-3
        gross_ex     = divRound(gross * 10000, 10000 + gstRateBp + cessRateBp)
     else gross_ex   = gross
     line_disc      = kind=='percent' ? pctOf(gross_ex, value*100) : value
     line_taxable_0 = gross_ex - line_disc
3  bill_disc_total  = kind=='percent' ? pctOf(Σ line_taxable_0, value*100) : value
   bill_disc[]      = apportion(bill_disc_total, line_taxable_0[])      // C-4, largest remainder
4  per line:
     taxable        = line_taxable_0 - bill_disc[i]
     if taxTreatment != 'taxable' or scheme != 'regular':  all tax = 0
     else if supply_type == 'intra':
        tax_total   = pctOf(taxable, gstRateBp)
        cgst        = divRound(taxable * gstRateBp, 20_000)    // = half the rate, integer maths only
        sgst        = tax_total - cgst                         // C-3: the halves always re-sum
        igst        = 0
     else:
        igst        = pctOf(taxable, gstRateBp); cgst = sgst = 0
     cess           = pctOf(taxable, cessRateBp) + divRound(qtyMilli * cessPerUnitPaise, 1000)
     line_total     = taxable + cgst + sgst + igst + cess
5  invoice sums    = Σ of line fields
6  if roundToRupee:
     total_before   = taxable + cgst + sgst + igst + cess
     total          = divRound(total_before, 100) * 100
     round_off      = total - total_before          // signed; posts to Round Off account
7  gstr1_bucket:
     credit note                                   -> customerGstin ? 'cdnr' : 'cdnur'
     customerGstin present                         -> 'b2b'
     inter-state & total > B2CL_THRESHOLD_PAISE    -> 'b2cl'
     all lines nil/exempt/non_gst                  -> that treatment
     else                                          -> 'b2cs'
```

Notes that matter in practice:

- **Inclusive back-calculation must divide by `(10000 + gstRateBp + cessRateBp)`**, not just the GST rate, or cess-bearing MRP items are mis-taxed.
- **Never compute the two halves independently.** `divRound(taxable * rate / 20000)` for CGST and `sgst = tax_total − cgst` is deliberate: the 0.25% slab halves to 12.5 bp, so a naive `pctOf(taxable, rate/2)` would take a non-integer rate, and two independent roundings can make `cgst + sgst ≠ tax_total` by a paise — which GSTN validation and the buyer's books will both reject.
- `B2CL_THRESHOLD_PAISE` lives in a **versioned, effective-dated config table** synced from the cloud, never a code constant — thresholds and rates change by notification, and a rate change must not require a desktop release.
- Composition scheme produces `doc_type = 'bill_of_supply'`, zero tax, and a mandatory printed declaration (FR-095).

### 3.2 Golden vectors (CI gate)

A checked-in fixture file of ~120 cases, each with expected paise-exact output, covering: 5/12/18/28% intra and inter; inclusive MRP with and without cess; 0.25% and 1.5% slabs; percent and amount discounts at line and bill level; three-line bill where naive apportionment loses 1 paise; round-off up, down and exactly .50; nil/exempt/non-GST mixes; single-paise invoices; quantity 0.001 kg; a 500-line wholesale invoice. The same fixture files run against the Go cloud ingest verifier — that is the test that keeps AD-2 honest.

---

## 4. Costing and inventory engine

### 4.1 Moving weighted average (FR-089)

State per `(product, variant, warehouse)`: `qty_milli`, `value_paise`. Cost is always derived, never stored as the source of truth.

```text
RECEIPT (purchase, sale_return, positive adjustment, transfer_in):
   qty   += q
   value += receipt_value                  // landed cost, excl. ITC-eligible tax
   avg    = qty > 0 ? divRound(value * 1000, qty) : avg      // paise per base unit

ISSUE (sale, purchase_return, negative adjustment, transfer_out):
   unit_cost = qty > 0 ? divRound(value * 1000, qty) : last_known_unit_cost   // FR-088 fallback
   issue_value = divRound(q * unit_cost, 1000)
   qty   -= q
   value -= issue_value
   if qty == 0: value = 0                  // clamp: avoids residue drift
   if qty <  0: value = divRound(qty * unit_cost, 1000)   // keep value consistent with a negative qty
```

**Negative-stock cost correction:** when an issue happens at `qty <= 0`, the movement is tagged `cost_provisional = 1`. On the next receipt, a `cost_correction` journal (`Dr/Cr COGS ↔ Inventory`) is posted for the difference between the provisional cost and the actual receipt cost, referencing the original movements. Without this, a shop that sells before booking the purchase invoice — which is the normal case in Indian retail — shows a permanently wrong gross margin.

**Batch/serial items** bypass the average: cost comes from the batch layer (`batch.unit_cost_paise`), and issue selection defaults to **FEFO** (earliest expiry first) for batch-tracked goods, with manual override.

*As built (Stage 5, ADR-0024):* a purchase return is **not** an issue at average cost. It leaves at the original purchase line's landed unit cost (`returnToSupplier`), matching the posting matrix's exact reversal; any value that leaves the level out of line with its quantity is a `cost_correction` movement. *Stage 5 fix (ADR-0027):* an issue that leaves stock on hand takes its share of the value, `divRound(value × q, qty)`, instead of `q × unit_cost` with the unit cost rounded to the paisa, which over-costed cheap items and could leave a negative value on positive stock.

### 4.2 Projection integrity

`stock_level` is a cache. Two guarantees:

1. Every writer updates `stock_movement` and `stock_level` in the **same transaction**, via the repository — no direct `UPDATE stock_level` anywhere else in the codebase (lint-enforced).
2. A nightly `integrity:stock` job replays movements for a rotating slice of products and compares against the cache; a mismatch raises a diagnostics alert and auto-heals by rewriting the projection from the ledger.

`rebuildStockLevels(businessId, productIds?)` is a supported, idempotent operation exposed in Diagnostics and used after any sync repair.

### 4.3 Oversell reconciliation across terminals (FR-087/088)

The cloud detects, per `(product, warehouse)`, whether the merged movement set ever crosses zero, and produces a *Stock Reconciliation* item listing the contributing devices and documents. Nothing is reversed automatically — the sales are real and the money was collected; the shop decides whether it was a stock-count error, a missing purchase entry, or a genuine oversell.

---

## 5. Accounting engine

### 5.1 Chart of accounts seed (system accounts, `is_system = 1`)

```text
1000 Assets
  1100 Cash in Hand              (cash)          1110 Petty Cash
  1200 Bank Accounts             (bank)
  1250 Card/UPI Settlement Clearing (bank)   ← non-cash tenders land here until settled
  1300 Accounts Receivable       (ar)            control account, subledger by customer
  1400 Inventory                 (inventory)
  1500 Input GST — CGST / SGST / IGST / Cess (input_tax)
  1600 GST Credit Ledger         (input_tax)
2000 Liabilities
  2100 Accounts Payable          (ap)            control account, subledger by supplier
  2200 Output GST — CGST / SGST / IGST / Cess (output_tax)
  2300 GST Payable               (output_tax)
  2400 Advances from Customers
3000 Equity: 3100 Owner's Capital · 3200 Drawings · 3300 Retained Earnings
4000 Income: 4100 Sales — Goods · 4110 Sales — Services · 4200 Discount Allowed (contra)
             4300 Other Income · 4400 Inventory Gain · 4900 Round Off
5000 Expenses: 5100 COGS · 5200 Inventory Shrinkage/Write-off · 5300 Discount Given
             5400 Rent · 5410 Salaries · 5420 Electricity · 5430 Transport · 5440 Internet
             5450 Repairs · 5460 Bank Charges · 5900 Other Expenses
```

*As built (Stage 6, ADR-0031):*
- **Tax accounts:** input and output tax have one account per head: 1510/1520/1530/1540 and 2210/2220/2230/2240
  (SGST and UTGST share).
- **Added accounts:** 1199 Cash to classify, 3400 Opening Balance Equity, 5110 Purchase-return Losses, 5470 Bad Debts.
- **Groups:** 1000–5000 are headers.
- **The seed** is data in `@muneem/domain` (`CHART_OF_ACCOUNTS`).

### 5.2 Posting matrix (the single most review-worthy artifact — get a CA to sign it)

*As built:* the full matrix, including the Stage 4–5 documents this section does not cover, is
`docs/accounting/posting-matrix.md` (ADR-0032). In short:
- **Customer receipts** post wholly to 1300; an advance is a credit balance, presented on the Balance Sheet, and 2400
  is unused.
- **Freight kept on returns** goes to 5110.
- **Manual cash in/out** goes to 1199.
- **Openings** go against 3400.

**Cash/UPI sale, regular scheme, intra-state, perpetual inventory:**

| Dr | Cr | Amount |
|---|---|---|
| 1100 Cash / 1250 Clearing | | tender amounts |
| 1300 AR (customer) | | credit portion |
| | 4100 Sales — Goods | `taxable_paise` (net of all discounts) |
| | 2200 Output CGST | `cgst_paise` |
| | 2200 Output SGST | `sgst_paise` |
| | 2200 Output Cess | `cess_paise` |
| 4900 Round Off *(or Cr)* | | `round_off_paise` (signed) |
| 5100 COGS | | `Σ line cogs_paise` |
| | 1400 Inventory | `Σ line cogs_paise` |

Inter-state swaps the two `Output CGST/SGST` lines for `Output IGST`. Composition/unregistered omits all tax lines. Revenue is booked **net of discount**; the optional `4200 Discount Allowed` contra presentation is a reporting toggle, not a second posting.

**Sales return / credit note:** exact reversal of the above at the **original line's** rate and the **original issue cost**, with `Cr AR` or `Dr Cash` for the refund tender, and `Dr Inventory / Cr COGS` at original cost. *As built (ADR-0043):* the refund side is `Cr 1100 Cash` / `Cr 1250 Clearing` / `Cr 1300 AR`; part returns carry no round-off, the note that completes the bill takes back the sale's.

**Purchase invoice (ITC eligible):** `Dr 1400 Inventory` (taxable + non-eligible tax + apportioned landed cost) · `Dr 1500 Input CGST/SGST/IGST` (eligible) · `Cr 2100 AP`.
**Purchase return:** reverse, `Dr AP / Cr Inventory + Cr Input tax`.
**Customer receipt:** `Dr Cash/Bank · Cr AR` (+ `Cr 2400 Advances` for the unallocated remainder).
**Supplier payment:** `Dr AP · Cr Cash/Bank`.
**Expense:** `Dr expense · Dr Input tax (if eligible) · Cr Cash/Bank/AP`. *Write-off (Stage 5, ADR-0025):* `Dr 5470 Bad Debts · Cr 1300 AR` — 5470 is added to the §5.1 seed in Stage 6.
**Stock adjustment:** negative → `Dr 5200 Shrinkage · Cr 1400 Inventory` at current cost; positive → `Dr 1400 · Cr 4400 Inventory Gain`.
**Transfer, same GSTIN:** **no journal entry** — Inventory is a single account with a warehouse dimension on the movement. (A different-GSTIN branch transfer is a taxable supply and is out of MVP — guard-railed per the FR-010 clarification.)
**Card/UPI settlement:** `Dr Bank · Dr 5460 Bank Charges · Cr 1250 Clearing`, reconciled when the acquirer credits.
**Register cash variance:** short → `Dr 5900 · Cr 1100`; over → `Dr 1100 · Cr 4300`, always with the approver in the audit trail.
**Year-end close:** income/expense accounts closed to `3300 Retained Earnings` by one `closing` journal dated 31 March (ADR-0045); balance-sheet accounts need no opening journal, since the ledger is continuous.

### 5.3 Posting rules as data

Postings are declared, not hand-coded per call site:

```ts
const SALE_RULE: PostingRule = {
  source: 'sale',
  lines: [
    { when: t => t.cashTender > 0,  dr: acct('cash'),        amount: t => t.cashTender },
    { when: t => t.cardTender > 0,  dr: acct('clearing'),    amount: t => t.cardTender },
    { when: t => t.creditPortion>0, dr: acct('ar'),          amount: t => t.creditPortion,
                                    party: t => ({ type:'customer', id: t.customerId }) },
    {                               cr: acct('sales_goods'), amount: t => t.taxable },
    { when: t => t.cgst > 0,        cr: acct('output_cgst'), amount: t => t.cgst },
    /* ... */
  ],
  assert: t => t.debitTotal === t.creditTotal,
};
```

`AccountingEngine.post(rule, txn)` builds the entry, asserts balance, and throws `LEDGER_IMBALANCE` before any write. Combined with the `CHECK` constraint on `journal_entry`, an unbalanced entry cannot exist in the database — which is what FR-052 actually requires.

### 5.4 Period lock behaviour for late offline transactions (FR-096)

Ingest of a document dated into a `locked` period does **not** reject and does **not** silently post. It writes the document, posts the journal into the **earliest open period** with `posted_date != doc_date` and a `late_posting` flag, and raises a review item naming the document, both dates and the device. This is the only option that satisfies both "never lose a transaction" (P7) and "filed periods don't change".

---

## 6. Document numbering engine

```ts
async function allocate(tx, { businessId, docType, branchId, terminalId, docDate }) {
  const fy = financialYearOf(docDate);                  // April–March
  const series = tx.get(`SELECT * FROM doc_series
      WHERE business_id=? AND doc_type=? AND fy=? AND branch_id IS ? AND terminal_id IS ?`,
      [businessId, docType, fy, branchId, terminalId]) ?? createSeries(tx, ...);
  const seq = series.next_seq;
  tx.run(`UPDATE doc_series SET next_seq = next_seq + 1 WHERE id = ? AND next_seq = ?`,
         [series.id, seq]);                             // optimistic guard
  return { seriesId: series.id, seq,
           number: `${series.prefix}/${fy}/${String(seq).padStart(series.pad_width,'0')}` };
}
```

Rules: allocation happens **inside** the document's transaction, so a rollback returns the number; `ux_sale_doc` makes a duplicate physically impossible; the number is never rewritten by sync; a gap detected during a nightly check raises an integrity alert (a gap means a crash between allocation and commit — which cannot happen with a single transaction, so a gap is a real signal).

Example series (as built, ADR-0014 — CGST Rule 46(b) caps numbers at 16 characters): `DE01/2627/000123` (sale, terminal prefix `DE01`). Credit notes and receipts will need their own short prefixes when they arrive. *As built (Stage 5, ADR-0028):* other documents put a kind letter after the terminal prefix and use 5 digits — `T1P/2627/00001` purchase, `T1D/2627/00001` debit note (R, Y, E for receipts, payments, expenses). *As built (Stage 8b, ADR-0043):* credit notes use `C` — `T1C/2627/00001`. GSTR-1 "Documents Issued" reports from–to per series directly off `doc_series` + `MIN/MAX(doc_seq)`.

---

## 7. Synchronization protocol

Base: `https://api.muneem.app/v1`. All requests carry `Authorization: Bearer <access>`, `X-Device-Id`, `X-Device-Signature`, `X-App-Version`, `X-Schema-Version`, `X-Sync-Protocol: 1`, `X-Request-Id`. All responses carry `X-Server-Time` (NFR-018).

### 7.1 Push (device → cloud)

```http
POST /v1/sync/push
Content-Encoding: gzip
{
  "device_id": "01J...", "business_id": "01J...",
  "protocol": 1, "schema_version": 42,
  "client_time": "2026-09-26T09:15:02.113Z",
  "operations": [
    { "operation_id": "01JA7...", "seq": 10481,
      "entity_type": "sale", "entity_id": "01JA7...", "operation_type": "create",
      "depends_on": null, "payload_hash": "sha256:...",
      "payload": { /* complete document: sale + items + tenders + movements + journal */ } }
  ]
}
```

```json
{
  "server_time": "2026-09-26T09:15:02.480Z",
  "results": [
    { "operation_id": "01JA7...", "status": "applied",   "server_seq": 99213 },
    { "operation_id": "01JA8...", "status": "duplicate", "server_seq": 99100 },
    { "operation_id": "01JA9...", "status": "rejected",
      "error": { "code": "TOTAL_MISMATCH", "class": "permanent",
                 "detail": "expected total_paise=118000 computed=117900",
                 "resolution": "support_review" } },
    { "operation_id": "01JAA...", "status": "deferred",
      "error": { "code": "DEPENDENCY_MISSING", "class": "transient",
                 "detail": "sale 01JA0... not yet ingested" } }
  ],
  "next_pull_seq": 99213
}
```

Design choices worth stating explicitly:

- **Aggregate-per-operation.** One operation carries the *entire* sale aggregate (header, lines, tenders, movements, journal, audit row) so the server applies it in one Postgres transaction. Splitting a sale across operations would create windows where the cloud holds a sale with no journal — which is exactly the state that makes cloud reports untrustworthy.
- **Partial success is normal.** Per-operation results, never all-or-nothing batches; one poisoned operation must not block 500 good ones.
- **`duplicate` is a success.** Detected by the unique index on `(business_id, device_id, operation_id)`; the original `server_seq` is returned so the device advances.
- **Server re-verifies.** Ingest recomputes GST totals and journal balance via the Go domain port (`cloud/internal/domain`). Mismatch → `rejected/permanent` → dead-letter with the full payload, plus an alert. The document is retained for support; it is never dropped and never silently "fixed".
- **Batching:** up to 200 operations or 2 MB per request, whichever comes first; gzip; `Idempotency-Key` on the batch itself so a retried HTTP request with an identical body is cheap.

### 7.2 Pull (cloud → device) — FR-085

```http
GET /v1/sync/pull?business_id=...&since=99213&limit=500
```

```json
{ "changes": [ { "seq": 99214, "entity_type": "product", "entity_id": "01J...",
                 "op": "upsert", "version": 7, "updated_at": "...",
                 "origin_device_id": null, "payload": { } } ],
  "next_seq": 99714, "has_more": true, "server_time": "..." }
```

- Server keeps `change_log(business_id, seq BIGSERIAL, entity_type, entity_id, op, version, payload_jsonb, origin_device_id)`. Any write to a syncable entity appends a row in the same transaction.
- The device **skips rows whose `origin_device_id` is itself** (it already has them) but still advances the cursor.
- A page is applied in a single SQLite transaction and the cursor advances with it — a crash mid-page replays the whole page, which is safe because upserts are idempotent on `(id, version)`.
- Streams are separated (`masters`, `config`, `documents`, `control`) so an urgent control message (device revoked, subscription lapsed, period locked) is not stuck behind 40,000 product rows.

### 7.3 Hydration (FR-086)

```http
POST /v1/sync/bootstrap   → { "snapshot_url": "<presigned>", "as_of_seq": 99213, "expires_at": "..." }
```

The server builds a compressed snapshot (SQLite file or NDJSON bundle) via a worker, the device downloads it with resume support, imports it, sets `sync_cursor = as_of_seq`, then pulls the delta. Building this for launch is not optional: it is the same code path as disaster recovery (HLD §12), device replacement and adding a second terminal.

### 7.4 Attachments (FR-075)

Files never traverse the API process. Device requests `POST /v1/documents/presign` → uploads to object storage → `POST /v1/documents/confirm` with the checksum. Offline, files sit in `%APPDATA%/Muneem/pending-uploads/` with a row in `document_upload_queue`; the uploader drains it with the same backoff policy as the outbox.

---

## 8. Sync engine internals (device)

### 8.1 Operation state machine

```text
 pending ──claim──► in_flight ──applied/duplicate──► sent ──(pruned after N days)
    ▲                   │
    │                   ├── transient error ──► pending  (backoff, attempt_count++)
    │                   ├── dependency missing ► pending  (requeue behind dependency)
    │                   └── permanent error ───► failed ──(attempts ≥ max)──► dead
    └── superseded (an entity-level cancel replaces an unsent update)
```

Backoff: `min(2^attempt × 1s, 15min)` with ±20% jitter, `max_attempts = 12`, then `dead` — never dropped, always visible in Diagnostics with a "resend" action. Claiming is `UPDATE ... SET status='in_flight' WHERE status='pending' AND next_attempt_at <= now ORDER BY seq LIMIT 200` inside a transaction, so a crashed worker's rows are reclaimed on startup (`in_flight` older than 5 min → `pending`).

### 8.2 Ordering

Strict `seq` order **per entity** and for anything with `depends_on`; independent entities go in parallel batches. The dependency chain in practice: `customer → sale → payment → payment_allocation`, and `purchase → stock_movement`. Because the sale aggregate is one operation, the chain is short — which is the point of the aggregate-per-operation choice.

### 8.3 Scheduler and connectivity

Triggers: app start; a real HTTP probe against `/v1/health` (never `navigator.onLine`, which lies); a post-commit nudge; a 60-second timer; manual retry. Adaptive pacing: idle → poll pull every 60 s; heavy billing → push batches continuously but pull at 5 min; metered/slow link → larger batches, longer intervals. Sync is a **utility process** so a stalled socket cannot touch the POS event loop.

### 8.4 Status model (FR-068)

Derived from `sync_outbox` in one query and pushed to the renderer on change:

| State | Condition | UI |
|---|---|---|
| `synced` | 0 pending, last push OK | ✓ Synced · 2 min ago |
| `syncing` | in_flight > 0 | ⟳ Syncing 12 |
| `queued` | pending > 0, offline | ⚠ 34 waiting · offline |
| `degraded` | failed > 0, retries pending | ⚠ retrying (3 failed) |
| `blocked` | dead > 0 **or** auth/version failure | ✕ Needs attention → Diagnostics |

The UI also shows **"stock last updated N minutes ago"** on the POS screen when another terminal exists. Being honest about staleness is what keeps trust when oversell happens (FR-087).

---

## 9. Conflict matrix (replaces "detect conflicts", FR-070)

| Entity class | Examples | Strategy | Rationale |
|---|---|---|---|
| **Financial documents** | sale, credit note, purchase, payment, journal, session, stock_movement | **Append-only, no conflict possible.** Unique per `(device, series, seq)`; corrections are new documents | §21 / AD-3 — money is never merged |
| **Document cancellation** | cancel a sale | Cancel wins over nothing; two cancels are idempotent; cancel of an already-returned doc is rejected with `INVALID_STATE` | Deterministic and auditable |
| **Stock levels** | qty on hand | **Never synced.** Projected from movements on both sides | AD-4 |
| **Simple master fields** | product name, category, HSN, reorder level | Field-level LWW by `updated_at`, tie-break on `device_id` for total determinism | Low blast radius |
| **Price and tax fields** | selling price, MRP, gst_rate_bp, tax_treatment | **Cloud/admin wins** over a device edit; the losing edit is preserved in a `conflict_log` review item | A cashier's typo must not silently override a head-office price |
| **Party balances** | customer outstanding, supplier payable | **Derived** from documents + allocations, never synced as a number | Same reasoning as stock |
| **Credit limit** | customer credit limit | Cloud wins; device changes require the permission and are queued | Control value |
| **Users, roles, permissions** | role grants | **Cloud is authoritative**, device is read-only cache | Security |
| **Config** | tax config, series, invoice templates, thresholds | Cloud authoritative + versioned; device edits go through the cloud when online, else queued as a proposal | Compliance-relevant |
| **Deletions** | product deactivation | Soft delete; tombstone wins over a concurrent update; a product referenced by documents can never be hard-deleted | Referential safety |
| **Same-entity concurrent create** | same barcode created on two devices | Both rows survive; the server flags a **duplicate-candidate** review item with a merge action | Silent merging of master data loses data |

Every non-trivial resolution writes a `conflict_log` row (both versions, the rule applied, the winner) and surfaces in a Review Items list. FR-070's "deterministic and auditable" means precisely: same inputs → same winner, and the loser is recoverable.

---

## 10. IPC contract (FR/NFR-006, §27)

### 10.1 Contract registry

```ts
export const contract = {
  'products.search': {
    input:  z.object({ query: z.string().max(64), limit: z.number().int().max(50).default(20),
                       mode: z.enum(['auto','barcode','name','sku']).default('auto') }),
    output: z.array(ProductHit),
    permission: 'products.view', rateLimit: { perSec: 30 },
  },
  'sales.complete': {
    input:  CompleteSaleInput,      // includes commandId: Ulid
    output: CompleteSaleResult,     // { saleId, docNumber, totals, printJobId }
    permission: 'sales.create', rateLimit: { perSec: 5 }, audit: true, idempotent: 'commandId',
  },
  // ... ~120 methods
} satisfies ContractMap;
```

The preload file is **generated** from this registry, so the renderer cannot reach a method that is not declared, and every method has a schema, a permission and a rate limit by construction. `window.muneem` is typed from the same source, so an IPC signature change is a compile error in the UI.

### 10.2 Surface (grouped)

```text
auth.*        login, loginOffline, logout, switchUser, verifyPin, getSession
business.*    get, update, getBranches, getTerminals, getTaxConfig
products.*    search, lookupBarcode, list, get, create, update, deactivate, reactivate, importPreview, importCommit
catalog.*     listUoms, createUom, listCategories, createCategory, updateCategory, listBrands, createBrand, updateBrand
pricing.*     listLists, createList, getItems, setItems
inventory.*   getStock, getMovements, valuation, listLowStock, setOpeningStock, adjust, stockTake, importOpeningPreview,
              importOpeningCommit, listWarehouses, rebuildProjections   (transfer: deferred with multi-warehouse)
customers.*   search, get, create, update, getLedger, getOutstanding, setCreditLimit, setOpening
suppliers.*   search, get, create, update, getLedger, getOutstanding, setOpening
pos.*         openRegister, closeRegister, getSession, xReport, zReport, cashMovement,
              holdBill, listHeldBills, retrieveBill, discardBill
sales.*       quote, complete, get, list, getReceipt, cancel, returnAgainst   (cancel/returnAgainst: later stages)
purchases.*   quote, create, get, list, return, cancel, importLinesPreview   (receive: dropped, no GRN — ADR-0023)
payments.*    create, allocate, get, list, cancel, openItems, writeOff
expenses.*    create, get, list, cancel, listCategories   (update → cancel + re-create — ADR-0025)
accounting.*  getTrialBalance, getLedger, postManualJournal, getPeriods, lockPeriod
reports.*     run(reportId, params), export(reportId, params, format), listDefinitions
gst.*         getSummary, getGstr1Buckets, getHsnSummary, exportGstr1
hardware.*    listDevices, testDevice, getStatus, setConfig, onEvent (push channel)
printer.*     getConfig, setConfig, testPrint, getQueue, retryJob, reprint
drawer.*      open                                  (IPC namespaces are lowercase, so not cashDrawer.*)
sync.*        getStatus, pushNow, pullNow, retryFailed, listDeadLetters, resend
settings.*    get, set, listSeries, createSeries
diagnostics.* getHealth, integrityCheck, backupNow, exportSupportBundle, getLogsTail
```

Explicitly absent, forever: `executeSql`, `executeShell`, `readFile`, `writeFile`, `openPath`, anything taking a raw path from the renderer. File dialogs are opened **by main**, which returns an opaque handle id — the renderer never learns a filesystem path.

### 10.3 Gateway pipeline

```ts
ipcMain.handle(channel, async (event, raw) => {
  assertSenderIsOurWindow(event);                     // reject any other frame
  const spec = contract[channel];                     // unknown channel → throw before any work
  const t0 = performance.now();
  try {
    const input = spec.input.parse(raw);              // zod, always
    const ctx   = await sessionService.require();     // user, business, branch, terminal, device
    rbac.assert(ctx, spec.permission, input);         // value thresholds too (e.g. discount %)
    rateLimiter.hit(channel, ctx.userId);
    const out = await dispatch(channel, input, ctx);
    if (spec.audit) audit.record(ctx, channel, input, out);
    return { ok: true, data: spec.output.parse(out) };
  } catch (e) {
    return { ok: false, error: toClientError(e) };    // coded, safe, no stack, no SQL text
  } finally { metrics.observe(channel, performance.now() - t0); }
});
```

Errors are returned as values, never thrown across the bridge, so the renderer cannot distinguish "method missing" from "permission denied" by exception shape — and cannot enumerate the surface.

---

## 11. PostgreSQL design

The relational shape mirrors SQLite (same column names and integer money) so the sync mapper is mechanical. Cloud-only additions:

```sql
CREATE TABLE sync_operation (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL, device_id UUID NOT NULL,
  operation_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL, payload JSONB NOT NULL, payload_hash TEXT NOT NULL,
  device_seq BIGINT NOT NULL, status TEXT NOT NULL,          -- applied|duplicate|rejected|deferred
  error_code TEXT, error_detail TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_at TIMESTAMPTZ,
  UNIQUE (business_id, device_id, operation_id)               -- the idempotency guarantee
);

CREATE TABLE change_log (
  seq BIGSERIAL PRIMARY KEY, business_id UUID NOT NULL, stream TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, op TEXT NOT NULL,
  version INTEGER NOT NULL, payload JSONB NOT NULL,
  origin_device_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_change_pull ON change_log (business_id, stream, seq);

CREATE TABLE sync_dead_letter (LIKE sync_operation INCLUDING ALL);
CREATE TABLE conflict_log (
  id BIGSERIAL PRIMARY KEY, business_id UUID NOT NULL, entity_type TEXT, entity_id TEXT,
  rule TEXT NOT NULL, winner JSONB, loser JSONB, resolved_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID, reviewed_at TIMESTAMPTZ
);
CREATE TABLE device (
  id UUID PRIMARY KEY, business_id UUID NOT NULL, installation_id TEXT NOT NULL,
  machine_fingerprint TEXT, public_key TEXT, app_version TEXT, schema_version INT,
  status TEXT NOT NULL DEFAULT 'active',        -- active|suspended|revoked
  last_seen_at TIMESTAMPTZ, last_push_seq BIGINT, last_pull_seq BIGINT,
  outbox_depth INT, clock_skew_ms INT
);
CREATE TABLE entitlement (
  business_id UUID PRIMARY KEY, plan TEXT NOT NULL, status TEXT NOT NULL,
  device_limit INT NOT NULL, valid_until DATE NOT NULL,
  offline_grace_days INT NOT NULL DEFAULT 14   -- FR-102
);
```

**RLS** on every tenant table:

```sql
ALTER TABLE sale ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_tenant ON sale USING (business_id = current_setting('app.business_id')::uuid);
-- API sets it per transaction: SET LOCAL app.business_id = $1;
```

**Partitioning** (monthly `RANGE` on the business date) for `sale`, `sale_item`, `stock_movement`, `journal_line`, `audit_log`, `change_log`, `sync_operation`. At 10k businesses × 1k txn/day these tables reach 10⁸–10⁹ rows/year; monthly partitions keep index depth and vacuum cost bounded, and let old partitions move to cheaper storage. Partitions are created 3 months ahead by a scheduled job — a missing partition is a hard outage, so it is monitored, not assumed.

**Least privilege:** the API role has no `DELETE` on `audit_log`, `journal_entry`, `journal_line`, `stock_movement`, `sale`, `sale_item`; an append-only trigger blocks `UPDATE` on `audit_log`. Reports connect via a read-only role against the replica.

**Aggregates** refreshed by workers: `daily_sales_summary`, `daily_payment_summary`, `product_sales_daily`, `stock_valuation_snapshot` (nightly), `party_outstanding`. Dashboards and long-range reports read these; nothing user-facing scans `sale_item` across years.

---

## 12. Migrations

**SQLite:** hand-written, forward-only, numbered SQL files (`0001_init.sql` … `0042_add_price_list.sql`) executed in a transaction with `PRAGMA user_version` as the version marker. No ORM migration tool — the desktop needs exact control over table rebuilds (SQLite's limited `ALTER TABLE` means "add a column" is fine but "change a constraint" is a 12-step table rebuild, and that must be explicit and tested, not generated).

```text
startup → PRAGMA quick_check → backup DB → apply pending migrations in one txn
        → PRAGMA foreign_key_check → PRAGMA user_version = N → verify row counts
        → on failure: restore the pre-migration backup, log, offer support bundle
```

Rules: additive changes only whenever possible (new nullable column, new table, new index); a destructive change ships as two releases (write both, then stop reading the old); every migration has an up-test on a **fixture database seeded with realistic data**, not an empty one; migration runtime is measured against a 500k-transaction fixture in CI, because a 40-second migration on a shop's HDD at 9 a.m. is an outage.

**Postgres:** `golang-migrate` numbered SQL files, expand/contract only — deploy adds nullable columns and backfills in batches, code moves, a later release drops. Migrations run as a gate before the new image receives traffic; long index builds use `CREATE INDEX CONCURRENTLY` outside the gate.

**Compatibility (FR-105):** the handshake compares `protocol`, `schema_version`, `app_version`. Server supports protocol N and N−1; a device below that receives `426 UPGRADE_REQUIRED` with a download link and continues billing offline. A device *ahead* of the server (staged rollout) must only send fields the server ignores gracefully — enforced by a contract test that runs the previous server release against the new client payloads.

---

## 13. Hardware layer

### 13.1 Interfaces

```ts
interface ReceiptPrinter {
  readonly id: string; readonly caps: { widthChars: 32|42|48; cutter: boolean; drawerKick: boolean; qr: boolean };
  print(doc: PrintDoc): Promise<PrintResult>;
  status(): Promise<{ online: boolean; paper: 'ok'|'low'|'out'; cover: 'closed'|'open' }>;
}
interface Scanner { on(e:'scan', cb:(s:{code:string; symbology?:string; source:string})=>void): void; }
interface CashDrawer { open(): Promise<void>; }
interface Scale { read(): Promise<{ qtyMilli: MilliQty; stable: boolean; uom: string }>;
                  stream(cb:(r:Reading)=>void): Unsubscribe; }
interface LabelPrinter { printLabels(labels: LabelDoc[]): Promise<void>; }
interface CustomerDisplay { show(lines: string[]): Promise<void>; }
```

Adapters: `EscPosUsbAdapter`, `EscPosNetworkAdapter` (TCP 9100), `WindowsSpoolerAdapter` (raw bytes to a named printer), `PdfA4Adapter`, `KeyboardWedgeScanner`, `HidScanner`, `SerialScaleAdapter`, `SimulatorAdapter` (every interface has one — used in CI and demos).

### 13.2 Receipt rendering

`PrintDoc` is a **structured, stored** representation (header, party block, line table, totals, tax summary, tender block, footer, QR), rendered by a width-aware layout engine into ESC/POS bytes. It is generated once at sale time and persisted in `print_job.payload_blob`, so a reprint two weeks later is byte-identical even if the product was renamed or the template changed (FR-100). Command set: `ESC @` init, `ESC ! n` font, `ESC a n` align, `GS ! n` size, `GS v 0` bitmap for the logo, `GS ( k` for the e-invoice QR, `GS V 66 0` cut, `DLE DC4 1 m t` or `ESC p 0 25 250` for the drawer kick.

### 13.3 Scanner handling (the detail that makes or breaks POS feel)

Keyboard-wedge scanners type characters and press Enter. The renderer keeps a global buffer:

```text
keydown → if printable: push(char), record t
          if Enter and buffer.length >= 4 and (t_last - t_first) < 120ms → treat as SCAN
          if inter-key gap > 60ms → flush buffer as human typing
```

Scans are dispatched to the active POS handler regardless of DOM focus, except when a text field is explicitly in "manual entry" mode. Weight/price-embedded EAN-13 (prefix 20–29) is parsed per configuration:

```text
2 F IIIII WWWWW C     F=flag, I=item code, W=weight(g) or price(paise), C=check digit
→ resolve product by item code, set qty or line amount from the embedded field (FR-101)
```

### 13.4 Scale

`serialport` at the configured baud/parity; per-vendor line parsers (e.g. `ST,GS,+  1.250kg`) behind `SerialScaleAdapter`. A reading is accepted only when `stable` is asserted (or the value is unchanged for 3 consecutive frames), with tare support and a manual-entry fallback that is always available — a broken scale must never stop billing.

### 13.5 Failure policy

Every hardware call is (a) **after** the SQLite commit, (b) time-boxed, (c) non-throwing into the sale path. Failures surface as a dismissible banner plus a retry action, and are logged with device id and error. Cash drawer failures do not even generate a user error unless the tender was cash. This is the mechanical implementation of NFR-012 / §28.

---

## 14. Reports

Definition-driven, not hand-coded per report:

```ts
interface ReportDefinition {
  id: 'daily_sales' | 'trial_balance' | 'gst_summary' | 'stock_valuation' | ...;
  params: ZodSchema;                 // dates, branch, warehouse, party, grouping
  source: 'local' | 'cloud' | 'auto';
  sql: (p) => { text: string; args: unknown[] };   // or a builder for the pivot reports
  columns: ColumnSpec[];             // type-aware: paise render as ₹, milli as qty
  totals: TotalSpec[];
  exports: ('csv'|'xlsx'|'pdf')[];
}
```

`source: 'auto'` picks local when the requested range is inside the local retention window (FR-103) and cloud otherwise, telling the user which was used. Heavy reports run in the `reports` utility process against a read-only SQLite connection, stream results, and can be cancelled. Financial reports derive **only** from `journal_line` / `stock_movement` / `sale` — never from a UI-computed number (§25). Two reports validate the rest of the system and must exist from day one: **Trial Balance** (must always balance) and **Stock Reconciliation** (ledger replay vs projection, cross-device oversells).

---

## 15. Authentication and RBAC

### 15.1 Tokens

| Token | Lifetime | Storage |
|---|---|---|
| Access (JWT: `sub`, `org`, `business`, `branch`, `device`, `roles`, `perm_ver`) | 15 min | memory in main only |
| Refresh (opaque, device-bound, rotating, reuse-detected) | 60 days | OS credential store (`safeStorage`) |
| Offline credential (Argon2id hash of password/PIN + per-user salt) | until `max_offline_days` | SQLite `user_credential` |
| Device key pair | install lifetime | private key in OS credential store |

Refresh-token reuse (a stolen copy replayed) revokes the whole chain and forces re-login — standard rotation detection, and cheap to implement.

### 15.2 Offline login (FR-004 / FR-097)

```text
online  : POST /auth/login → tokens + user set + permission snapshot + offline_policy
          → cache Argon2id hash per user, store permission snapshot with perm_ver
offline : verify password/PIN against the cached hash (constant-time)
          → allow if (now - last_online_auth) <= max_offline_days (default 30)
          → else: blocked with "connect once to continue" (billing still allowed for
            an already-open session so a shift is never stranded mid-bill)
switch  : 4–6 digit PIN, rate-limited (5 attempts → 5 min lockout), audited
revoke  : next successful pull applies control-stream revocation → lock app;
          device revocation → drain outbox, then wipe business data, keep the log
```

### 15.3 Permission model (FR-012 clarification)

```ts
type Permission = `${Resource}.${Action}`;     // 'sales.create', 'inventory.adjust', 'reports.financial'
type Grant = { permission: Permission; limit?: { maxDiscountBp?: number; maxRefundPaise?: number;
                                                 backdateDays?: number } };
```

Roles are grant sets; users hold roles plus per-user overrides. Presets ship with concrete defaults matching PRD §35 (no "Optional" in shipped data — a preset either grants it or does not). Enforcement is **always in the main process** against the server-issued snapshot; the renderer's copy drives UI affordances only. Permission changes bump `perm_ver`, invalidating cached snapshots on both sides.

---

## 16. Audit architecture

Every mutating IPC method with `audit: true` writes an `audit_log` row inside the business transaction:

```ts
hash = sha256(canonicalJson({
  seq, business_id, device_id, user_id, action, entity_type, entity_id,
  before, after, occurred_at, prev_hash
}));
```

`prev_hash` is the previous row's `hash` for that `(business_id, device_id)` chain; `seq` is gap-free per device. Append-only triggers block `UPDATE`/`DELETE`. The server verifies the chain on ingest and raises a tamper alert on a break — which is the difference between an audit log and a log file. Diffs store field-level before/after, redacting nothing financial and never storing passwords, tokens or full card data. Audit rows sync as part of their parent operation, so the trail arrives with the document rather than separately.

---

## 17. Error taxonomy

```ts
type ErrorClass = 'validation' | 'permission' | 'business_rule' | 'conflict'
                | 'hardware' | 'transient' | 'permanent' | 'integrity';
```

| Code | Class | Behaviour |
|---|---|---|
| `VALIDATION_FAILED` | validation | field-level messages in the UI |
| `PERMISSION_DENIED` | permission | offer manager override where FR-098 applies |
| `REGISTER_NOT_OPEN`, `STOCK_INSUFFICIENT`, `CREDIT_LIMIT_EXCEEDED`, `PERIOD_LOCKED`, `RETURN_QTY_EXCEEDED` | business_rule | actionable message + the override path if the user has the grant |
| `LEDGER_IMBALANCE`, `STOCK_PROJECTION_DRIFT`, `AUDIT_CHAIN_BROKEN`, `DB_CORRUPT` | integrity | abort the transaction, alert, force Diagnostics; never "best effort" past these |
| `PRINTER_OFFLINE`, `DRAWER_FAILED`, `SCALE_UNSTABLE` | hardware | banner only; never blocks a sale |
| `NETWORK_UNREACHABLE`, `SERVER_BUSY`, `DEPENDENCY_MISSING` | transient | retry with backoff, silent |
| `TOTAL_MISMATCH`, `SCHEMA_REJECTED`, `UPGRADE_REQUIRED` | permanent | dead-letter + support/alert path, device keeps working |

Rule: **integrity errors fail loudly and stop the operation; hardware and transport errors never do.** Getting this inversion wrong in either direction is how POS software loses either money or trust.

---

## 18. Performance plan (NFR-001, NFR-021)

| Path | Budget | Implementation |
|---|---|---|
| Barcode → product | < 30 ms | `ux_barcode` unique index, prepared statement, in-memory LRU of the 500 hottest SKUs |
| Product prefix search | < 60 ms | `ix_product_active(business_id, is_active, name_norm)` + FTS5 for token search, `LIMIT 20`, debounced 120 ms |
| Cart recalculation | < 10 ms | pure in-memory engine, no DB round-trip per keystroke |
| `sales.complete` | < 250 ms p95 | one transaction, ~12 prepared inserts, no network, no print |
| Dashboard | < 300 ms | pre-aggregated `daily_*` tables updated in the sale transaction |
| Cold start to billable | < 3 s | lazy-load non-POS routes, defer sync/hardware discovery until after first paint, prepared-statement warmup on the POS queries only |

All statements are prepared once and cached. `EXPLAIN QUERY PLAN` assertions in tests fail the build if a POS-path query degrades to a table scan — a regression here is silent and only shows up on a shop's 50,000-row product table.

---

## 19. Testing strategy

| Layer | Approach |
|---|---|
| **Domain engines** | Golden vectors (§3.2) + **property tests**: `Σdebit = Σcredit` for every generated transaction; `Σapportion = total`; `replay(movements) = projection`; `Σallocations ≤ payment`; inclusive→exclusive→inclusive round-trips within 1 paise. The Go port executes the same fixture files; a nightly differential fuzz run compares TS and Go outputs |
| **Repositories** | Against a real SQLite file (never a mock), with FK and trigger enforcement on; assert append-only triggers actually abort |
| **Application services** | In-process, real DB, simulated hardware; assert the exact §8 commit ordering and that nothing after COMMIT can roll back |
| **IPC contract** | Every method: schema rejection of malformed input, permission denial, rate limit; a test asserting the preload exposes *exactly* the contract's method set (catches accidental surface growth) |
| **Sync** | Deterministic simulation: two virtual devices + an in-memory server, with fault injection (drop, duplicate, reorder, delay, partition, 500s, clock skew). Asserted invariants: no loss, no duplicates, convergence, deterministic conflict outcomes |
| **Crash safety** | `taskkill /f` in a loop at randomized points inside the commit; after each, assert: no partial sale, no orphan movement/journal/outbox row, no consumed-but-unused document number, DB passes `quick_check` |
| **E2E** | Playwright + Electron over the golden flow (§8 of the PRD) with simulated scanner/printer/drawer; keyboard-only run (F2…F9) as a first-class test |
| **Compliance** | Tax scenario suite reviewed by a practising CA: intra/inter, B2B/B2C, composition, exempt mixes, credit notes, round-off, HSN summary totals tied back to invoice sums |
| **Soak/scale** | 200k sales, 20k SKUs, 50k customers → re-measure §18 budgets and migration runtime |
| **The §37 scenario** | Automated nightly, extended with the additions in `muneem-prd-review.md` §6 (double-submit, kill -9, clock jump, two-terminal last-unit, disk full) |

CI gates on: typecheck, lint, the money-column schema lint, all unit/property/contract tests, migration-up on the seeded fixture, and the `EXPLAIN QUERY PLAN` assertions.

---

## 20. Build order (mapped to PRD §43)

| Stage | Deliverable | Exit criterion |
|---|---|---|
| 0 | Monorepo, `@muneem/domain` + `@muneem/contracts`, money kernel, GST engine with golden vectors, Go port of money/GST, CI | GST golden suite green in **both** TS and Go; `divRound` property tests pass |
| 1 | Electron shell, generated preload, IPC gateway, SQLite + migrator, auth (online + offline), business/branch/terminal setup, device registration | A user can install, register a device, log in, and log in again with the network unplugged |
| 2 | Products/barcodes/UOM/price lists, import wizard, search | 5,000 SKUs imported; barcode lookup < 30 ms measured |
| 3 | POS: cart, discounts, GST, tenders, sessions, numbering, the §8 commit, receipt print, drawer | Golden flow end-to-end offline; kill -9 suite green |
| 4 | Inventory: movements, projections, costing, adjustments, low stock | `replay = projection` property test green; valuation report ties to inventory account |
| 5 | Purchases, suppliers, expenses, payments + allocation, customer credit | Party ledgers reconcile to the control accounts |
| 6 | Accounting: COA seed, posting rules, periods, Trial Balance, P&L, Balance Sheet | Trial balance balances on the full soak dataset |
| 7 | Sync: outbox, push, pull, hydration, dead-letter, status UI, Go cloud ingest with verification | Deterministic simulation suite green; §37 scenario green |
| 8 | Reports + exports, dashboard, notifications, audit chain verification, backup/restore, auto-update | Restore-to-new-device produces a byte-identical trial balance |
| 9 | Hardening: soak, chaos, CA compliance review, pilot with 5 real shops | 30 days, zero lost transactions, zero unexplained imbalances |

Stage 7 must not be pushed later, despite the pull to ship POS first: the outbox writes are inside the Stage 3 commit, and retrofitting them means rewriting the transaction that everything else depends on (Constraint 8).
