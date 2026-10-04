-- 0018_daily_summaries — Stage 8e (FR-072, LLD §18): the dashboard's daily aggregates. Device-local and never synced.
-- Triggers keep them in the same transaction as the document, whether it was made here or pulled (ADR-0040);
-- the v_* views are their definition, used for the backfill below, rebuilds and the drift check.
-- A credit note counts on its own date (ADR-0046 as built); a cancelled payment or expense leaves its own day.

CREATE TABLE daily_sales_summary (
  business_id          TEXT NOT NULL,
  branch_id            TEXT NOT NULL,
  day                  TEXT NOT NULL,
  sale_count           INTEGER NOT NULL DEFAULT 0,
  sale_taxable_paise   INTEGER NOT NULL DEFAULT 0,
  sale_tax_paise       INTEGER NOT NULL DEFAULT 0,
  sale_total_paise     INTEGER NOT NULL DEFAULT 0,
  sale_cogs_paise      INTEGER NOT NULL DEFAULT 0,
  return_count         INTEGER NOT NULL DEFAULT 0,
  return_taxable_paise INTEGER NOT NULL DEFAULT 0,
  return_tax_paise     INTEGER NOT NULL DEFAULT 0,
  return_total_paise   INTEGER NOT NULL DEFAULT 0,
  return_cost_paise    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day, branch_id)
) WITHOUT ROWID;

-- flow: sale (tender net of change), refund (credit note, by refund method; the credited part as 'credit'),
-- receipt (customer payment), payment (supplier payment), expense.
CREATE TABLE daily_payment_summary (
  business_id  TEXT NOT NULL,
  branch_id    TEXT NOT NULL,
  day          TEXT NOT NULL,
  flow         TEXT NOT NULL CHECK (flow IN ('sale','refund','receipt','payment','expense')),
  method       TEXT NOT NULL,
  doc_count    INTEGER NOT NULL DEFAULT 0,
  amount_paise INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day, branch_id, flow, method)
) WITHOUT ROWID;

CREATE TABLE product_sales_daily (
  business_id            TEXT NOT NULL,
  branch_id              TEXT NOT NULL,
  day                    TEXT NOT NULL,
  product_id             TEXT NOT NULL,
  sold_qty_milli         INTEGER NOT NULL DEFAULT 0,
  sold_taxable_paise     INTEGER NOT NULL DEFAULT 0,
  sold_cogs_paise        INTEGER NOT NULL DEFAULT 0,
  returned_qty_milli     INTEGER NOT NULL DEFAULT 0,
  returned_taxable_paise INTEGER NOT NULL DEFAULT 0,
  returned_cost_paise    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day, product_id, branch_id)
) WITHOUT ROWID;

CREATE VIEW v_daily_sales_summary AS
SELECT business_id, branch_id, day, SUM(sc) AS sale_count, SUM(st) AS sale_taxable_paise, SUM(sx) AS sale_tax_paise, SUM(stot) AS sale_total_paise,
  SUM(scogs) AS sale_cogs_paise, SUM(rc) AS return_count, SUM(rt) AS return_taxable_paise, SUM(rx) AS return_tax_paise, SUM(rtot) AS return_total_paise,
  SUM(rcost) AS return_cost_paise
FROM (
  SELECT business_id, branch_id, doc_date AS day, 1 AS sc, taxable_paise AS st, cgst_paise + sgst_paise + igst_paise + cess_paise AS sx, total_paise AS stot,
    cogs_paise AS scogs, 0 AS rc, 0 AS rt, 0 AS rx, 0 AS rtot, 0 AS rcost
  FROM sale WHERE status = 'posted'
  UNION ALL
  SELECT business_id, branch_id, doc_date, 0, 0, 0, 0, 0, 1, taxable_paise, cgst_paise + sgst_paise + igst_paise + cess_paise, total_paise, cost_paise
  FROM credit_note WHERE status = 'posted')
GROUP BY business_id, branch_id, day;

CREATE VIEW v_daily_payment_summary AS
SELECT business_id, branch_id, day, flow, method, COUNT(*) AS doc_count, SUM(amount) AS amount_paise
FROM (
  SELECT s.business_id, s.branch_id, s.doc_date AS day, 'sale' AS flow, t.method, t.amount_paise - t.change_paise AS amount
  FROM sale_tender t JOIN sale s ON s.id = t.sale_id WHERE s.status = 'posted'
  UNION ALL
  SELECT business_id, branch_id, doc_date, 'refund', refund_method, refund_paise FROM credit_note WHERE status = 'posted' AND refund_paise > 0
  UNION ALL
  SELECT business_id, branch_id, doc_date, 'refund', 'credit', credit_paise FROM credit_note WHERE status = 'posted' AND credit_paise > 0
  UNION ALL
  SELECT business_id, branch_id, payment_date, CASE direction WHEN 'in' THEN 'receipt' ELSE 'payment' END, method, amount_paise FROM payment WHERE status = 'posted'
  UNION ALL
  SELECT business_id, branch_id, expense_date, 'expense', method, total_paise FROM expense WHERE status = 'posted')
GROUP BY business_id, branch_id, day, flow, method;

CREATE VIEW v_product_sales_daily AS
SELECT business_id, branch_id, day, product_id, SUM(sq) AS sold_qty_milli, SUM(st) AS sold_taxable_paise, SUM(sc) AS sold_cogs_paise,
  SUM(rq) AS returned_qty_milli, SUM(rt) AS returned_taxable_paise, SUM(rc) AS returned_cost_paise
FROM (
  SELECT s.business_id, s.branch_id, s.doc_date AS day, i.product_id, i.base_qty_milli AS sq, i.taxable_paise AS st, i.cogs_paise AS sc, 0 AS rq, 0 AS rt, 0 AS rc
  FROM sale_item i JOIN sale s ON s.id = i.sale_id WHERE s.status = 'posted'
  UNION ALL
  SELECT n.business_id, n.branch_id, n.doc_date, i.product_id, 0, 0, 0, i.base_qty_milli, i.taxable_paise, i.cost_paise
  FROM credit_note_item i JOIN credit_note n ON n.id = i.credit_note_id WHERE n.status = 'posted')
GROUP BY business_id, branch_id, day, product_id;

INSERT INTO daily_sales_summary SELECT * FROM v_daily_sales_summary;
INSERT INTO daily_payment_summary SELECT * FROM v_daily_payment_summary;
INSERT INTO product_sales_daily SELECT * FROM v_product_sales_daily;

CREATE TRIGGER trg_dss_sale AFTER INSERT ON sale WHEN NEW.status = 'posted' BEGIN
  INSERT INTO daily_sales_summary (business_id, branch_id, day, sale_count, sale_taxable_paise, sale_tax_paise, sale_total_paise, sale_cogs_paise)
  VALUES (NEW.business_id, NEW.branch_id, NEW.doc_date, 1, NEW.taxable_paise, NEW.cgst_paise + NEW.sgst_paise + NEW.igst_paise + NEW.cess_paise, NEW.total_paise, NEW.cogs_paise)
  ON CONFLICT (business_id, day, branch_id) DO UPDATE SET sale_count = sale_count + 1, sale_taxable_paise = sale_taxable_paise + excluded.sale_taxable_paise,
    sale_tax_paise = sale_tax_paise + excluded.sale_tax_paise, sale_total_paise = sale_total_paise + excluded.sale_total_paise,
    sale_cogs_paise = sale_cogs_paise + excluded.sale_cogs_paise;
END;

CREATE TRIGGER trg_dss_credit_note AFTER INSERT ON credit_note WHEN NEW.status = 'posted' BEGIN
  INSERT INTO daily_sales_summary (business_id, branch_id, day, return_count, return_taxable_paise, return_tax_paise, return_total_paise, return_cost_paise)
  VALUES (NEW.business_id, NEW.branch_id, NEW.doc_date, 1, NEW.taxable_paise, NEW.cgst_paise + NEW.sgst_paise + NEW.igst_paise + NEW.cess_paise, NEW.total_paise, NEW.cost_paise)
  ON CONFLICT (business_id, day, branch_id) DO UPDATE SET return_count = return_count + 1, return_taxable_paise = return_taxable_paise + excluded.return_taxable_paise,
    return_tax_paise = return_tax_paise + excluded.return_tax_paise, return_total_paise = return_total_paise + excluded.return_total_paise,
    return_cost_paise = return_cost_paise + excluded.return_cost_paise;
  INSERT INTO daily_payment_summary (business_id, branch_id, day, flow, method, doc_count, amount_paise)
  SELECT NEW.business_id, NEW.branch_id, NEW.doc_date, 'refund', m, 1, a FROM (SELECT NEW.refund_method AS m, NEW.refund_paise AS a UNION ALL SELECT 'credit', NEW.credit_paise) WHERE a > 0
  ON CONFLICT (business_id, day, branch_id, flow, method) DO UPDATE SET doc_count = doc_count + 1, amount_paise = amount_paise + excluded.amount_paise;
END;

CREATE TRIGGER trg_dps_sale_tender AFTER INSERT ON sale_tender BEGIN
  INSERT INTO daily_payment_summary (business_id, branch_id, day, flow, method, doc_count, amount_paise)
  SELECT s.business_id, s.branch_id, s.doc_date, 'sale', NEW.method, 1, NEW.amount_paise - NEW.change_paise FROM sale s WHERE s.id = NEW.sale_id AND s.status = 'posted'
  ON CONFLICT (business_id, day, branch_id, flow, method) DO UPDATE SET doc_count = doc_count + 1, amount_paise = amount_paise + excluded.amount_paise;
END;

CREATE TRIGGER trg_dps_payment AFTER INSERT ON payment WHEN NEW.status = 'posted' BEGIN
  INSERT INTO daily_payment_summary (business_id, branch_id, day, flow, method, doc_count, amount_paise)
  VALUES (NEW.business_id, NEW.branch_id, NEW.payment_date, CASE NEW.direction WHEN 'in' THEN 'receipt' ELSE 'payment' END, NEW.method, 1, NEW.amount_paise)
  ON CONFLICT (business_id, day, branch_id, flow, method) DO UPDATE SET doc_count = doc_count + 1, amount_paise = amount_paise + excluded.amount_paise;
END;

CREATE TRIGGER trg_dps_payment_cancel AFTER UPDATE OF status ON payment WHEN OLD.status = 'posted' AND NEW.status = 'cancelled' BEGIN
  UPDATE daily_payment_summary SET doc_count = doc_count - 1, amount_paise = amount_paise - OLD.amount_paise
  WHERE business_id = OLD.business_id AND branch_id = OLD.branch_id AND day = OLD.payment_date
    AND flow = CASE OLD.direction WHEN 'in' THEN 'receipt' ELSE 'payment' END AND method = OLD.method;
  DELETE FROM daily_payment_summary WHERE business_id = OLD.business_id AND branch_id = OLD.branch_id AND day = OLD.payment_date AND doc_count = 0 AND amount_paise = 0;
END;

CREATE TRIGGER trg_dps_expense AFTER INSERT ON expense WHEN NEW.status = 'posted' BEGIN
  INSERT INTO daily_payment_summary (business_id, branch_id, day, flow, method, doc_count, amount_paise)
  VALUES (NEW.business_id, NEW.branch_id, NEW.expense_date, 'expense', NEW.method, 1, NEW.total_paise)
  ON CONFLICT (business_id, day, branch_id, flow, method) DO UPDATE SET doc_count = doc_count + 1, amount_paise = amount_paise + excluded.amount_paise;
END;

CREATE TRIGGER trg_dps_expense_cancel AFTER UPDATE OF status ON expense WHEN OLD.status = 'posted' AND NEW.status = 'cancelled' BEGIN
  UPDATE daily_payment_summary SET doc_count = doc_count - 1, amount_paise = amount_paise - OLD.total_paise
  WHERE business_id = OLD.business_id AND branch_id = OLD.branch_id AND day = OLD.expense_date AND flow = 'expense' AND method = OLD.method;
  DELETE FROM daily_payment_summary WHERE business_id = OLD.business_id AND branch_id = OLD.branch_id AND day = OLD.expense_date AND doc_count = 0 AND amount_paise = 0;
END;

CREATE TRIGGER trg_psd_sale_item AFTER INSERT ON sale_item BEGIN
  INSERT INTO product_sales_daily (business_id, branch_id, day, product_id, sold_qty_milli, sold_taxable_paise, sold_cogs_paise)
  SELECT s.business_id, s.branch_id, s.doc_date, NEW.product_id, NEW.base_qty_milli, NEW.taxable_paise, NEW.cogs_paise FROM sale s WHERE s.id = NEW.sale_id AND s.status = 'posted'
  ON CONFLICT (business_id, day, product_id, branch_id) DO UPDATE SET sold_qty_milli = sold_qty_milli + excluded.sold_qty_milli,
    sold_taxable_paise = sold_taxable_paise + excluded.sold_taxable_paise, sold_cogs_paise = sold_cogs_paise + excluded.sold_cogs_paise;
END;

CREATE TRIGGER trg_psd_credit_note_item AFTER INSERT ON credit_note_item BEGIN
  INSERT INTO product_sales_daily (business_id, branch_id, day, product_id, returned_qty_milli, returned_taxable_paise, returned_cost_paise)
  SELECT n.business_id, n.branch_id, n.doc_date, NEW.product_id, NEW.base_qty_milli, NEW.taxable_paise, NEW.cost_paise FROM credit_note n
  WHERE n.id = NEW.credit_note_id AND n.status = 'posted'
  ON CONFLICT (business_id, day, product_id, branch_id) DO UPDATE SET returned_qty_milli = returned_qty_milli + excluded.returned_qty_milli,
    returned_taxable_paise = returned_taxable_paise + excluded.returned_taxable_paise, returned_cost_paise = returned_cost_paise + excluded.returned_cost_paise;
END;
