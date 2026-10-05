-- 0006 — typed daily aggregates for owner reports (Stage 8e, ADR-0046 as built; Stage 7 carry). The same three tables
-- as the device's migration 0018, plus each party's balance; projected from each applied operation in its push
-- transaction, so they move exactly once per document. A credit note counts on its own date.
CREATE TABLE daily_sales_summary (
  business_id          TEXT NOT NULL,
  branch_id            TEXT NOT NULL,
  day                  DATE NOT NULL,
  sale_count           BIGINT NOT NULL DEFAULT 0,
  sale_taxable_paise   BIGINT NOT NULL DEFAULT 0,
  sale_tax_paise       BIGINT NOT NULL DEFAULT 0,
  sale_total_paise     BIGINT NOT NULL DEFAULT 0,
  sale_cogs_paise      BIGINT NOT NULL DEFAULT 0,
  return_count         BIGINT NOT NULL DEFAULT 0,
  return_taxable_paise BIGINT NOT NULL DEFAULT 0,
  return_tax_paise     BIGINT NOT NULL DEFAULT 0,
  return_total_paise   BIGINT NOT NULL DEFAULT 0,
  return_cost_paise    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day, branch_id)
);

CREATE TABLE daily_payment_summary (
  business_id  TEXT NOT NULL,
  branch_id    TEXT NOT NULL,
  day          DATE NOT NULL,
  flow         TEXT NOT NULL CHECK (flow IN ('sale','refund','receipt','payment','expense')),
  method       TEXT NOT NULL,
  doc_count    BIGINT NOT NULL DEFAULT 0,
  amount_paise BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day, branch_id, flow, method)
);

CREATE TABLE product_sales_daily (
  business_id            TEXT NOT NULL,
  branch_id              TEXT NOT NULL,
  day                    DATE NOT NULL,
  product_id             TEXT NOT NULL,
  sold_qty_milli         BIGINT NOT NULL DEFAULT 0,
  sold_taxable_paise     BIGINT NOT NULL DEFAULT 0,
  sold_cogs_paise        BIGINT NOT NULL DEFAULT 0,
  returned_qty_milli     BIGINT NOT NULL DEFAULT 0,
  returned_taxable_paise BIGINT NOT NULL DEFAULT 0,
  returned_cost_paise    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day, product_id, branch_id)
);

CREATE TABLE party_outstanding (                   -- Σ of the party sub-ledger entries; positive = the party owes the business
  business_id   TEXT NOT NULL,
  party_type    TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id      TEXT NOT NULL,
  balance_paise BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, party_type, party_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_sales_summary, daily_payment_summary, product_sales_daily, party_outstanding TO muneem_api;
GRANT SELECT ON daily_sales_summary, daily_payment_summary, product_sales_daily, party_outstanding TO muneem_readonly;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['daily_sales_summary','daily_payment_summary','product_sales_daily','party_outstanding'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I TO muneem_api, muneem_readonly USING (business_id = current_setting(''app.business_id'', true)) WITH CHECK (business_id = current_setting(''app.business_id'', true))', t || '_tenant', t);
  END LOOP;
END $$;
