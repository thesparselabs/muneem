# ADR-0035 — Manual journals and control accounts

**Status:** Accepted, 2026-10-04

## Context
FR-053 asks for manual journals. Stage 6 ties four kinds of account to their sub-ledgers (ADR-0034):
- 1300 AR to the customer ledger;
- 2100 AP to the supplier ledger;
- 1400 Inventory to the stock valuation;
- each input and output tax account to its documents.

A free-form journal on any of these would break a tie-out that the integrity check then reports forever. LLD §5.4's
late posting exists for documents arriving from devices, not for journals typed today.

## Decision
- **Posting:** a manual journal needs `accounting.create`, is numbered `T1J/…`, and is idempotent by its command id.
  It must balance, have one side per line, and post to no group account.
- **Accounts it may not touch:** the **control accounts** — AR, AP, Inventory and every input and output tax account.
  Those move only through documents: opening balances, write-offs, payments, adjustments, purchases and sales. That
  keeps every tie-out true by construction.
- **Accounts it may use:** cash, bank, clearing, 1199 Cash to classify, and all income, expense and equity accounts.
  That covers reclassifying cash, settling card/UPI clearing into the bank, owner's capital and drawings, and
  corrections between expense heads.
- **Locked months:** a manual journal dated into one is refused with `PERIOD_LOCKED`. The accountant picks an open
  date instead.
- **Reversal:** a manual journal can be reversed once (`accounting.reverseJournal`). A document's journal is reversed
  by cancelling the document.

## Consequences
- **GST set-off** (Dr output tax, Cr input tax, Cr GST payable) touches tax accounts, so it cannot be a manual journal.
  It arrives with the GST returns in Stage 8 as its own document type, which the tax tie-outs then account for.
- **Correcting a control account** means correcting its document: cancel and re-enter, or post an adjustment, a
  write-off or an opening.
