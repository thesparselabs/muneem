# ADR-0025 — Payments, allocation, advances, write-offs and expenses

**Status:** Accepted, 2026-10-03

## Context
LLD §2.5 has `payment` and `payment_allocation`, allocation inside the payment's transaction, oldest-due-first by
default, and `allocated ≤ amount` as an invariant. Debit notes, write-offs and opening balances also settle documents,
and LLD's allocation only starts from a payment. LLD §10.2 has `expenses.update`, but financial documents are
append-only. The chart of accounts has no bad-debt account.

## Decision
- `payment` as LLD §2.5, numbered from per-branch `receipt` (in) and `payment` (out) series. Customers pay in and
  suppliers are paid out (a CHECK); refunding a customer's advance comes later. `account_id` stays empty until the
  chart of accounts exists (Stage 6). A cash payment on a terminal with an open register also writes a
  `cash_movement`, so the drawer count stays right.
- LLD's `payment_allocation` becomes **`allocation`**, with a source (payment, debit note, write-off, opening) and a
  target (credit sale, purchase, credit expense, opening). Triggers keep `allocated_paise` on the source and
  `settled_paise` on the target, and CHECKs on both refuse an over-allocation, so it cannot be stored. Another trigger
  refuses an allocation whose documents are cancelled or belong to another party.
- Allocations are append-only and only end by being voided (`voided_at`), which the triggers reverse. A cancelled
  payment voids its allocations and writes a reversing ledger entry.
- Default allocation is automatic: **oldest due date first, then document date**, ULID as the tie-break
  (`allocateOldestFirst`). The user may choose instead (`allocateAsChosen`). What is left is an advance;
  `payments.allocate` applies it later.
- A **write-off** is a document against chosen customer open items, needs `payments.approve`, and is audited.
  Stage 6 posts it to a new **5470 Bad Debts** account (an addition to LLD §5.1).
- An **expense** is a document with a seeded category (mapped to an LLD §5.1 expense account), an optional supplier
  and GSTIN, optional GST with an ITC flag, and a method. On credit it needs a supplier and a due date and is a
  charge on that supplier. `expenses.update` becomes cancel and re-create.

*Amended before merge (5h, 2026-10-04):*
- **Dates on allocations:** each allocation records `allocated_on` and, when voided, `voided_on` (migration 0009).
  - **`allocated_on`** is the settling document's date when made with it, else the day it is made, but never earlier
    than the document it settles. So a backdated payment cannot settle a bill before the bill exists.
- **How "as of D" works:** outstanding and ageing count documents dated by D and not cancelled by D, and only the
  allocations made by D and not voided by D. So a past date is not changed by later payments, and the net always
  equals the statement balance on D.

## Consequences
- The two LLD §17 allocation invariants (Σ allocations ≤ payment, and ≤ document) are enforced by the database.
- Allocation has no Go port yet; it gets one with shared fixtures before the cloud verifies payments (Stage 7).
