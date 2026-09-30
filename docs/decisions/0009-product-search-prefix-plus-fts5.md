# ADR-0009 — Product search: `name_norm` prefix index plus a repository-maintained FTS5 table

**Status:** Accepted, 2026-09-30

## Context
Cashiers type the first letters of a product name; FTS5 is poor at one- or two-letter prefixes but good at matching a
word in the middle of a name. FR-018 also asks for search by SKU, HSN and brand. Many shops name products in Hindi or
other Indic scripts, and the LLD only says `name_norm` is "lowercased, unaccented".

## Decision
- `products.search` tries, in order: exact barcode, exact SKU, `name_norm` prefix via `ix_product_active`, then FTS5
  token match to fill the remaining slots.
- `product_fts(product_id, business_id, name, sku, hsn_code, brand_name)` uses `unicode61 remove_diacritics 2`. It is a
  plain FTS5 table written by the product repository in the same transaction, not by triggers, because `brand_name`
  is copied from `brand` and a brand rename must re-index that brand's products.
- `normalizeName` (`@muneem/domain`): NFKC, lowercase, remove combining marks **only after a Latin letter**, collapse
  whitespace. In Indic scripts the combining marks are vowel signs and viramas; removing them would change the word.

- FTS5 deletes cheaply only by rowid, so `product_search_key` gives each product a stable integer key used as its
  `product_fts` rowid. Deleting by the unindexed `product_id` column made each save scan the whole index (5,000 products
  took 5.7 s instead of 2.2 s, growing quadratically).

## Consequences
- The FTS row can drift from `product` only if a write bypasses the repository; tests cover create, update,
  deactivate and brand rename.
- Latin accents are ignored for both prefix and token search; Indic text is matched as typed.
