# ADR-0031 — Chart of accounts and the accounts each posting uses

**Status:** Accepted, 2026-10-04

## Context
LLD §5.1 gives the seed chart. It has a single input-tax and a single output-tax line for CGST, SGST, IGST and Cess,
and no accounts for opening balances, bad debts, freight lost on returns or unexplained cash. Stage 5 needed all four.
It also does not say which account each payment method uses.

## Decision
- **Seeding.** The chart is data in `@muneem/domain` (`CHART_OF_ACCOUNTS`), seeded per business on first use and
  idempotent by code. Its accounts are `is_system`: they can be renamed but never retyped or deleted.
- **Groups.** 1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Income and 5000 Expenses are headers that nothing
  posts to (a trigger refuses it).
- **Roles, not codes.** Rules name accounts by **role** (`cash`, `ar`, `input_cgst` …). The seed maps each role to
  exactly one account, so a renamed account keeps its postings. Expense categories name their account by code
  (5400…5900).
- **Additions to §5.1:**
  - **one account per tax head** for GST set-off: Input 1510 CGST, 1520 SGST/UTGST, 1530 IGST, 1540 Cess; Output
    2210, 2220, 2230, 2240;
  - **1199 Cash to classify;**
  - **3400 Opening Balance Equity;**
  - **5110 Purchase-return Losses;**
  - **5470 Bad Debts** (ADR-0025).
- **Accounts by payment method:**
  - **Sale tenders:** cash → 1100; UPI, card and other → **1250 Clearing** (until the acquirer pays).
  - **Payments and expenses:** cash → 1100; everything else → **1200 Bank**.
- **User accounts.** Users can add non-system accounts under a group, such as a second bank account or more expense
  heads.

## Consequences
- GST set-off and the returns in Stage 8 read one account per head.
- Card/UPI settlement (Dr Bank, Dr Bank Charges, Cr Clearing) is a manual journal until a settlement screen exists, so
  1250 grows until then.
