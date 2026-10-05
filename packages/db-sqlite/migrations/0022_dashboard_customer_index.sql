-- 0022_dashboard_customer_index — the dashboard's "new customers in this period" count reads a date range off a
-- covering partial index instead of walking every customer of the business (LLD §18, query-plan gate).

CREATE INDEX ix_customer_created ON customer(business_id, created_at) WHERE deleted_at IS NULL;
