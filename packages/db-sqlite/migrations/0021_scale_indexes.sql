-- 0021_scale_indexes — Stage 9f (500k sales): the dashboard's receivable and payable totals read one covering index
-- instead of every party entry row, the sync queue finds its unsent rows without walking every row it ever sent, and
-- the push heartbeat counts products below zero from a partial index of just those rows (9c).
CREATE INDEX ix_party_entry_amount ON party_ledger_entry(business_id, party_type, amount_paise);
CREATE INDEX ix_outbox_business_status ON sync_outbox(business_id, status, seq);
CREATE INDEX ix_stock_level_negative ON stock_level(business_id, qty_milli) WHERE qty_milli < 0;
