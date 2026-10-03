# ADR-0023 — Purchase invoice and landed cost

**Status:** Accepted, 2026-10-03

## Context
FR-043 describes PO → GRN → invoice. The PRD review recommends the purchase invoice receive stock directly in the MVP,
and the user agreed: purchase orders and GRN are deferred. LLD gives the posting (`Dr Inventory` at taxable +
non-eligible tax + landed cost, `Dr Input tax` eligible, `Cr AP`) but no purchase table, and LLD §4.1 says receipts
are valued at landed cost excluding ITC-eligible tax.

## Decision
- A purchase records the supplier's invoice number and date and gets an internal number from a per-branch `purchase`
  series. The supplier's invoice number is unique per supplier and financial year, ignoring case, among posted
  purchases.
- Lines may be in any of the product's units; stock moves in base units (`toBaseQty`).
- Tax comes from the existing GST engine, with the supplier's state as `supplierStateCode` and the branch's state as
  place of supply, so intra/inter and the tax-split CHECKs from `sale` apply unchanged. Composition and unregistered
  suppliers charge no tax (a CHECK).
- The user enters the bill's grand total. Within ±₹1 of the computed total the difference is stored as round-off;
  beyond it the purchase is refused as a keying mistake.
- Each line has an ITC flag (default eligible; never eligible from composition or unregistered suppliers).
  `itc_paise` on the header is the claimable tax.
- Freight, loading, insurance and other charges are entered net, without GST, and spread over lines by taxable value
  with `apportion` (equally when every line is free). A taxed freight bill is a separate service line or expense.
- **Receipt value per line = taxable + apportioned charges + tax that cannot be claimed**; a CHECK on
  `purchase_item` makes any other value impossible to store. Each line posts one `purchase` movement through
  `postMovement`, so stock sold below zero is re-costed by the existing `cost_correction` path (ADR-0018).
- Reverse charge is a stored flag only; no self-invoice in Stage 5.
- `purchases.receive` is dropped from the IPC surface: there is no GRN.

## Consequences
- Purchase lines carry everything Stage 6 needs: inventory value, eligible input tax, round-off and the AP amount.
- PO/GRN can be added later as documents that feed a purchase; nothing here assumes they don't exist.
