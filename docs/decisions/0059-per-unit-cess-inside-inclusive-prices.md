# ADR-0059 — Per-unit cess inside a tax-inclusive price

**Status:** Accepted, 2026-10-05

## Context
The golden tax scenario suite (Stage 9h) found that an item sold at a tax-inclusive price (an MRP) with a per-unit cess
was billed above its price. Only the ad valorem part of the cess was taken out before working back to the taxable
value, so the per-unit cess was added on top: a ₹150 pack with ₹10 per-unit cess billed ₹160. On a printed MRP this
overcharges the customer and misstates every tax head. It is wrong in both the TypeScript and the Go engines, so the
cloud's check agreed with the device and never caught it.

## Decision
- **Order of the back-calculation:** for an inclusive price, take the **per-unit cess out of the gross first**, then
  back-calculate the taxable value and the ad valorem taxes from what remains. The line then totals the MRP to within a
  paisa, and the invoice round-off clears the remainder.
- **Exclusive prices are unchanged.**
- **Both engines changed together:** `computeInvoice.ts` and `compute.go`, with a HAND golden vector, a property test,
  and the LLD §3.1 rule updated.

## Consequences
- **Earlier bills:** any invoice already issued for such an item before this fix was overcharged. No shop runs the app
  yet, so there is nothing to correct. A shop that had would need credit notes.
- **CA review:** the CA pack (question C3) asks the CA to confirm the treatment.
