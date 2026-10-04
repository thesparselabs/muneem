-- 0013_accounting_indexes — Stage 6f: an account's lines can be found entry by entry, so a ledger page and a part-month
-- balance walk the journal by date and seek each entry's line for that account.

CREATE INDEX ix_jl_account_entry ON journal_line(account_id, entry_id, line_no);
