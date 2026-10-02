-- 0004_invoice_prefix — CGST Rule 46(b) caps invoice numbers at 16 characters (ADR-0014), so each terminal gets a
-- short prefix (1–4 of A-Z0-9, unique in the business) and numbers read PREFIX/2627/000123.

ALTER TABLE terminal ADD COLUMN invoice_prefix TEXT;

UPDATE terminal SET invoice_prefix = (
  SELECT 'T' || rn FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY created_at, id) AS rn FROM terminal
  ) numbered WHERE numbered.id = terminal.id
);

CREATE UNIQUE INDEX ux_terminal_invoice_prefix ON terminal(business_id, invoice_prefix);

-- Series created before this migration used the long branch/terminal prefix.
UPDATE doc_series SET prefix = (SELECT invoice_prefix FROM terminal WHERE terminal.id = doc_series.terminal_id)
  WHERE terminal_id IS NOT NULL;
