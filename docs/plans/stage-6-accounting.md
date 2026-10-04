# Stage 6 — Accounting: implementation plan

## Context

Stages 0–5 are merged (PR #1, #3, #4, #5, #6). Stage 6 (LLD §20) is "Accounting: COA seed, posting rules, periods,
Trial Balance, P&L, Balance Sheet"; exit criterion **the trial balance balances on the soak dataset**.

**What already exists:** Stages 4 and 5 store every amount the journal needs. They proved two sub-ledgers and
deferred their GL tie-outs to here:
- **Inventory:** Σ stock value = Σ movement values (ADR-0018).
- **Parties:** party entries = open items (ADR-0022).

**What the design gives:**
- the journal DDL (LLD §2.4);
- the chart of accounts seed (§5.1);
- the posting matrix (§5.2, "get a CA to sign it");
- posting rules as data (§5.3);
- late postings into locked periods (§5.4);
- year-end requirements (PRD review FR-096).

**What the design does not cover:**
- **Stage 5 postings:** landed cost, debit notes, write-offs, credit expenses, opening balances.
- **Tax accounts:** separate input/output accounts per tax head.
- **Accounts for each payment method.**
- **Cash moved in or out of the drawer without a document.**
- **A soak dataset:** none exists yet.

**Decisions (user, 2026-10-04):**
- **When journals are written:** in each document's own transaction (a `journal` step), so a document and its journal
  can never disagree. A one-time, idempotent **backfill** posts everything saved before Stage 6.
- **Year end:** monthly periods, lock and unlock, and late postings into the earliest open period with a review flag
  (LLD §5.4) are in. The Balance Sheet computes retained earnings from prior years' profit. The closing and opening
  journals are **deferred to Stage 8**.
- **Soak dataset:** a **deterministic, seeded generator** of a shop's months. CI runs about two weeks of activity;
  locally, one year (~100k sales).
- **Reports and screens in Stage 6:**
  - Trial Balance, Profit & Loss and Balance Sheet (date range, branch);
  - account ledger and day book;
  - cash book and bank book;
  - manual journals (with reversal).

Delivery as before: branch `feat/stage-6-accounting`, parts 6a–6f as commits. Each part's details are written into
this plan and reviewed before it is built, and each commit is green with CHANGELOG lines. Nothing is pushed until the
user reviews.

## Design (ADRs 0030–0034, written in 6a; ADR-0035 added in 6d)

| ADR | Decision |
|---|---|
| 0030 Journal and posting engine | **What is stored:** `journal_entry` and `journal_line` (LLD §2.4), append-only, with `account_balance` (account × period) as their cache. All three are written only by `postJournal`, in the document's transaction — the same pattern as `stock_level` (ADR-0018). **The engine:** posting rules are data in `@muneem/domain` (`buildJournal(rule, facts)` returns lines, or throws `LEDGER_IMBALANCE` before any write). **Database guards:** CHECKs make an unbalanced entry or a two-sided line impossible to store. **One journal per document** (`ux_je_ref`): a cancellation posts a reversal that points at the original, never an edit. **Numbering:** journals for documents carry the document's number; manual journals get `T1J/2627/00001` (ADR-0028's kind letters gain `J`). **Sync:** the journal travels in its document's outbox aggregate; manual journals are their own. |
| 0031 Chart of accounts and posting accounts | **Seeding:** LLD §5.1, seeded per business on first use, with `is_system` accounts that cannot be deleted or retyped. **Additions to §5.1:** one input and one output account per tax head (CGST, SGST/UTGST, IGST, Cess) for GST set-off; **3400 Opening Balance Equity**; **5470 Bad Debts** (ADR-0025); **5110 Purchase-return losses** (freight not refunded); **1199 Cash to classify**. **Which account a payment method uses:** sale tenders — cash → 1100, UPI/card/other → **1250 Clearing**; payments and expenses — cash → 1100, everything else → **1200 Bank**. Users may add non-system accounts under a group (a second bank, more expense heads). |
| 0032 Posting matrix as built | Every document's posting, written as a table for CA review (`docs/accounting/posting-matrix.md`): sale, purchase, debit note, purchase cancel, receipt, supplier payment, write-off, expense, opening stock, adjustment, stock take, cost correction, party opening, register variance, cash in/out. **Changes from LLD §5.2:** **customer receipts post wholly to 1300 AR.** An unallocated advance is then a credit balance on the customer, not 2400. The Balance Sheet *presents* customers with credit balances as "Advances from customers", so allocations made later need no reclassifying journals, and 1300 always equals Σ customer balances. **Manual cash in/out** from the drawer posts to **1199 Cash to classify**, with the reason as narration; the accountant reclassifies it by manual journal. A safe drop is cash to cash, so it posts nothing. |
| 0033 Posting dates, periods and late postings | **Posting dates:** each journal is posted on its document's date. Purchases use the **supplier bill date**, because that is the accrual date and the ITC period; this settles the Stage 5 carry-forward on bill FY versus entry FY. Cancellations post on the day of the cancel. **Periods and locking:** periods are calendar months per FY, made on demand, `open` or `locked`. Locking needs `accounting.manage`; unlocking is allowed with a reason and audited. **Late postings:** a document dated into a locked period posts into the **earliest open period after it**, flagged `late_posting` with both dates, and is listed for review (LLD §5.4). Nothing is rejected or silently moved. |
| 0034 Tie-outs, backfill and integrity | **The tie-outs** (the Stage 4 and 5 promises): balance(1400) = Σ stock value; balance(1300) = Σ customer balances; balance(2100) = −Σ supplier balances; input/output tax accounts = Σ of the documents' tax by head; and Σ `account_balance` = Σ journal lines (replay = projection). **The backfill** posts every unposted document in date order, in batches. It is idempotent per document through `ux_je_ref`, runs at start-up after migrating, and can be re-run from Diagnostics. **The integrity check** adds the journal replay, the tie-outs and "documents without a journal". Drift in `account_balance` is rebuilt; anything else is reported, never rewritten. |

## Schema — migration `0012_accounting`

- `account`: LLD §2.4, plus sync columns and `deleted_at`, with a partial unique index on `(business_id, code)`.
- `accounting_period`: `(business, fy, period_start, period_end, status open|locked, locked_at/by, unlock_reason)`;
  unique per business and start date.
- `journal_entry`: LLD §2.4, plus `posting_date`, `doc_date`, `late_posting`, `terminal_id` and sync columns. The
  balance CHECK, `ux_je_ref` (source + ref) and `is_reversal_of` are unique per original. Append-only.
- `journal_line`: LLD §2.4, append-only. Its CHECKs allow only one side per line and nothing below zero.
- `account_balance`: `(business, account, period, debit_paise, credit_paise)`. Cache only, never synced.
- `doc_series`: a `journal` kind.

## Existing code to reuse

- **Money and series:** `apportion`, `divRound`; `findOrCreateSeries` / `allocateDocNumber` with a new `J` kind
  letter.
- **The commit steps:** sale commit steps (ADR-0019/0026; the `journal` step goes after `party`). The purchase, debit
  note, payment, write-off, expense, inventory-document, opening and register-close transactions each gain one
  `postJournal` call.
- **Sub-ledger checks:** `stockValuation`, `reconcilePartiesDb` and `partyStatement` for the tie-outs.
- **Integrity:** `diagnostics.integrityCheck` and the 6-hourly timer; the kill -9 suite; the perf tests; the golden
  flows.

## IPC surface

`accounting.*`:
- **Chart of accounts:** `listAccounts`, `createAccount`, `updateAccount`.
- **Reports:** `getTrialBalance`, `getProfitAndLoss`, `getBalanceSheet`, `getLedger` (account, date range, paged),
  `getDayBook`, `getCashBook`, `getBankBook`.
- **Manual journals:** `postManualJournal`, `reverseJournal`.
- **Periods:** `getPeriods`, `lockPeriod`, `unlockPeriod`, `listLatePostings`.
- **Maintenance:** `postBacklog`, `rebuildBalances`.

Permissions:
- `accounting.view` and `reports.financial` to read;
- `accounting.create` for manual journals;
- `accounting.manage` for the chart of accounts, periods, the backlog and rebuilds.

## Parts (tests first; one commit each; details written and reviewed before each)

**6a — Engine, accounts, schema, ADRs.**
- The pure posting engine with properties: every rule balances for any document the generators can make; a reversal
  nets to zero.
- CoA seed and migration 0012 with its tests.
- ADRs 0030–0034, the posting-matrix document for CA review, this plan, build-stages (Stage 5 → merged in PR #6,
  Stage 6 → In progress), and LLD notes.

6a details (drafted 2026-10-04, for review before building):

- **Posting rules as data** (`@muneem/domain/accounting`, LLD §5.3).
  - **Rule shape:** a rule is a list of `{ side: 'dr' | 'cr', account: AccountRole, amount: (f) => paise, when?,
    party? }`.
  - **Building a journal:** `buildJournal(rule, facts)` evaluates the rule and drops zero lines. A **signed** amount
    (round-off) flips to the other side when negative, so no line ever carries a negative amount. It throws
    `LEDGER_IMBALANCE` unless Σ debit = Σ credit, and it is pure, so the same rule can run in the Go cloud later.
  - **Accounts are named by role,** never by code (`cash`, `clearing`, `bank`, `ar`, `ap`, `inventory`, `cogs`,
    `sales_goods`, `round_off`, `input_cgst` … `output_cess`, `shrinkage`, `inventory_gain`, `bad_debts`,
    `purchase_return_loss`, `opening_equity`, `cash_to_classify`, `cash_short`, `cash_over`). Expense categories name
    their account by code (5400…). The seed maps roles to codes, so a business can rename an account without breaking
    its postings.
  - **One fact type and one rule per posting** (all written in 6a; 6b only wires them to documents):
    - sale, purchase, debit note, receipt, supplier payment, write-off, expense;
    - opening stock, stock adjustment / stock take (loss and gain lines), cost correction;
    - party opening (each side for each party type), register variance, cash in/out.
  - **Reversal:** `reverse(lines)` swaps the sides, for cancellations and manual reversals.
  - **Payment-method accounts:** `tenderAccount(method)` (sale tenders) and `paymentAccount(method)` (payments and
    expenses) implement ADR-0031.
- **Properties** (fast-check, 500 runs each):
  - every rule balances for any facts its generator makes, and the generators obey the documents' own CHECKs (a
    sale's tenders + credit − change = total; a purchase's total = taxable + taxes + charges + round-off; a debit
    note's split);
  - a reversal plus its original nets every account to zero;
  - no built line is ever negative or two-sided.

  Unit tests pin each rule's lines to the posting matrix with worked numbers.
- **Chart of accounts seed** (`domain/accounting/chart.ts`, data only). These are LLD §5.1's groups and accounts plus
  ADR-0031's additions. Each account has a code, name, type, normal side, parent group, role and `is_system`.
  - **Groups** (1000/2000/3000/4000/5000) are header accounts that nothing posts to.
  - **Input GST:** 1510 CGST · 1520 SGST/UTGST · 1530 IGST · 1540 Cess.
  - **Output GST:** 2210 CGST · 2220 SGST/UTGST · 2230 IGST · 2240 Cess.
  - **Other additions:** 1199 Cash to classify, 3400 Opening Balance Equity, 5110 Purchase-return losses, 5470 Bad
    Debts.
  - **Seeding:** `ensureChartOfAccounts(db, businessId, actor)` seeds it on first use, like the catalog defaults, and
    is idempotent by code. Each seeded account is audited and queued for sync (`account`).
- **Migration `0012_accounting`:**
  - `account`;
  - `accounting_period`, with the monthly rows made on demand in 6c;
  - `journal_entry`:
    - **unique** `(business, source, ref_id, COALESCE(is_reversal_of, ''))` (the plan's `ux_je_ref`), so a document
      has one journal and at most one reversal;
    - balance CHECK;
    - append-only triggers except sync bookkeeping;
  - `journal_line`, append-only, with the one-side and non-negative CHECKs;
  - `account_balance`, a cache keyed by account and period.

  **Sources:** LLD §2.4's list plus `write_off`, `register_close` and `cash_movement`. A debit note is
  `purchase_return`, a party opening and opening stock are both `opening` (`ref_type` tells them apart), and a cost
  correction is `stock_adjustment`.

  **Migration tests:** an unbalanced entry is refused; a two-sided or negative line is refused; a second journal for
  the same document is refused but a reversal is allowed; nothing is updated or deleted.
- **Documents:**
  - **ADRs 0030–0034;**
  - **`docs/accounting/posting-matrix.md`:** for CA review — one table per document with Dr/Cr, account, amount, the
    worked example from the unit tests, and every choice that departs from LLD §5.2, marked;
  - **build-stages and LLD:** notes where the build differs (sources, tax accounts per head, 2400 not used for
    advances, additional accounts).
- **Not in 6a:** writing journals from documents (6b), periods and the backfill (6c), reports (6d).

**6b — Postings.** `postJournal` and the journal step in every document's transaction:
- sales (cash, split, credit), purchases, debit notes, purchase cancel;
- receipts, supplier payments, payment cancel, write-offs, expenses;
- opening stock, adjustments, stock take, cost corrections;
- party openings, register variance, cash in/out.

Each test checks that the journal balances, its accounts are right, and the tie-outs hold afterwards. The kill -9
suite checks that every sale has exactly one journal after the kills.

6b details (drafted 2026-10-04; the user asked to build straight after writing them):

- **`postJournal`** (db-sqlite, `repositories/journal.ts`) is the only writer of `journal_entry`, `journal_line` and
  `account_balance`, and runs inside the caller's transaction. Its input is `{ businessId, branchId?, terminalId?,
  source, refType, refId, entryNo?, docDate, narration, lines, reversalOf? }`, with lines from `buildJournal`. It:
  - resolves each line's role or code to an account id (an unknown one is an error);
  - finds or makes the open month for `docDate` (locks and late postings are 6c);
  - numbers the entry (below);
  - writes the header and lines;
  - adds each line to `account_balance`.

  A document with no lines (a zero variance) posts nothing. `reverseJournal(original, date)` posts the mirror image
  with `is_reversal_of`.
- **Entry numbers.** A document with a number keeps it (`T1/2627/000123`, `T1P/…`). A document without one —
  opening stock, adjustment, stock take, cost correction, party opening, write-off, register close, cash in/out —
  gets a `J` number from the terminal's journal series.
- **Cost corrections.** Each `cost_correction` movement gets its own journal (`stock_adjustment`, `ref_type
  cost_correction`, `ref_id` = the movement). One helper, `postCorrections(movements, date)`, is called wherever
  `postMovement` can make one: purchases, opening stock, adjustment and stock-take gains, debit notes and purchase
  cancels. The integrity check (6c) names any correction without a journal, so a missed call cannot hide.
- **Where each journal is written,** always in the document's own transaction:
  - **Sale:** a `journal` step after `party` (ADR-0019/0026 order: number → cost → document → stock → party → journal →
    receipt → record).
  - **Purchases, payments, write-offs and expenses:** inside their services' existing transactions.
  - **Cancels:** a purchase, payment or expense cancel posts the reversal, dated on the day of the cancel.
  - **Opening stock, adjustments and stock takes:** in `InventoryService.post`.
  - **Wrapped repository writes:** party openings (a replacement also reverses the old opening's journal), register
    close (variance) and cash in/out. Their repositories record the document themselves, so the service wraps each
    one in the same transaction.
- **The facts each journal gets:**

  | Document | Facts |
  |---|---|
  | Sale | the stored sale: takings by account, net of change; credit; taxable; tax by head; round-off; Σ line COGS |
  | Purchase | Σ landed value, claimable tax by head from the ITC lines, round-off, total |
  | Debit note | total, Σ landed value of the returned shares, ITC reversed by head, freight share kept (shares − refunded), round-off |
  | Expense | the category's account code |
  | Stock documents | their movements' values |
- **Sync.** Where the service records the document, the journal goes in the document's aggregate (sale, purchase, debit
  note, payment, write-off, expense, stock documents). Where the repository records it (party opening, register
  close, cash movement), the journal is a child outbox row that depends on the document's row.
- **Tie-outs** (`accountingTieOuts`, db-sqlite) are checked here in the tests; 6c wires them into the integrity check:
  - inventory: 1400 against the valuation;
  - customers: 1300 against Σ customer balances;
  - suppliers: 2100 against Σ supplier balances;
  - output and input tax by head against the documents;
  - Σ `account_balance` against Σ lines.
- **Tests,** one per document type (journal accounts and amounts as in the posting matrix, and every tie-out holding
  after):
  - a sale in cash, split, on credit and with round-off;
  - a purchase with freight and an ineligible line;
  - a debit note with freight kept, and one completing a full return;
  - a purchase cancel;
  - a receipt with an advance, a supplier payment, a cancelled payment;
  - a write-off;
  - cash and credit expenses, and a cancelled one;
  - opening stock;
  - adjustments and stock take, losses and gains;
  - a cost correction from selling before buying;
  - party openings of each side and a replaced opening;
  - register over and short;
  - cash in and out.

  Also: a failure part-way leaves no journal, and a repeated command posts nothing twice. The kill -9 suite adds:
  exactly one journal per sale, no orphan journals, balanced journals and the tie-outs after the kills.
- **Not in 6b:** locks and late postings, the backfill and the integrity check (6c); reports and manual journals (6d).

**6c — Periods, late postings, backfill, integrity.**
- Monthly periods, lock and unlock.
- A late posting into the earliest open period, with the flag and the review list.
- The backfill of pre-Stage-6 documents (idempotent, batched, safe to stop mid-way).
- The integrity check gains the journal replay, the tie-outs and unposted documents.

6c details (drafted 2026-10-04; built straight after, as asked):

- **Periods.**
  - **Calls:** `accounting.getPeriods` lists months with their status and journal count. `lockPeriod({ periodStart })`
    and `unlockPeriod({ periodStart, reason })` need `accounting.manage` and are audited.
  - **Only months that have ended can be locked.** Locking the current or a future month is refused, so there is
    always an open month after any locked one.
  - **Unlocking** needs a reason, which is stored on the period.
- **Late postings** (ADR-0033). `postJournal` checks the document's month.
  - **If it is locked,** the journal posts into the **earliest open month after it**, dated that month's first day,
    with `late_posting = 1`, `doc_date` kept, and a `journal.late_posting` audit row.
  - **Review list:** `accounting.listLatePostings` shows each late posting's document, both dates and the entry number.
  - **Reversals** of a late-posted journal follow the same rule.
- **Backfill** (ADR-0034).
  - **Finding the documents:** `unpostedDocuments(db, businessId)` lists every document that has no journal: sales,
    purchases, debit notes, payments, write-offs, expenses, stock documents, cost corrections, party openings, closed
    registers and cash in/out.
  - **Posting them:** `postBacklog` posts each one through the same builders as live posting, in batches of 200 per
    transaction, yielding between batches.
  - **Cancelled before Stage 6:** a purchase, payment, expense or party opening cancelled before Stage 6 gets its
    journal and then its reversal, dated the day it was cancelled.
  - **Safety:** it is idempotent and safe to stop mid-way.
  - **When it runs:** once per app run, when a session first has a business and a terminal, and on demand through
    `accounting.postBacklog`.
- **Integrity check.** `diagnostics.integrityCheck` gains `journals: 'ok' | 'healed' | 'mismatch' | 'not_run'`:
  - **Rebuilt:** `account_balance` drift against the journal lines is healed by `rebuildAccountBalances` →
    `healed`.
  - **Reported, never rewritten** (`JOURNAL_MISMATCH` logged → `mismatch`): a tie-out failing, a journal whose lines
    do not add up to its header, or documents without a journal.
  - **When it runs:** on the 6-hourly timer too. `accounting.rebuildBalances` (`accounting.manage`) runs the rebuild
    on demand.
- **Contracts:** `ipc/accounting.ts` for periods, late postings, backlog and rebuild results; sync entity
  `accounting_period`.
- **Tests:**
  - **Locking:** locking the current month is refused; locking a past month makes a backdated payment post late into
    the next open month, flagged and listed; unlocking needs a reason.
  - **Backfill:** documents saved with journal posting switched off (a test-only trigger) are all posted, cancels
    included. Running it twice posts nothing new; afterwards the tie-outs hold and every document has a journal.
  - **Integrity:** account-balance drift is healed; a document without a journal and a broken tie-out are reported,
    not rewritten.

**6d — Reports and manual journals.**
- **Statements:** Trial Balance, P&L and Balance Sheet, with retained earnings from prior years' profit and customers
  with credit balances presented as advances.
- **Books:** account ledger with running balance, day book, cash book and bank book; date range and branch.
- **Journals and accounts:** manual journal and reversal; adding and editing non-system accounts.

6d details (drafted 2026-10-04; built straight after, as asked):

- **Statements** (`accounting.*`, read with `accounting.view` or `reports.financial`; every one takes an optional
  `branchId`). All of them read journal lines by entry date.
  - **`getTrialBalance({ asOf })`:** every account with a balance on that date, its net in the debit or credit column,
    and totals with `balanced`.
  - **`getProfitAndLoss({ from, to })`:** income and expense accounts with their movement in the range. *Revenue* is
    the 41xx/42xx accounts and *cost of sales* the 51xx accounts, which gives gross profit; other income and expenses
    then give net profit.
  - **`getBalanceSheet({ asOf })`:** assets, liabilities and equity.
    - **Retained earnings:** computed as all profit before the FY of `asOf` (ADR-0033), shown with this year's profit
      as its own line.
    - **Receivables and payables presentation** (ADR-0032): customers with credit balances appear as *Advances from
      customers* (a liability) and suppliers with debit balances as *Advances to suppliers* (an asset). 1300 and 2100
      are shown split by party sign. The books are not changed.
    - It returns `balanced` (assets = liabilities + equity).
- **Books:**
  - **`getLedger({ accountId, from?, to?, limit, cursor })`:** opening balance, lines in date order with entry
    number, source, document, narration, party and a running balance, then the closing balance. Keyset-paged.
  - **`getCashBook` and `getBankBook`:** the same ledger for 1100 Cash and for 1200 Bank (or any bank account chosen).
  - **`getDayBook({ from, to, limit, cursor })`:** journals by date, each with its lines.
- **Manual journals (ADR-0035).**
  - **Posting:** `postManualJournal({ date, narration, lines[{ accountId, debitPaise | creditPaise }], commandId })`
    needs `accounting.create`. It is numbered `T1J/…`, idempotent by `commandId`, and must balance with no
    two-sided line and no group account.
  - **Accounts it may not touch:** **control accounts** — 1300 AR, 2100 AP, 1400 Inventory and every input/output tax
    account. Those move only through documents (opening balances, write-offs, adjustments), so their tie-outs with the
    sub-ledgers always hold. Cash, bank, clearing, 1199 Cash to classify, income, expense and equity accounts are
    open, so a manual journal can reclassify cash, settle card/UPI clearing into the bank, or record owner's capital
    and drawings.
  - **Dates:** a date in a locked month is refused with `PERIOD_LOCKED`; late posting is for documents from devices,
    not for typed journals.
  - **Reversal:** `reverseJournal({ id, date?, reason })` reverses a manual journal once (documents reverse by being
    cancelled).
- **Chart of accounts:**
  - **`listAccounts({ asOf? })`:** returns accounts with their balances.
  - **`createAccount({ code, name, parentCode })`** (`accounting.manage`): a non-system account under a group. The
    code is 4 digits in the group's range (1xxx under Assets, …), and the type comes from the group. Typical uses: a
    second bank account, more expense heads.
  - **`updateAccount({ id, version, name })`** renames any account, system ones included.
  - **All audited and queued for sync.**
- **Tests:**
  - **Statements:** the TB balances after a mixed run of documents. P&L net profit equals the change in equity. The
    Balance Sheet balances, with last FY's profit as retained earnings and a customer's advance shown as a liability.
  - **Books:** the ledger's running balance, paging and opening balance for a range; the day book; the cash book.
  - **Manual journals:** posted and reversed once; refused when unbalanced, on a control or group account, or dated
    into a locked month. A repeated command posts once, and the tie-outs still hold afterwards.
  - **Accounts:** created in range and used in a manual journal; out of range and duplicate codes refused; a system
    account renamed.

**6e — Screens.**
- An Accounts menu with the chart of accounts, statements, ledgers and books, manual journal, and periods with late
  postings.
- Pure helpers (journal form, statement layout) with node tests.

6e details (drafted 2026-10-04; built straight after, as asked):

- **Menu:** an **Accounts** item, shown with `accounting.view`.
- **Chart of accounts** (`/accounts`): accounts grouped under Assets, Liabilities, Equity, Income and Expenses, each with
  its balance as of a chosen date.
  - **Clicking an account** opens its ledger.
  - **Adding an account** opens a dialog for a group, code and name (`accounting.manage`).
  - **Renaming** is inline.
- **Ledger** (`/accounts/ledger/:id`): date range, branch, running balance and paging. Each line shows its entry
  number, source and narration, and links to its document where that screen exists (sale, purchase, payment,
  expense).
- **Statements** (`/accounts/statements`): tabs for the three statements, each with a branch filter.
  - **Trial Balance:** as at a date, with debit and credit totals and a balanced or not-balanced badge.
  - **P&L:** for a range, defaulting to this FY so far. Its sections are revenue, cost of sales, gross profit, other
    income, expenses and net profit.
  - **Balance Sheet:** as at a date. Assets on one side; liabilities and equity on the other, with retained earnings
    and this year's profit, and a balanced badge.
- **Books** (`/accounts/books`): tabs for the cash book, bank book (with a choice of bank account) and day book (a date
  range, each journal with its lines and a late-posting badge).
- **Manual journal** (`/accounts/journal/new`, `accounting.create`): rows of account, debit and credit.
  - **Before posting:** a running total shows the difference. Control and group accounts are not offered, and Post is
    disabled until it balances. One command id per form.
  - **Reversal:** from the day book, a manual journal has a "Reverse" action with a reason.
- **Periods** (`/accounts/periods`, `accounting.manage` for actions):
  - months with their status and journal and late-posting counts;
  - lock (only for months that have ended) and unlock with a reason;
  - the late-postings list;
  - buttons to post the backlog and rebuild balances, showing their results.
- **Pure helpers with node tests:**
  - **`lib/accounting/journalForm`:** rows to input, the running difference, the per-row errors, and which accounts can
    be offered.
  - **`lib/accounting/statementLayout`:** P&L and Balance Sheet sections with subtotals, and Trial Balance totals.
  - **`lib/accounting/chartTree`:** accounts grouped under their headers with group totals.
- **Checking:** as before — typecheck, build and helper tests, with the manual checklist extended. The screens are
  not claimed as clicked through.

6e manual checklist (run `pnpm --filter @muneem/desktop dev`; not yet done — the screens are checked by typecheck,
build and helper tests only):

1. **Menu:** as owner, Accounts is in the menu. As a cashier it is not.
2. **Chart of accounts:** every group with its accounts. Add "1210 HDFC Current" under Assets, rename 1300, and open a
   ledger by clicking an account.
3. **Trading:** sell, buy with freight, take a payment and pay an expense. Then:
   - **Trial Balance:** "Balanced".
   - **P&L:** shows gross and net profit.
   - **Balance Sheet:** "Balanced", with this year's profit equal to the P&L.
4. **Manual journal:** post a card settlement (Dr Bank, Dr Bank Charges, Cr Clearing). Post stays disabled until it
   balances, and 1300 is not in the account list. Reverse it from the day book.
5. **Periods:** lock last month, backdate a payment into it, and see it under late postings with both dates.

**6f — Soak and close-out.**
- **Soak generator:** seeded and deterministic.
- **Exit test** on the soak data: TB balances, P&L = Δ equity, all tie-outs hold, and replay = projection. CI runs about
  two weeks; locally a year (~100k sales).
- **Speed:** `sales.complete` p95 still < 250 ms with the journal step; TB / P&L / BS < 1 s at a year of data.
- **Golden flows:** extended to check the statements.
- **Docs close-out:** build-stages, architecture, CHANGELOG, and the plan's "As built".

6f details (drafted 2026-10-04; built by three parallel agents in separate worktrees, integrated by the lead, as the
user asked):

- **6f-A — Soak generator and exit test** (`apps/desktop/test/soak/`).
  - **Driving it:** a seeded, deterministic generator drives the real services day by day through a controllable
    clock (`testApp({ now })`), so documents carry their own business dates.
  - **What it generates:**
    - opening balances and opening stock on day one;
    - every day: cash, UPI, split and credit sales; purchases with freight (some inter-state, some lines without ITC);
      debit notes; receipts and supplier payments, auto and chosen; cash and credit expenses with and without GST;
      adjustments and stock takes; register open and close with variance; cash in/out;
    - now and then: cancels (payments, expenses, purchases), write-offs, manual journals (card settlement, drawings);
    - at each month end: the previous month is locked, and a few documents are backdated into it to make late
      postings.
  - **Exit test,** checked after generation (`soak.test.ts`):
    - the Trial Balance balances;
    - the Balance Sheet balances;
    - P&L for each FY equals that FY's "profit for the year", and over the whole run P&L = Δ equity excluding opening,
      capital and drawings;
    - every tie-out holds; the party ledgers reconcile; replay = projection;
    - no document is without a journal, no journal differs from its lines, and the balance cache has no drift.
  - **Size:** CI runs about 14 days. `MUNEEM_SOAK_DAYS=365` with about 270 sales a day (~100k sales) runs locally
    through a `soak` script.
- **6f-B — Speed** (`apps/desktop/test/perf/accounting.perf.test.ts`).
  - **Data:** a year of journal volume (~1M lines), written in bulk through `postJournal`.
  - **Budgets:** Trial Balance, P&L and Balance Sheet under 1 s each; an account ledger page and a day book page under
    50 ms.
  - **If the statements miss the budget,** their queries are optimised (for example, whole months read from
    `account_balance`) while results stay identical, as the 6d tests prove.
  - **Sales:** `sales.complete` p95 with the journal step stays under 250 ms (the existing sales perf test, measured
    again).
- **6f-C — Golden flows.** Both golden flows (Stage 3–4 billing and Stage 5 parties) also check the statements: the
  Trial Balance and Balance Sheet balance, 1400 equals the valuation, and their key account balances are pinned.
- **Lead:** merges the three branches, reruns the whole suite and the local year-long soak on one tree, and closes the
  docs:
  - build-stages: Stage 6 → Done with the evidence;
  - architecture: an Accounting section and the new invariants;
  - this plan's "As built";
  - the CHANGELOG.

## Verification

- **CI and checks:** `pnpm turbo run gen build typecheck lint test`, `pnpm schema-lint`, the Go job.
- **Exit evidence:**
  - the trial balance balances on the soak dataset, and P&L agrees with the change in equity;
  - the three tie-outs (1400, 1300, 2100) and the tax tie-outs hold on the soak data and after the kill -9 suite;
  - every journal is balanced by construction (engine + CHECK).
- **Manual** (`pnpm --filter @muneem/desktop dev`): sell, buy, pay and spend. Then read the Trial Balance and Balance
  Sheet, post a manual journal, lock last month, and backdate a payment into it to see the late-posting flag.

## Carried to later stages

- **Stage 7:** sync manual journals and late postings across devices; ingest checks journals against documents. A Go
  port of the posting rules, with fixtures, comes before the cloud verifies them (ADR-0001).
- **Stage 8:**
  - the year-end closing and opening journals, and the series reset;
  - exports, print and PDF of the statements;
  - GST returns built from the tax accounts.
- **Before the pilot (Stage 9):** a CA signs off the posting-matrix document. Reverse-charge purchases come back once
  output and input tax can both be booked (ADR-0023).
- **Deferred:**
  - multiple bank accounts in the payment forms (accounts can be added; payment screens use 1200);
  - card/UPI settlement entries (done by manual journal until a settlement screen exists);
  - cost centres.

## As built (2026-10-04)

- **Journals in each document's transaction,** built from the stored document by one builder per type, so the
  backfill posts exactly what live posting does.
- **Additions to the LLD:**
  - **Sources:** journal sources gain `write_off`, `register_close` and `cash_movement`.
  - **Uniqueness:** `ux_je_ref` includes `is_reversal_of`.
  - **Accounts:** the `account` table gains `role` and `is_group`.
- **The chart is seeded with the business,** not on first posting, so a first sale does not carry 47 audit rows.
- **Purchases post on the supplier's bill date** (ADR-0033), which settles the Stage 5 FY question.
- **Manual journals** never touch control accounts and are refused in locked months (ADR-0035, added in 6d).
- **Statements read the balance cache for whole months** (ADR-0036, added in 6f, migration 0013), after the
  year-of-data test showed the line-based queries missing their budgets.
- **Opening a register posts nothing.** Opening cash is a manual journal (posting matrix note, found by the golden
  flow).
- **The ageing speed test times a median of five** (6b), because single calls caught garbage-collection pauses of the
  test process.
- **Not clicked through yet:** the screens are checked by typecheck, build and helper tests; the 6e manual checklist
  is still to run.
- **Built by agents:** 6f was built by three agents in parallel worktrees and integrated by the lead, as the user asked.
- **Exit evidence:** the 365-day soak passes (98,550 sales, 106,379 journals, 624,710 lines, 54 late postings). Its
  full-check test has 2 minutes on long runs, because 6.8 s of checks overran the 5 s default.
