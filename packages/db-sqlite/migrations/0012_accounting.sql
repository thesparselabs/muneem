-- 0012_accounting — Stage 6 (LLD §2.4; ADR-0030–0034): chart of accounts, periods, journals and their balance cache.
-- A journal that does not balance, a line on both sides, a negative line, a posting to a group account and a second
-- journal for one document are impossible to store.

CREATE TABLE account (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES business(id),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  role         TEXT,
  parent_id    TEXT REFERENCES account(id),
  normal_side  TEXT NOT NULL CHECK (normal_side IN ('debit','credit')),
  is_group     INTEGER NOT NULL DEFAULT 0 CHECK (is_group IN (0,1)),
  is_system    INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  deleted_at TEXT,
  CHECK (normal_side = CASE WHEN type IN ('asset','expense') THEN 'debit' ELSE 'credit' END)
);
CREATE UNIQUE INDEX ux_account_code ON account(business_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_account_role ON account(business_id, role) WHERE role IS NOT NULL AND deleted_at IS NULL;
CREATE TRIGGER trg_account_system BEFORE UPDATE OF type, role, is_system, is_group ON account WHEN OLD.is_system = 1
  BEGIN SELECT RAISE(ABORT, 'a system account cannot be retyped'); END;
CREATE TRIGGER trg_account_system_delete BEFORE UPDATE OF deleted_at ON account WHEN OLD.is_system = 1 AND NEW.deleted_at IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'a system account cannot be deleted'); END;
CREATE TRIGGER trg_account_no_delete BEFORE DELETE ON account BEGIN SELECT RAISE(ABORT, 'accounts are never deleted'); END;

CREATE TABLE accounting_period (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES business(id),
  fy            TEXT NOT NULL,
  period_start  TEXT NOT NULL,
  period_end    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked')),
  locked_at TEXT, locked_by TEXT, unlock_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  UNIQUE (business_id, period_start),
  CHECK (period_end >= period_start)
);

CREATE TABLE journal_entry (
  id                 TEXT PRIMARY KEY,
  business_id        TEXT NOT NULL REFERENCES business(id),
  branch_id          TEXT REFERENCES branch(id),
  terminal_id        TEXT REFERENCES terminal(id),
  entry_no           TEXT NOT NULL,
  entry_date         TEXT NOT NULL,
  doc_date           TEXT NOT NULL,
  fy                 TEXT NOT NULL,
  period_id          TEXT NOT NULL REFERENCES accounting_period(id),
  source             TEXT NOT NULL CHECK (source IN
    ('sale','sale_return','purchase','purchase_return','receipt','payment','expense','stock_adjustment','transfer',
     'manual','opening','closing','round_off','write_off','register_close','cash_movement')),
  ref_type           TEXT,
  ref_id             TEXT,
  narration          TEXT,
  debit_total_paise  INTEGER NOT NULL,
  credit_total_paise INTEGER NOT NULL,
  is_reversal_of     TEXT REFERENCES journal_entry(id),
  late_posting       INTEGER NOT NULL DEFAULT 0 CHECK (late_posting IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL, device_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict')),
  CHECK (debit_total_paise = credit_total_paise AND debit_total_paise > 0),
  CHECK (late_posting = 0 OR entry_date > doc_date)
);
-- One journal per document, and at most one reversal of it (ADR-0030).
CREATE UNIQUE INDEX ux_je_ref ON journal_entry(business_id, source, ref_id, COALESCE(is_reversal_of, '')) WHERE ref_id IS NOT NULL;
CREATE UNIQUE INDEX ux_je_reversal ON journal_entry(is_reversal_of) WHERE is_reversal_of IS NOT NULL;
CREATE INDEX ix_je_date ON journal_entry(business_id, entry_date, id);
CREATE INDEX ix_je_period ON journal_entry(business_id, period_id);
CREATE INDEX ix_je_late ON journal_entry(business_id, late_posting) WHERE late_posting = 1;
CREATE TRIGGER trg_je_no_delete BEFORE DELETE ON journal_entry BEGIN SELECT RAISE(ABORT, 'journal_entry is append-only'); END;
CREATE TRIGGER trg_je_frozen BEFORE UPDATE OF
  id, business_id, branch_id, terminal_id, entry_no, entry_date, doc_date, fy, period_id, source, ref_type, ref_id, narration,
  debit_total_paise, credit_total_paise, is_reversal_of, late_posting
  ON journal_entry BEGIN SELECT RAISE(ABORT, 'journal_entry is append-only'); END;

CREATE TABLE journal_line (
  id           TEXT PRIMARY KEY,
  entry_id     TEXT NOT NULL REFERENCES journal_entry(id),
  business_id  TEXT NOT NULL,
  line_no      INTEGER NOT NULL,
  account_id   TEXT NOT NULL REFERENCES account(id),
  debit_paise  INTEGER NOT NULL DEFAULT 0,
  credit_paise INTEGER NOT NULL DEFAULT 0,
  party_type   TEXT CHECK (party_type IS NULL OR party_type IN ('customer','supplier')),
  party_id     TEXT,
  note         TEXT,
  UNIQUE (entry_id, line_no),
  CHECK (debit_paise >= 0 AND credit_paise >= 0),
  CHECK ((debit_paise = 0) <> (credit_paise = 0)),
  CHECK ((party_type IS NULL) = (party_id IS NULL))
);
CREATE INDEX ix_jl_account ON journal_line(business_id, account_id);
CREATE INDEX ix_jl_party ON journal_line(business_id, party_type, party_id) WHERE party_id IS NOT NULL;
CREATE TRIGGER trg_jl_group BEFORE INSERT ON journal_line WHEN (SELECT is_group FROM account WHERE id = NEW.account_id) = 1
  BEGIN SELECT RAISE(ABORT, 'a group account cannot be posted to'); END;
CREATE TRIGGER trg_jl_no_update BEFORE UPDATE ON journal_line BEGIN SELECT RAISE(ABORT, 'journal_line is append-only'); END;
CREATE TRIGGER trg_jl_no_delete BEFORE DELETE ON journal_line BEGIN SELECT RAISE(ABORT, 'journal_line is append-only'); END;

-- Cache of the journal lines per account and period; rebuildable at any time and never synced (ADR-0034).
CREATE TABLE account_balance (
  business_id  TEXT NOT NULL,
  account_id   TEXT NOT NULL REFERENCES account(id),
  period_id    TEXT NOT NULL REFERENCES accounting_period(id),
  debit_paise  INTEGER NOT NULL DEFAULT 0 CHECK (debit_paise >= 0),
  credit_paise INTEGER NOT NULL DEFAULT 0 CHECK (credit_paise >= 0),
  PRIMARY KEY (account_id, period_id)
);
CREATE INDEX ix_account_balance_period ON account_balance(business_id, period_id);
