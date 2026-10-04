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

## Design (ADRs 0030–0034, written in 6a)

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

**6b — Postings.** `postJournal` and the journal step in every document's transaction:
- sales (cash, split, credit), purchases, debit notes, purchase cancel;
- receipts, supplier payments, payment cancel, write-offs, expenses;
- opening stock, adjustments, stock take, cost corrections;
- party openings, register variance, cash in/out.

Each test checks that the journal balances, its accounts are right, and the tie-outs hold afterwards. The kill -9
suite checks that every sale has exactly one journal after the kills.

**6c — Periods, late postings, backfill, integrity.**
- Monthly periods, lock and unlock.
- A late posting into the earliest open period, with the flag and the review list.
- The backfill of pre-Stage-6 documents (idempotent, batched, safe to stop mid-way).
- The integrity check gains the journal replay, the tie-outs and unposted documents.

**6d — Reports and manual journals.**
- **Statements:** Trial Balance, P&L and Balance Sheet, with retained earnings from prior years' profit and customers
  with credit balances presented as advances.
- **Books:** account ledger with running balance, day book, cash book and bank book; date range and branch.
- **Journals and accounts:** manual journal and reversal; adding and editing non-system accounts.

**6e — Screens.**
- An Accounts menu with the chart of accounts, statements, ledgers and books, manual journal, and periods with late
  postings.
- Pure helpers (journal form, statement layout) with node tests.

**6f — Soak and close-out.**
- **Soak generator:** seeded and deterministic.
- **Exit test** on the soak data: TB balances, P&L = Δ equity, all tie-outs hold, and replay = projection. CI runs about
  two weeks; locally a year (~100k sales).
- **Speed:** `sales.complete` p95 still < 250 ms with the journal step; TB / P&L / BS < 1 s at a year of data.
- **Golden flows:** extended to check the statements.
- **Docs close-out:** build-stages, architecture, CHANGELOG, and the plan's "As built".

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
