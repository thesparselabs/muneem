# ADR-0044 — GST returns and set-off

**Status:** Accepted, 2026-10-04

## Context
FR-094 names the GSTR-1 sections and an ITC register; the designs leave GSTR-3B mapping, the set-off order and formats open. ADR-0035 says set-off must be its own document, not a manual journal.

## Decision
- **Reading from documents:** GSTR-1 buckets are aggregated **per line** (nil, exempt and non-GST lines leave
  mixed invoices). The HSN summary carries UQC, documents issued come from the series, and the GSTR-3B summary
  covers 3.1(a)(c)(e), 4A/4B/4D and 5.
- **Checking against the books:** the returns reconcile with the tax accounts (ADR-0034's tie-out).
- **Set-off:** a `gst_setoff` document per month moves output tax against input tax in the statutory order: IGST
  credit first to IGST, then CGST, then SGST; CGST credit to CGST then IGST; SGST to SGST then IGST; cess only to
  cess. The balance moves to 2300 GST Payable.
- **Payment:** a `gst_payment` document clears 2300 from the bank.
- **Locking:** both are refused once the month is locked, and they never touch AR, AP or Inventory.

## Consequences
- Built in Stage 8 (8c); amended with an "As built" note if reality differs.
