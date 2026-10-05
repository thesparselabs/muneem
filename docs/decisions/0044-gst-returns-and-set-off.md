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

## As built (Stage 8c, 2026-10-04)
- **Builders:** pure functions in `packages/domain/src/gst/returns/` (`buildGstr1`, `buildGstr3b`, `buildItcRegister`,
  `gstTieOuts`) over line records that `packages/db-sqlite/src/repositories/gstReturns.ts` reads. A composition or
  unregistered business gets `applicable: false` and no sections.
- **Which month a document is in:** the month its journal posted to, not its own date. A document that arrives late into
  a locked (filed) month is reported in the next open month's return with its own invoice date, which is how the portal
  takes missed invoices, and every month's return equals that month's tax-account movements by construction. Documents
  issued are counted by document date. **Lock a month after filing**, or a later document dated in it changes the return.
- **Sections, per line:** a line's treatment decides first — nil, exempt and non-GST lines go to the exempt table split
  inter/intra and registered/unregistered, even on a B2B or B2CS bill; the rest follow the bill's stored bucket (B2B,
  B2CL, B2CS, exports). A zero-rated line on a B2B bill stays in B2B at rate 0. Exports without IGST are `WOPAY`.
- **Credit notes follow the invoice they reverse:** against B2B → CDNR; against B2CL → CDNUR `B2CL`; against exports →
  CDNUR `EXPWOP`; against B2CS → B2CS as a negative in the same state and rate (GST rules allow no CDNUR for B2CS).
  The note's stored `gstr1_bucket` (8b) is kept for display; the section comes from the sale's bucket. Note lines with a
  nil/exempt/non-GST treatment reduce the exempt table.
- **HSN summary:** net of credit notes, split into B2B and B2C (the April 2025 format), keyed by HSN, UQC and rate;
  description is left blank. UQC comes from a domain map of unit codes (`uqcOf`: PCS, KG→KGS, G→GMS, L→LTR, ML→MLT,
  M→MTR, BOX, DOZ, CASE→CTN; anything else OTH). Lines without HSN are reported with an empty HSN and counted.
- **Documents issued:** per series (invoices of the regular scheme, credit notes) from the lowest to the highest number
  dated in the month; total = the range, cancelled = numbers in the range with no posted document. **A credit note that
  cancels a whole bill does not make the invoice "cancelled":** the invoice was issued and is reported, and the note
  reverses it. Purchase debit notes are not outward documents and are left out.
- **GSTR-3B:** 3.1(a) taxable, (b) zero-rated, (c) nil + exempt, (d) zero (reverse charge is refused, ADR-0023), (e)
  non-GST, all net of credit notes. 4A(5) eligible ITC of purchases and of expenses with ITC; 4B(2) ITC reversed by
  debit notes and by cancelling a purchase or expense (in the month the reversal posts); 4C = 4A − 4B; 4D(2) tax on
  lines marked not eligible. Table 5 reads purchases only: composition suppliers, nil and exempt lines; non-GST lines.
- **Tie-out:** `gstMonthlyTieOuts` compares, for every month with tax documents, 3.1 output tax and 4C ITC by head with
  the month's movements on the output and input accounts (set-off journals left out); exact, and part of
  `tieOutFailures`. The all-time output and input tie-outs subtract what set-offs moved.
- **HSN on products:** a business under the regular scheme **with a GSTIN** must give a new product an HSN/SAC
  (`VALIDATION_FAILED` on `products.create`); imports and existing products are not refused, and the report
  `gst.productsMissingHsn` lists them.
- **B2CL threshold:** `gst.b2clThresholds` (`{effectiveFrom, paise}[]`) — the latest entry on or before the bill's date
  — falling back to `gst.b2clThresholdPaise`, then ₹1 lakh.
- **Set-off (`gst_setoff`, migration 0017):** one per month, dated the month's last day, computed from the output and
  input balances at that day (negative balances count as zero). `computeSetoff` (domain, Go port in
  `cloud/internal/domain/gst`, shared vectors in `fixtures/setoff/`) uses IGST credit first — on IGST, then on whatever
  CGST and SGST their own credit cannot cover, then CGST, then SGST (rule 88A: IGST credit is exhausted before CGST or
  SGST credit is used) — then CGST credit on CGST then IGST, SGST credit on SGST then IGST, cess on cess; the rest is
  cash payable. Refused (`INVALID_STATE`) for a month not yet ended, already set off, or earlier than the latest set-off
  (months go in order; a month skipped is carried by the next set-off's balances), and (`PERIOD_LOCKED`) for a locked
  month. Not for a composition business.
- **Payment (`gst_payment`):** challan reference (CPIN/CIN), heads, optional return month; Dr 2300, Cr 1200 Bank;
  refused for a locked month or a future date. Interest, fees and penalties are not modelled.
- **Numbers:** per terminal like every document (ADR-0028/0037): kind letters `S` (set-off) and `G` (GST payment),
  e.g. `T1S/2627/00001`; both need a terminal. Their journals take the document number.
- **Journal sources:** SQLite cannot widen `journal_entry.source` without rebuilding the journal table, so a set-off
  posts with source `transfer` and a payment with `payment`, told apart by `ref_type` `gst_setoff` / `gst_payment`.
- **Permissions:** returns, previews and exports need `gst.view`; posting a set-off or a challan needs `gst.create`
  (managers and accountants already hold both). No new action was added.
- **Exports:** report definitions `gst.gstr1.{b2b,b2cl,b2cs,cdnr,cdnur,exp,exemp,hsn_b2b,hsn_b2c,docs}` in the offline
  tool's column order, with dates as `dd-Mon-yyyy`, places of supply as `27-Maharashtra` and UQC as `KGS-KILOGRAMS`;
  they export "bare" (no header lines, no totals row) so the tool can import the CSV. Also `gst.gstr3b`,
  `gst.itcRegister` and `gst.productsMissingHsn`.
- **Sync:** entities `gst_setoff` and `gst_payment` on the documents stream, payloads with their journal. The reference
  server checks conservation; Go recomputes the utilisation from the payload's liability and credit, and checks that the
  journal clears each output head, takes exactly the credit used, moves the rest to 2300 and touches no other account; a
  payment's heads add up and its journal is 2300 against Bank. A pulled set-off keeps the origin's amounts (ADR-0040).
- **Two devices offline setting off the same month** both stand — every device converges on both — and each device
  records a local `duplicate_setoff` review item. There is no cancel of a set-off yet, so the over-cleared balances stay
  visible until corrected; flagged for 8d.
- **For year-end (8d):** `latestSetoffMonth(db, businessId)` and `setoffIdsForMonth` tell which months are settled;
  a month is settled when it, or a later month, has a set-off.

### For CA review
1. Documents are reported in the month their journal posted (late arrivals into a filed month move to the next return).
2. Credit notes against B2CS invoices are netted into B2CS; against exports into CDNUR `EXPWOP`.
3. A whole-bill credit note (cancel) is not counted as a cancelled document in Table 13.
4. Ineligible ITC is shown in 4D(2); the 2022 format may want it in 4A and reversed in 4B(1) instead.
5. Table 5 leaves out expenses; purchase debit notes are not in Table 13.
6. IGST credit is spent on CGST/SGST before CGST/SGST credit even when that leaves CGST/SGST credit unused (rule 88A).
