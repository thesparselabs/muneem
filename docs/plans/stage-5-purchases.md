# Stage 5 — Purchases, parties and payments: implementation plan

## Context

Stages 0–4 are merged (PR #1, #3, #4, #5). Stage 5 (LLD §20) is "Purchases, suppliers, expenses, payments +
allocation, customer credit"; exit criterion **party ledgers reconcile to the control accounts**. The design gives the
payment and allocation DDL (LLD §2.5), the posting matrix lines for purchases, returns, payments and expenses (LLD
§5.2) and the rule that party balances are derived, never synced as a number (LLD §9). It has no supplier, purchase,
debit note, expense or party-opening table, no supplier-return costing rule, no credit-limit check, and no bad-debt
account. `customer` exists since Stage 3 without credit fields; `sale.credit_paise` exists but the POS offers no
credit tender (`TENDER_METHODS` is cash/upi/card/other).

**Decisions (user, 2026-10-03):**
- **Exit proof:** Stage 5 proves the party sub-ledger — Σ party ledger entries = Σ open document balances − unallocated
  credits, per party and in total — and stores every amount the journal will need. Stage 6 posts them and adds the
  GL tie-out to AR 1300 and AP 2100 (same split as Stage 4 / ADR-0018).
- **Purchases:** purchase invoice receives stock directly; purchase returns (debit notes) are in. Purchase orders and
  GRN are deferred (PRD review, FR-043).
- **Credit limit:** a credit sale over the limit is refused with `CREDIT_LIMIT_EXCEEDED` unless the user holds the
  override grant; the override is audited. Manager PIN override stays deferred.
- **Extras in scope:** opening balances for customers and suppliers, landed-cost apportionment, write-off / bad debt,
  purchase lines imported from a file.

Delivery as before: branch `feat/stage-5-purchases`, parts 5a–5g as commits, each green with a CHANGELOG line;
nothing pushed until the user reviews.

## Design (ADRs 0022–0026, written in 5a)

| ADR | Decision |
|---|---|
| 0022 Party sub-ledger | `party_ledger_entry` (append-only, signed paise, party type + id, ref type/id, doc date, due date) is written in the same transaction as every document that changes what a party owes: credit sale, purchase invoice, debit note, payment, opening balance, write-off, cancellation. Positive = party owes us. **Open items** are the documents with an outstanding amount (amount − Σ live allocations). Invariant, checked by a property test and by the integrity check: **Σ entries per party = Σ open receivable items − Σ open payable items − Σ unallocated payment amounts**. Balances are never stored as the truth and never synced as a number (LLD §9); a cached `party_balance` is optional and only through one writer, like `stock_level`. Stage 6 posts the entries' documents and ties Σ customer balances to 1300 and Σ supplier balances to 2100. |
| 0023 Purchase invoice and landed cost | A purchase is a document with the supplier's invoice number and date (unique per supplier and FY), an internal number from a per-branch `purchase` series, and lines in any of the product's units (converted with `toBaseQty`). Tax comes from the existing GST engine with the supplier's state as `supplierStateCode` and the branch's state as place of supply, so intra/inter and the CHECKs from `sale` apply unchanged. The user also enters the bill's grand total; a difference over ±₹1 is refused, within it is stored as round-off. Each line has an ITC flag (default eligible; composition/unregistered suppliers are never eligible). Freight and other charges are apportioned over lines by taxable value with `apportion` (largest remainder). **Receipt value per line = taxable + ineligible tax + apportioned charges**; each line posts one `purchase` movement through `postMovement`, so provisional costs from overselling are corrected by the existing `cost_correction` path. Reverse charge is a stored flag only (no self-invoice in Stage 5). `purchases.receive` is dropped from the surface (no GRN). |
| 0024 Supplier returns and cancellation | A debit note is a document against one purchase, per line, quantity ≤ purchased − already returned. Tax reverses at the original line's rate. Stock leaves at the **original line's landed unit cost**, not the moving average, through a new engine operation `returnToSupplier(level, qty, value)`; if the level's quantity reaches zero with value left, the remainder is booked as a `cost_correction` movement so Σ movement value = level value still holds. Cancelling a purchase (a wrong entry, not a return) reverses its stock at landed cost and its ledger entry without a debit note, and is refused while anything is allocated to it. |
| 0025 Payments, allocation, advances, write-off | `payment` and `payment_allocation` as LLD §2.5, numbered from per-branch `receipt` / `payment` series. Allocation happens inside the payment's transaction. Default is automatic, **oldest due date first, then document date**; the user may override line by line. `allocated_paise ≤ amount_paise` is a CHECK and a property test; the remainder is an advance (on-account credit) that `payments.allocate` can later apply to new documents. Allocations are append-only; they end only when their payment is cancelled (rows get `voided_at`, never deleted). A write-off is its own document against chosen customer open items, permission `payments.approve`, audited; Stage 6 posts it to a new **5470 Bad Debts** account (LLD §5.1 changes). Expenses are documents with a category, optional supplier and GSTIN, optional GST with an ITC flag, and a method; a cash expense on a terminal with an open register also writes a `cash_movement` of kind `expense` so the drawer count stays right; an expense on credit writes a supplier ledger entry. Expense categories are seeded and map to the LLD §5.1 expense accounts that Stage 6 posts to. |
| 0026 Customer credit at the POS | `credit` joins the POS tenders and needs a customer on the bill. `customer` gains `credit_limit_paise` (NULL = no credit allowed, 0 is not "unlimited"), `credit_days`, and an opening balance document. `sales.quote` returns the customer's outstanding and a `credit_limit` issue when outstanding + credit portion > limit; the commit refuses with `CREDIT_LIMIT_EXCEEDED` unless the user has `customers.approve`, in which case it writes a `credit.limit_override` audit row in the sale's transaction. The credit portion writes a customer ledger entry with due date = doc date + credit days. Credit limit edits need `customers.approve` and are cloud-wins at sync (LLD §9). Payment reminders (FR-040) wait for consent capture and message templates (Stage 8). |

## Schema — migration `0006_parties`

- `supplier` (as `customer` + `credit_days`, `state_code`, `gstin`, `tax_scheme`; sync columns).
- `customer` gains `credit_limit_paise`, `credit_days`.
- `party_opening` (party type/id, receivable or payable, amount, as-of date; one per party; append-only).
- `purchase` (supplier, snapshot, supplier invoice no/date, internal series/seq/number, branch, warehouse, place of
  supply, supply type, reverse-charge flag, gross/discount/taxable/tax/charges/round-off/total, `itc_paise`,
  `status`, due date; the three tax CHECKs from `sale`; unique supplier invoice per supplier + FY; append-only except
  status) and `purchase_item` (snapshot, qty/base qty, rate, discount, taxable, rate bp, tax split, ITC flag,
  apportioned charges, `landed_value_paise`, `unit_cost_paise`; quantity returned is summed from debit-note lines, and a
  trigger refuses returning more than was bought), `purchase_charge` (kind, amount).
- `debit_note` + `debit_note_item` (against `purchase` / `purchase_item`, own series).
- `payment` (LLD §2.5) and **`allocation`** (LLD's `payment_allocation` generalised: source = payment, debit note,
  write-off or opening; target = credit sale, purchase, credit expense or opening; `voided_at`). Triggers keep
  `allocated_paise` / `settled_paise` on both documents, so over-allocation cannot be stored.
- `write_off`, `expense`, `expense_category` (seeded).
- `party_ledger_entry` (append-only triggers; unique per `(ref_type, ref_id, party)`; index on party + doc date).
- `doc_series` rows for `purchase`, `debit_note`, `receipt`, `payment`, `expense` made on first use per branch, with
  short prefixes under the 16-character cap (ADR-0014).

## Existing code to reuse

- GST engine `computeInvoice` (TS and Go, golden vectors) for purchase and debit-note tax; `apportion`, `divRound`,
  `toBaseQty` (`packages/domain`).
- Costing engine (`packages/domain/src/inventory/costing.ts`) and `postMovement` / `replayCheck`
  (`packages/db-sqlite/src/repositories/inventory.ts`); the `cost_correction` path for provisional costs.
- `withTransaction`, `recordChange`/`queueChild`, `appendAudit`, `findOrCreateSeries`/`allocateDocNumber`.
- Customer repository and POS customer picker (`repositories/customer.ts`, `services/pos/customers.ts`); sale commit
  steps and quote issues (`services/pos/saleCommit.ts`, `salePricing.ts`); `PosContext` for permissions and settings.
- Import pipeline (`services/import/`: `tableReader`, `columnMapping`, `PreviewStore`) for purchase lines.
- Register cash movements (`services/pos/register.ts`) for cash expenses.
- Crash suite (`apps/desktop/test/crash/`), perf tests, golden flow, `diagnostics.integrityCheck`.

## IPC surface

`suppliers.search / get / create / update / getLedger`; `customers.getLedger / getOutstanding / setCreditLimit /
setOpening`; `suppliers.setOpening`; `purchases.create / get / list / return / cancel / importLinesPreview`;
`payments.create / allocate / get / list / cancel / openItems / writeOff`; `expenses.create / get / list / cancel /
listCategories`. Views need `*.view`; writes `*.create`; cancel `*.cancel`; write-off and credit-limit changes
`payments.approve` / `customers.approve`. `TENDER_METHODS` gains `credit`; `SaleQuote` gains `customerOutstanding` and
the `credit_limit` issue. `expenses.update` (LLD §10.2) becomes cancel + re-create: financial documents are
append-only.

## Parts (tests first; one commit each)

**5a — Engines, schema, docs**
1. `@muneem/domain` `parties/`: `allocate(openItems, amount, overrides?)` (FIFO by due date then doc date; never over
   the payment or an item), `reconcile(entries, openItems, advances)`; `purchases/`: `landedValues(lines, charges)`
   via `apportion`; costing `returnToSupplier`. fast-check properties: Σ allocations ≤ payment and ≤ each item;
   reconciliation holds over random sequences of invoices, payments, returns, write-offs and cancellations;
   Σ landed values = Σ taxable + ineligible tax + charges; replay = projection still holds with supplier returns.
2. Migration `0006_parties` + triggers; migration tests (append-only, uniqueness, tax CHECKs, allocation CHECK).
3. ADRs 0022–0026, this plan, build-stages (Stage 5 → In progress), LLD notes: purchase/debit-note DDL, supplier-return
   costing, 5470 Bad Debts, `purchases.receive` dropped, `expenses.update` replaced.

**5b — Suppliers, customer credit fields, party ledger**
4. Supplier repository and service; customer credit limit and days; opening balances for both.
5. `postPartyEntry` (the only writer of `party_ledger_entry`), `openItems(party)`, `reconcileParties` (DB-level
   version of the property), ledger statement with running balance (FR-039), outstanding with ageing buckets
   (0–30/31–60/61–90/90+).

5b details (settled 2026-10-03, before starting the part):

- **Suppliers.** `SupplierInput` mirrors `CustomerInput`, plus `stateCode` (required — it decides intra/inter),
  `taxScheme` (default `regular`) and `creditDays`. Name, GSTIN and state are checked as for customers, and the GSTIN
  must start with the state code. Create and update follow `createCustomer` / `updateCustomer`: `recordChange` writes
  the audit row and queues the sync row in the same transaction, and update uses optimistic `version`. A supplier is
  never deleted in Stage 5 (purchases point at it); deactivation waits for a need.
- **Customer credit.** `CustomerInput` gains `creditDays`; `customers.update` may change it. The credit limit is
  **not** part of `customers.update`: `customers.setCreditLimit({ id, version, limitPaise | null })` needs
  `customers.approve`, writes a `customer.credit_limit` audit row with before/after, and is cloud-wins at sync
  (LLD §9). `null` = no credit.
- **Opening balances.** `customers.setOpening` / `suppliers.setOpening` take `{ partyId, side, amountPaise, asOfDate }`.
  - **One live opening per party** (the partial unique index). The default side is `receivable` for a customer and
    `payable` for a supplier; the other side is an advance.
  - **To correct one, cancel and re-enter.** `setOpening` on a party that already has one cancels the old one (status,
    `cancelled_at/by`, a `cancel` ledger entry) and posts the new one in the same transaction. It is refused while
    anything is allocated to or from the old one.
  - **Charge or settlement.** An opening in the business's favour (customer receivable, supplier receivable) is
    positive on the ledger. The default side is a charge, open to payments. The other side is a settlement, which 5d
    can allocate.
  - **Date.** `asOfDate` is both the document date and the due date, so an opening ages from when it was owed.
  - **Permission:** `customers.edit` / `suppliers.edit`.
- **`postPartyEntry`.** `postPartyEntry(db, { businessId, partyType, partyId, refType, refId, kind: 'post' | 'cancel',
  amountPaise, docDate, dueDate }, actor)` is the only `INSERT` into `party_ledger_entry`, called inside the caller's
  transaction. It refuses a zero amount, and a `cancel` without a matching `post` of the opposite sign. It is
  idempotent per `(ref, kind)` through the unique index. It queues no sync row of its own: the entry travels in its
  document's aggregate (as stock movements do in the sale's), so the opening's outbox payload carries its entry.
- **Reading the ledger** (`repositories/partyLedger.ts`):
  - **`openItems(party)`:** the live charges with outstanding > 0 (`sale` credit, `purchase`, credit `expense`,
    opening) and the live settlements with unallocated > 0, each as `{ type, id, docNumber, docDate, dueDate,
    amountPaise, openPaise }`. In 5b only openings exist; the others are added by the parts that create them.
  - **`partyStatement(party, from, to)`:** opening balance before `from`, then every entry in `(doc_date, id)` order
    with its document number and a running balance, then the closing balance. Keyset-paged like
    `inventory.getMovements`.
  - **`outstanding(partyType, asOf)`:** per party, the open charges bucketed by days past **due date** (not yet due /
    0–30 / 31–60 / 61–90 / 90+), less unallocated settlements shown as "advance", plus the totals.
  - **`reconcilePartiesDb(businessId)`:** loads entries, documents and live allocations and runs the domain
    `reconcileParties`. It is the DB-level exit check.
- **IPC.**
  - **Suppliers:** `suppliers.search / get / create / update / getLedger / setOpening`.
  - **Customers:** `customers.getLedger / getOutstanding / setCreditLimit / setOpening`.
  - **Suppliers' outstanding:** `suppliers.getOutstanding`, added for symmetry with customers.
  - **Permissions:** view `*.view`, create `*.create`, update `*.edit`, openings `*.edit`, credit limit
    `customers.approve`.
  - **Money:** every amount crosses IPC as integer paise and every date as a business date (`YYYY-MM-DD`).
- **Sync entity types.** `OutboxEntityType` gains `supplier`, `party_opening` and `customer_credit_limit`, with the
  rest of Stage 5's (`purchase`, `debit_note`, `payment`, `allocation`, `write_off`, `expense`) added by their parts.
- **Tests.**
  - **Supplier repository:** create, update, version conflict, GSTIN/state rule.
  - **Credit limit:** permission refused for a cashier; audit row; `null` round-trips.
  - **Openings:** post, replace, refused while allocated, ledger entries signed correctly for all four party/side
    pairs.
  - **`postPartyEntry`:** guards and idempotency.
  - **Reports:** statement running balance and paging; ageing buckets either side of each boundary.
  - **Reconciliation:** `reconcilePartiesDb` clean after every test above, and it names a hand-tampered entry.
- **Not in 5b:** screens (5f), payments and allocation (5d), and cloud supplier endpoints (Stage 7).

**5c — Purchases and returns**
6. `PurchaseService.create`: tax through the GST engine, total check, ITC, landed cost, one `purchase` movement per
   line, supplier ledger entry, audit, outbox aggregate (purchase + lines + movements + entry). Tests: stock rises at
   landed cost; a provisional sale is corrected; inter-state gives IGST; ineligible tax goes into cost; duplicate
   supplier invoice refused; a failure leaves nothing.
7. Debit notes and cancel (ADR-0024); purchase-line import preview (SKU/barcode, qty, unit, rate, GST rate, discount)
   that fills the form — the commit is always `purchases.create`.

5c details (settled 2026-10-03, before starting the part):

- **What the user enters.** `PurchaseDraft`:
  - **Header:** `supplierId`, `supplierInvoiceNo`, `supplierInvoiceDate`, optional `dueDate`, `isReverseCharge`,
    `note`.
  - **Lines:** `productId`, `uomId`, `qtyMilli`, `unitPricePaise`, `priceIsInclusive` (default false, since supplier
    bills are usually exclusive), `lineDiscount`, optional `gstRateBp`, optional `itcEligible`.
  - **Bill-level:** `billDiscount`, `charges[]` (kind, description, amount) and `billTotalPaise`, the grand total
    printed on the supplier's bill.
  - **Rates and units:** the rate is the bill's, never the price list's. A line may be in any unit the product has
    a conversion for, as at the POS.
- **Tax.** One `PurchasePricing` builds the GST engine input for both `purchases.quote` and `purchases.create`, so the
  form and the saved document can never disagree (as `SalePricing` does).
  - **Engine inputs:**
    - `supplierStateCode` = the supplier's state, place of supply = the branch's state;
    - `taxScheme` = the supplier's scheme, so composition and unregistered suppliers produce no tax;
    - document type = tax invoice or bill of supply by that scheme;
    - `roundToRupee` = false, because rounding is the bill total's job.
  - **GST rate:** defaults to the product's; a line may override it, because the bill is what was charged. The
    override is stored on the line, and the product is not changed.
  - **Tax treatment** comes from the product.
- **Input tax credit.** Eligible by default. It is never eligible when the supplier is composition or unregistered, or
  when the **business** is not on the regular scheme: composition dealers cannot claim ITC, so all their purchase
  tax is cost. A line can be marked ineligible (blocked credits, s.17(5)). The header's `itc_paise` is the eligible
  tax.
- **Bill total.** `billRoundOff(computed, billTotalPaise)`. Within ±₹1 the difference is the round-off; beyond it,
  `VALIDATION_FAILED` on `billTotalPaise` with the computed total in the message.
- **Landed cost.** `landedValues` over the lines with the charges. Each line stores `charges_paise`,
  `landed_value_paise` and `unit_cost_paise` = `divRound(landed × 1000, base qty)`. The product's purchase price is
  **not** updated: the stock level's last unit cost already serves as the fallback, and catalog edits stay explicit.
- **Dates.**
  - **Document date:** today's business date.
  - **Supplier invoice date:** may be earlier, never later than today. It decides the FY for the duplicate check and,
    in Stage 6, the ITC period.
  - **Due date:** `dueDate` if given, else the supplier invoice date + the supplier's credit days.
- **Numbering (ADR-0028).** Purchases and debit notes are numbered per terminal and FY, as sales are (ADR-0014), so
  devices never collide offline. Debit notes are GST documents (Rule 53) and share the 16-character cap. With a
  4-character terminal prefix there is no room for a fourth separator, so the kind letter joins the prefix and the
  sequence is 5 digits: `T1P/2627/00001` for a purchase, `T1D/2627/00001` for a debit note (99,999 per terminal per
  FY). A domain `formatDocNumber(prefix, kindLetter, fy, seq)` sits beside `formatInvoiceNumber`.
- **Repeat safety.** `purchases.create` and `purchases.return` carry a client-minted `commandId`, like
  `sales.complete`. Migration **`0007_purchase_commands`** adds `command_id` with a unique index to `purchase` and
  `debit_note`. `0006` is not edited, because a database that already ran it would never see the change.
- **What `purchases.create` writes, in one transaction:**
  1. header, lines, charges;
  2. one `purchase` movement per line through `postMovement`, at its landed value;
  3. the supplier ledger entry (−total, due date);
  4. audit;
  5. one outbox aggregate carrying the movements and the entry.

  Refused before anything is written:
  - a duplicate supplier invoice (same supplier, same FY, ignoring case) → `VALIDATION_FAILED` on
    `supplierInvoiceNo`, naming the existing purchase;
  - an inactive or unknown product, a unit the product does not have, or a quantity below 0.001 base units →
    per-line field errors.
- **Debit notes** (`purchases.return`, ADR-0024). Input: `purchaseId`, `lines[{ purchaseItemId, qtyMilli }]` in the
  line's unit, `reason`, optional `refundCharges` (default false), `commandId`.
  - **Amounts:** each returned line's taxable, tax and landed value are its share of the original line
    (`divRound(x × q, line qty)`). The return that brings a line to its full quantity takes the exact remainder, so
    all returns of a line add up to the line.
  - **What the supplier owes back:** taxable + tax, plus the line's share of the charges only when `refundCharges` is
    set. The rest of the landed value (the charges' share) is a loss on the return, which Stage 6 posts. It is not
    stored separately; it is landed value − taxable − ineligible tax − refunded charges.
  - **Tax:** the same supply type as the purchase. `itc_reversed_paise` is the eligible part of the returned tax.
  - **Stock:** one `purchase_return` movement per line through a new `postMovement` path. It carries
    `returnValuePaise` and calls `returnToSupplier`; replay maps `purchase_return` to the engine's `return` kind.
  - **Party:** a supplier ledger entry (+total), then automatic allocation to its purchase up to what the purchase
    still owes. The rest is an unallocated credit from the supplier.
  - **Refusals:** the trigger already refuses returning more than was bought (`RETURN_QTY_EXCEEDED`). The service
    checks first so the error names the line.
- **Cancel** (`purchases.cancel`, reason required, `purchases.cancel` permission). Refused while anything is
  allocated to the purchase or while it has a debit note; the debit notes are corrected first, and debit-note
  cancellation is out of 5c. Otherwise:
  - status → `cancelled`;
  - every line's quantity leaves at its landed value through the same return path (`ref_type` `purchase_return`,
    `ref_id` = purchase, `ref_line_id` = line);
  - a `cancel` ledger entry reverses the purchase's entry;
  - audit and outbox `cancel`.
- **Stock below zero on a return or cancel** follows the negative-stock policy (ADR-0020). `block` refuses with
  `STOCK_INSUFFICIENT`; `warn` and `allow` go ahead, and a below-zero result writes a `stock.negative` audit row,
  as a sale does.
- **Import of purchase lines** (`purchases.importLinesPreview`). It reuses `tableReader`, `columnMapping` and
  `PreviewStore`, like the opening-stock import.
  - **Columns:** SKU or barcode (required), qty (required), unit code (optional, default base unit), rate
    (required), GST % (optional), discount % (optional).
  - **Output:** ready-made `PurchaseDraft` lines plus per-row errors. There is no commit: the user reviews the lines
    in the form, and saving is always `purchases.create`.
- **IPC.**
  - **Purchases:** `purchases.quote / create / get / list / return / cancel / importLinesPreview`.
  - **List filters:** supplier, date range, status; keyset-paged.
  - **Permissions:** view `purchases.view`; quote, create, return and import `purchases.create`; cancel
    `purchases.cancel`.
  - **Sync entity types:** `purchase` and `debit_note` added.
- **Tests.**
  - **Stock and cost:** stock rises at landed cost, charges spread by taxable value, and a sale costed provisionally
    is corrected.
  - **Tax:** inter-state gives IGST; a composition supplier gives no tax and full cost; a composition *business*
    capitalises tax; an ineligible line goes into cost.
  - **Bill total:** accepted within ±₹1 and refused beyond, with the field named.
  - **Duplicates and repeats:** a duplicate supplier invoice is refused (and accepted after cancel); a repeated
    `commandId` returns the first purchase.
  - **Debit notes:** proportional amounts and exact remainders over several returns; auto-allocation and the
    excess left as credit; stock leaves at landed cost, not the average; over-return refused with the line named.
  - **Cancel:** refused while paid or returned; otherwise stock and ledger are reversed.
  - **Negative stock:** a return under `block` is refused.
  - **Failure:** a failure part-way leaves no row behind.
  - **Import preview:** matching by SKU and barcode, unknown units, bad numbers.
  - **Always:** every test ends with `reconcilePartiesDb` clean and `replayCheck` empty.
- **Not in 5c:** screens (5f), purchase orders and GRN, debit-note cancellation, updating the product's purchase or
  selling price from a bill, and TDS/TCS.

**5d — Payments, allocation, write-off, expenses**
8. `PaymentService`: receipts and supplier payments, auto/manual allocation, advances, later allocation, cancel
   (voids allocations, reverses the entry). Write-off. `ExpenseService` with the cash-drawer link and credit
   expenses.

5d details (drafted 2026-10-03, for review before building):

- **Payments** (`payments.create`). Input:
  - `partyType`, `partyId`, `amountPaise`, `paymentDate` (default today, never later), `method` (cash / upi / card /
    bank / cheque / other), `reference`, `note`;
  - `allocation` — either `'auto'` (default) or a chosen list `[{ type, id, amountPaise }]`;
  - `commandId`.

  A customer pays in (a receipt, numbered `T1R/2627/00001`); the business pays a supplier out (`T1Y/…`), as the
  table's CHECK already requires. Refunding an advance comes later.
  - **Allocation:** in the payment's transaction, `allocateOldestFirst` over the party's open charges, or
    `allocateAsChosen` for the user's choice. What is left is an advance and shows as one in outstanding.
  - **What is written:** a ledger entry (customer −amount, supplier +amount, dated the payment date) and one outbox
    aggregate (payment + allocations + entry).
  - **Who may:** receiving needs `payments.create` and `customers.view`. Paying a supplier needs `payments.create`
    and `suppliers.view`, so a cashier (who has no `suppliers.view`) can take a customer's payment but cannot pay
    suppliers.
- **Cash and the drawer.** The register's expected cash only counts `cash_in`, `cash_out` and `safe_drop`, so a cash
  payment on a terminal with an open register writes one of those, with `ref_type`/`ref_id` pointing at the document:
  a customer's cash receipt is `cash_in`, a cash payment to a supplier or a cash expense is `cash_out`. With no
  register open, the cash is taken to be outside the drawer and no movement is written. No change to the X/Z
  arithmetic.
- **Later allocation** (`payments.allocate`, `payments.create`). It applies a party's unallocated credit to its open
  charges, `auto` or chosen. The credit may be a payment, debit note or opening advance. Each new allocation is an
  `allocation` aggregate in the outbox.
- **Open items** (`payments.openItems`, `payments.view`): `{ charges, credits }` for one party, from the 5b
  `openItems` query, so the allocation grid shows exactly what can be settled.
- **Cancelling a payment** (`payments.cancel`, `payments.cancel` permission, reason required):
  - voids its live allocations (the triggers give the amounts back to both documents);
  - sets the status to `cancelled`;
  - writes a `cancel` ledger entry;
  - for cash, writes the opposite drawer movement if the register it came from is still open; otherwise none, and
    the audit row says so.
- **Write-off** (`payments.writeOff`, `payments.approve`). Input: `customerId`, chosen open charges with amounts,
  `reason`, `commandId`. It is fully allocated at once, writes a ledger entry (−amount) and is audited. It has no
  number (internal document). Stage 6 posts it to 5470 Bad Debts.
- **Expense categories:** seeded on first use per business, each mapped to an LLD §5.1 account:
  - Rent 5400, Salaries 5410, Electricity 5420, Transport 5430, Internet 5440, Repairs 5450, Bank charges 5460,
    Other 5900.
  - Read with `expenses.listCategories`. Adding categories comes later.
- **Expenses** (`expenses.create`, numbered `T1E/…`). Input:
  - `categoryId`, `expenseDate` (never later than today), `description`, `method` (the payment methods plus
    `credit`), and an optional `supplierId` or free-text vendor name and GSTIN;
  - `amountPaise` with `amountIsInclusive`, an optional `gstRateBp`, and `commandId`.
  - **Tax:** when a GST rate is given, the bill must carry a GSTIN (the supplier's or the vendor's). The single line
    goes through the GST engine with the vendor's state against the branch's. With no rate, the whole amount is the
    expense.
  - **ITC:** eligible only when the business is regular and a GSTIN is present; `itcEligible` can turn it off.
  - **On credit:** needs a supplier. The due date is the expense date plus the supplier's credit days, and the
    expense is a charge on that supplier's ledger.
  - **Cash with a register open:** writes a `cash_out`.
- **Cancelling an expense** (`expenses.cancel`, `expenses.cancel`): refused while anything is allocated to it.
  Otherwise it reverses the ledger entry (credit expenses) and the drawer movement (cash, register still open).
  `expenses.update` stays replaced by cancel and re-create.
- **Repeat safety:** migration `0008_payment_commands` adds a unique, frozen `command_id` to `payment`, `write_off`
  and `expense`.
- **Lists:** `payments.list` (party, direction, dates, status) and `expenses.list` (category, dates, status),
  keyset-paged, plus `payments.get` and `expenses.get`.
- **Sync entity types:** `payment`, `write_off`, `expense` and `allocation`.
- **Tests:**
  - **Receipts:** settle the oldest due first and leave the rest as an advance. A chosen allocation is honoured, and
    one over the item or the payment is refused.
  - **Later allocation:** an advance applied to a later credit sale or purchase.
  - **Cancel:** gives the amounts back to both documents and reverses the ledger.
  - **Drawer:** a cash receipt and a cash supplier payment move the register's expected cash; with no register, no
    movement.
  - **Permissions:** a cashier can receive but not pay a supplier, and cannot write off.
  - **Write-off:** clears the chosen items.
  - **Expenses:** a cash expense with GST and ITC; a credit expense on the supplier's ledger, paid later by a supplier
    payment; refused GST without a GSTIN; cancel refused while paid.
  - **Repeats:** a repeated command returns the first document.
  - **Always:** every test ends with `reconcilePartiesDb` clean.
- **Not in 5d:** screens (5f), printing a payment receipt, refunding a customer's advance, custom expense
  categories, cheque clearing and bank reconciliation, and TDS.

**5e — Credit at the POS**
9. `credit` tender, quote outstanding and limit issue, commit refusal / audited override, customer ledger entry in the
   sale's transaction (a new commit step after `document`, ADR-0019's order otherwise unchanged). Receipts print the
   credit portion and new outstanding. Kill -9 suite adds credit sales and checks reconciliation after the kills.

5e details (drafted 2026-10-04, for review before building):

- **The `credit` tender.**
  - **Contracts and domain:** `TENDER_METHODS` and the domain `TenderMethod` gain `credit` (the `sale_tender` CHECK
    already allows it).
  - **Rules:** at most one credit line per bill, and only with a customer on the bill; otherwise
    `VALIDATION_FAILED` on `tenders`.
  - **Settlement:** `settleTenders` treats credit like any non-cash tender, so it can never exceed the bill, and
    change still comes only from cash.
  - **What is stored:** the sale stores `paid_paise` = what was paid now (tenders − credit), `credit_paise` = the
    credit line, and `due_date` = sale date + the customer's credit days. The table's CHECK
    `paid − change + credit = total` already holds them together. The credit tender row is kept as well, so the Z
    report's by-tender list shows credit sales, and expected cash is untouched.
- **The credit limit** (ADR-0026, user decision 2026-10-03).
  - **Checked at the commit,** where the tenders are known: the customer's ledger balance plus this bill's credit
    portion must not exceed `credit_limit_paise`.
  - **No limit set** (`NULL`) counts as a limit of ₹0, so any credit needs the override. That keeps "no limit" from
    ever meaning "unlimited", and still lets a manager give a regular customer credit before a limit is set.
  - **Over the limit:** `CREDIT_LIMIT_EXCEEDED`, naming the balance, the limit and the shortfall, unless the user
    holds `customers.approve`. Then the sale goes through and a `credit.limit_override` audit row (balance, limit,
    credit given, approver) is written in the sale's transaction.
  - **Manager PIN override** stays deferred, so a cashier must ask a manager to log in or bill it.
- **What the quote shows.** The quote has no tenders, so it cannot refuse. It returns, when a customer is on the
  bill, `credit: { balancePaise, limitPaise | null, availablePaise }` so the payment screen can warn before the
  cashier tries. This differs from ADR-0026's "a `credit_limit` issue in the quote"; an amendment note goes in the
  ADR.
- **The sale commit** gains one step, `party`, after `stock`: number → cost → document → stock → **party** →
  receipt → record. It writes the customer ledger entry (+credit, due date) through `postPartyEntry`. The sale's
  outbox aggregate carries the entry with the movements. Sales without credit skip it, so their path is unchanged.
- **Receipt.** `ReceiptDoc` gains an optional `credit` block: amount on credit, due date, and the customer's balance
  after this bill. It prints under the tenders as "On credit ₹X — due DD-MM-YYYY" and "Balance now ₹Y". Reprints
  stay byte-identical, because the doc is stored at sale time (FR-100).
- **Payment dialog.** The credit row appears only when a customer is on the bill. It shows the available credit
  from the quote and keeps the server's refusal message. This is the only renderer change in 5e; the rest of the
  screens are 5f.
- **Crash and speed.** The kill -9 suite mixes in credit sales and checks, after the kills, that every credit sale
  has exactly one ledger entry and `reconcilePartiesDb` is clean. The perf test keeps `sales.complete` p95
  < 250 ms with a credit sale.
- **Tests:**
  - **Split payment:** a sale partly on credit stores paid, credit and due date, writes one entry, and the
    customer's statement and outstanding show it.
  - **Refusals:** credit without a customer; two credit lines; credit over the bill.
  - **Limit:** over the limit, a cashier is refused with the numbers and nothing is written. A manager goes through
    with an override audit row. A customer with no limit needs the override for any credit. An advance on account
    counts toward the room.
  - **Paying it off:** a later receipt (5d) settles the credit sale oldest-first.
  - **Z report:** shows the credit tender and expected cash ignores it.
  - **Receipt:** prints the credit block.
  - **Repeats:** a repeated command returns the first sale with no second entry.
  - **Always:** every test ends with `reconcilePartiesDb` clean.
- **Not in 5e:** cancelling or returning a credit sale (sale cancel and credit notes stay deferred from Stage 3),
  manager PIN override, payment reminders, and interest on overdue amounts.

**5f — Screens**
10. `/suppliers` (list, edit, ledger); `/purchases` (list, new invoice with charges, ITC flags, bill-total check and
    import from file; return against an invoice); `/payments` (receive / pay with the allocation grid, advances,
    write-off); `/expenses`; customer ledger and outstanding with ageing; POS credit tender and limit message; Home
    cards for receivables and payables due. Pure helpers (allocation grid, bill-total difference) with node tests.

5f details (drafted 2026-10-04, for review before building):

- **Navigation.** The disabled "Purchases (Stage 5)" item becomes four live items: **Purchases**, **Payments**,
  **Expenses** and **Parties** (customers and suppliers).
- **What the screens know about permissions.** The renderer cannot see permissions today; it relies on the server
  refusing. For Stage 5 screens that would show a cashier menus that only fail, so the `Session` the renderer
  receives gains `permissions: Permission[]` — the user's grants, without limits. It is used only to hide menu items
  and buttons. Main stays authoritative and checks every call exactly as now.
- **Parties** (`/parties`):
  - **The list:** tabs for Customers and Suppliers, with search and each party's balance (from `getOutstanding`).
  - **Forms:** add and edit a supplier (GST details, credit days) and a customer (credit days).
  - **Party page** (`/parties/customer/:id`, `/parties/supplier/:id`):
    - the statement, with a date range, running balance and paging;
    - the party's ageing buckets and open items;
    - actions: receive payment or pay, apply credit (`payments.allocate`), set opening balance, set credit limit
      (only with `customers.approve`), write off (only with `payments.approve`).
  - **Outstanding** (`/parties/outstanding`): receivables and payables by ageing bucket with totals, as of a chosen
    date.
- **Purchases** (`/purchases`):
  - **The list:** supplier, date range and status filters.
  - **New purchase:**
    - **Header:** a supplier picker, invoice number and date, and the due date shown from the supplier's credit days
      (editable).
    - **Line grid:** product picker, unit, qty, rate, inclusive toggle, discount, GST rate (defaulted, editable) and
      an ITC tick.
    - **Bill level:** bill discount, charges, and the **bill total** box.
    - **Live quote:** a debounced `purchases.quote` shows tax, landed cost per line and the bill-total difference
      (green within ±₹1, red beyond), and Save is disabled until it fits.
    - **Import from file:** fills the grid and lists bad rows.
    - **Save:** uses one `commandId` per form, as the POS does, so a retry never books twice.
  - **Purchase page:** lines with landed and unit cost, charges, debit notes, and settled vs owed.
    - **Return goods:** a dialog with qty per line, reason and "supplier refunds freight".
    - **Cancel:** reason required; the button is hidden while the purchase is paid or returned.
- **Payments** (`/payments`):
  - **The list:** filters.
  - **New payment** (from the menu, or prefilled from a party page):
    - party, amount, method, date and reference;
    - the **allocation grid** of the party's open items, defaulting to **Auto**, which previews oldest-first
      client-side with the same domain `allocateOldestFirst` the server uses;
    - switching to **Choose** lets the user type amounts per item, with the running total, the remaining advance and
      the over-allocation errors shown before saving.
  - **Payment page:** its allocations, and cancel with a reason.
- **Expenses** (`/expenses`):
  - **The list:** category, date and status filters.
  - **New expense:** category, date, method, amount and an inclusive toggle, an optional GST rate (shown only when a
    supplier or vendor GSTIN is given), ITC tick, and supplier (required for credit) or free-text vendor.
  - **Cancel:** with a reason.
- **Home.** Two new cards, each shown only to users who may see it:
  - **Receivables:** total owed, and how much is over 30 days.
  - **Payables:** total, and how much is due within 7 days or overdue.

  The "Inventory stage" note becomes a short "what's new in Stage 5" line.
- **Pure helpers with node tests** (`lib/purchases`, `lib/payments`, `lib/parties`), keeping the screens thin:
  - purchase form ↔ `PurchaseDraft`, with parse errors per field;
  - the bill-difference label;
  - the allocation-grid state (auto preview, manual edits, totals, advance, errors);
  - expense form → `ExpenseInput`;
  - ageing row formatting;
  - credit-limit form (empty = no limit).
- **How it is checked.** As in Stages 2–4: typecheck, build, and node tests of the helpers, plus the IPC tests
  already behind every call. There is no Playwright run of the Electron UI; it stays a carried-forward note, and the
  screens are not claimed as clicked through. A manual checklist goes in the plan for the user.
- **Delivery.** Two commits rather than one, because the screen work is large:
  - **5f-1:** session permissions, parties, payments and Home cards;
  - **5f-2:** purchases and expenses.
- **Not in 5f:** printing a payment receipt or debit note, report exports (Stage 8), custom expense categories, a
  Playwright suite, and POS changes beyond 5e's credit row.

5f manual checklist (run `pnpm --filter @muneem/desktop dev`; not yet done — the screens are checked by typecheck,
build and helper tests only):

1. **Menus:** as owner, Purchases, Parties, Payments and Expenses are in the menu. Switch to a cashier: only Parties
   (customers) and Payments show, and the Suppliers tab is hidden.
2. **New supplier:** add one with a GSTIN; the state fills from it. Give it 30 credit days and a ₹1,000 opening
   balance.
3. **New purchase:**
   - two lines, one in boxes, with ₹100 freight;
   - type a bill total ₹2 off: Save stays disabled with "Off by…";
   - correct it, save, and see the purchase page's landed costs.
4. **Import lines:** a CSV with one bad row fills the good lines and lists the bad one.
5. **Return goods:** return part of a line, and see the debit note settle the purchase and the supplier's statement.
6. **Pay the supplier:** auto shows oldest first. Switch to Choose, over-type an item, see the error, then save.
7. **Credit:** give a customer a credit limit, sell partly on credit at the POS, and check the receipt lines and that
   the customer's page shows the sale.
8. **Expense:** add one with a vendor GSTIN (the GST box appears), on cash with the register open. The X report's
   expected cash drops by the amount.
9. **Home:** check both cards and the outstanding report totals.

**5g — Close-out**
11. Golden flow extended: supplier opening → purchase with freight → sale partly on credit → receipt allocated →
    debit note → supplier payment → reconciliation and stock valuation checked. Integrity check and the 6-hourly
    timer run `reconcileParties`. Perf: `purchases.create` with 200 lines and `payments.create` allocating over 500
    open items within budget; `sales.complete` p95 still < 250 ms with the credit step. Docs: build-stages Stage 5 →
    Done with numbers, architecture (Parties section + invariants), LLD §10.2 surface, CHANGELOG, plan "as built".

5g details (drafted 2026-10-04, for review before building):

- **Golden flow, parties** (`apps/desktop/test/goldenFlow.test.ts`, offline like the Stage 3 one). It runs through
  IPC with the network down:
  1. supplier with a payable opening;
  2. purchase with freight (stock received at landed cost);
  3. register opened;
  4. sale partly on credit to a customer with a limit;
  5. receipt that settles the credit sale and leaves an advance;
  6. debit note for part of the purchase;
  7. supplier payment, oldest first: the opening, then the purchase;
  8. cash expense;
  9. Z report.

  It checks:
  - the party ledgers through both statements and outstanding;
  - `reconcilePartiesDb` clean and `replayCheck` empty;
  - valuation balanced;
  - expected cash = opening + cash sales + cash receipt − cash payment − expense;
  - every document's outbox row carries its ledger entry.
- **Integrity check.**
  - **What it adds:** `diagnostics.integrityCheck` gains `parties: 'ok' | 'mismatch' | 'not_run'` and runs
    `reconcilePartiesDb`. The 6-hourly timer runs it too.
  - **No auto-heal:** unlike stock levels, party entries are not a cache — they are the record — so a mismatch is
    logged as `PARTY_LEDGER_MISMATCH` with the parties, documents and faults, and reported in `detail`.
  - **Diagnostics screen:** shows the new line.
  - **Tests:** a planted bad entry makes the check report `mismatch` and log it, and a clean database reports `ok`.
- **Speed** (`test/perf/parties.perf.test.ts`, alongside the sales perf test):
  - `purchases.create` with 200 lines: p95 over 20 bills < 1 s;
  - `payments.create` auto-allocating over 500 open items: p95 < 250 ms;
  - `reconcilePartiesDb` with 10,000 documents and their entries: < 2 s, so the 6-hourly run never stalls the till.

  The numbers measured go into build-stages.
- **No new crash child.** Purchases, payments and expenses are single transactions, and the "a failure part-way leaves
  nothing" tests already cover them. The sale is the only multi-step commit that touches printing and the drawer, and
  the kill -9 suite already mixes in credit sales. If you want a kill -9 child for purchases and payments too, it is
  a small addition.
- **Docs close-out:**
  - **`docs/build-stages.md`:** Stage 5 → Done with the evidence (domain property runs, DB reconciliation in every
    party test and after the kills, golden flow, timings). Carried-forward notes for Stages 6, 7 and 8, and the
    deferred list.
  - **`docs/architecture.md`:** a **Parties and purchases (Stage 5)** section (sub-ledger, allocation, purchases and
    landed cost, debit notes, credit sales, the drawer rule), the new invariants, and "What is not built yet"
    rewritten.
  - **This plan:** an "As built" section listing every change from the plan:
    - `allocation` generalised;
    - the costing fix (ADR-0027);
    - numbering (ADR-0028);
    - migrations 0007/0008;
    - the credit-limit split;
    - session permissions;
    - the payables card;
    - the perf timeout;
    - the screens not yet clicked through.
  - **CHANGELOG:** the 5g lines.
- **Then review, before any push.** As with Stages 3 and 4, a review pass of the whole stage diff follows. Fixes land as
  5h commits, after which the branch is ready for you to push and open the PR. The manual UI checklist (5f) is yours
  to run before or during that review.
- **Not in 5g:** the GL tie-out to 1300/2100 (Stage 6), sync endpoints (Stage 7), and payment reminders (Stage 8).

## Verification

- `pnpm turbo run gen build typecheck lint test`, `pnpm schema-lint`, Go job green.
- Exit criterion evidence: domain reconciliation property (fast-check); DB-level `reconcileParties` after purchase,
  return, payment, write-off, cancellation and credit-sale tests and after the kill -9 suite; Σ allocations ≤ payment
  as a CHECK and a property. GL tie-out to 1300/2100 recorded as a Stage 6 item.
- Manual (`pnpm --filter @muneem/desktop dev`): add a supplier, enter a purchase with freight, see stock and cost
  rise; sell on credit past the limit and see the refusal; receive a payment and allocate it; return goods to the
  supplier; check both party ledgers.

## Carried to later stages

- Stage 6: post purchases, debit notes, payments, write-offs, expenses and opening balances; tie Σ party balances to
  1300 / 2100; add 5470 Bad Debts to the CoA seed.
- Stage 7: Go port of `allocate` with shared fixtures before the cloud verifies payments (ADR-0001, as `resolvePrice`);
  supplier and purchase sync endpoints.
- Stage 8: payment reminders with consent capture; payables and receivables reports and exports.
- Deferred: purchase orders, GRN and three-way matching; reverse-charge self-invoice; TDS/TCS.

## 5h — review fixes (planned 2026-10-04)

All ten review points were checked against the code (two by a probe on a 3,000-purchase database). Nine are worth
fixing before the PR, one is documented instead, and the probe found one more bug (point 11).

**5h-1 — data loss and access (worst for shops)**

1. **Editing a customer wipes saved details** — confirmed.
   - **Cause:** `CustomerForm` carries only name, phone, GSTIN and credit days, and `updateCustomer` writes every
     field, so email, address, city, PIN and a manually set state become blank.
   - **Fix:** the form carries all of the customer's fields, and the dialog shows email, address, city, PIN and state
     (state only when there is no GSTIN).
   - **Test:** a helper round-trip proves an edit keeps every field.
2. **A new owner can't see the Stage 5 screens until they log in again** — confirmed.
   - **Cause:** `business.create` patches the session with the owner role but leaves `permissions` as the empty list
     from login.
   - **Fix:** the patch also sets the owner preset's permissions.
   - **Test:** right after setup, `auth.getSession` lists `purchases.view`.
3. **Importing a supplier file with more than 20 lines fails** — confirmed. The screen calls `products.get` once per
   line at the same moment, and the limit is 20 a second.
   - **Fix:** `purchases.importLinesPreview` also returns the products it matched (each once), so the screen needs no
     further calls.
   - **Test:** a 30-line file through IPC.
11. **The series list breaks after the first purchase** — found by the probe. `settings.listSeries` fails output
    validation, because the `DocSeries` contract allows only 1–4 character prefixes (purchase series are `DE01P`) and
    its doc types lack `expense`.
    - **Fix:** the contract accepts a terminal prefix plus kind letter and the `expense` type.
    - **Test:** listing series after a purchase and an expense.

**5h-2 — wrong numbers and a fragile series rule**

4. **New Purchase rows show another line's figures** — confirmed. The quote leaves out lines with problems, and the
   screen reads `quote.lines[i]` by position.
   - **Fix:** each quote line carries `draftLineNo`, and the screen matches by it.
   - **Test:** a quote with a bad first line returns the second line as `draftLineNo` 2.
6. **A full return leaves up to ₹1 owed** — confirmed. The debit note never carries the purchase's round-off.
   (Cancel is blocked anyway once a debit note exists; the real harm is the stray balance.)
   - **Fix:** the debit note that completes the return of every line takes the purchase's round-off (the column and
     its ±₹1 CHECK already exist).
   - **Test:** a full return with freight refunded leaves the purchase owing exactly ₹0. Without the refund it still
     owes the freight, which is intended.
7. **Reverse-charge purchases still add GST to the bill and the supplier's balance** — confirmed. Doing reverse
   charge properly means the bill total and AP exclude the tax while the business books it both as output and as input
   tax; that needs schema and Stage 6 work.
   - **Fix:** refuse `isReverseCharge: true` with a clear message until then (no screen sends it), and amend ADR-0023,
     whose "stored flag only" was wrong.
   - **Test:** the refusal.
9. **A sale series with pad width 5 makes every sale on that terminal fail** — confirmed. `allocateDocNumber` picks
   the format by `pad_width`, and `settings.createSeries` accepts widths 3–10 for any type.
   - **Fix:** pick the format by `doc_type` (sale types → invoice format, others → kind-letter format).
   - **Test:** a pre-created width-5 sale series still bills.

**5h-3 — ageing "as of" a past date**

5. **A past date counts later payments and cancellations** — confirmed. `partyOutstanding` filters documents by date
   but uses today's `settled_paise` / `allocated_paise` and today's status.
   - **Migration `0009_allocation_dates`:** adds `allocated_on` and `voided_on` business dates to `allocation`.
     - Set on new rows: an allocation made with its document takes the document's date; a later one takes the day it
       is made; a void takes the day it is voided.
     - Existing rows: backfilled from their timestamps.
   - **As of a date D:** a document counts if its date ≤ D and it has no `cancel` ledger entry dated ≤ D. Its open
     amount uses only allocations with `allocated_on ≤ D` and not voided by D. Today's report gives the same numbers
     as now.
   - **Tests:** as of a date before a payment, the bill is fully open; after it, settled; a payment cancelled later
     still counts on the earlier date.
   - **Alternative, if you'd rather keep 5h small:** hide the "as of" picker (today only) and do this in Stage 8 with
     the reports.

**5h-4 — statements on large shops**

10. **Each statement page and each `payments.get` reads every document of every party** — confirmed, but small
    today: 13 ms per statement page and 3 ms per `payments.get` at 3,000 purchases. The query plan materialises all
    documents and builds a temporary index each time, so the cost grows with the shop's total documents, not the
    party's.
    - **Fix:** fetch document numbers only for the rows on the page, with indexed lookups per type, in
      `partyStatement` and `allocationsOfSource`. `openItems` and `partyOutstanding` filter the union by party or type
      inside it.
    - **Test:** a perf test at 20,000 documents (statement page < 20 ms), and the existing tests prove the results are
      unchanged.

**Documented, not changed**

8. **Purchase FY versus number FY near 31 March** — real, but intended.
   - **Why both are right:** `purchase.fy` is the supplier bill's FY. It drives the duplicate-invoice rule and, in
     Stage 6, the ITC period. The internal number, like every document number, uses the FY in which the bill is
     entered.
   - **The real decision** is which period a late-entered March bill is posted to, which belongs to Stage 6.
   - **Action:** an ADR-0023 note and a build-stages carry-forward. Changing it now would pre-empt that decision.

**Delivery:** four commits (5h-1 … 5h-4), each green with changelog lines. Every touched test still ends with the
party ledgers reconciled.

## As built (2026-10-04)

- **`allocation` replaces LLD's `payment_allocation`.** Debit notes, write-offs and opening advances settle documents
  too. Triggers keep both documents' totals and refuse over-allocation, cross-party allocation and allocation to
  cancelled documents (ADR-0025).
- **Cancelling a purchase issues no debit note.** It reverses stock at landed cost and the ledger entry, and is
  refused while the purchase is paid or returned. Returned quantities are summed from debit-note lines, not stored.
- **Costing fix found on the way (ADR-0027):** an issue that leaves stock on hand takes its share of the value. The
  rounded per-unit average over-costed cheap items and could leave negative value on positive stock. The costing
  property now draws unit costs up to ₹1 lakh per base unit.
- **Numbers** carry a kind letter after the terminal prefix with 5 digits (ADR-0028). Migrations `0007` and `0008`
  add command ids, because `0006` could not be edited once run.
- **The open-items query covers every document type from 5b,** so later parts only wrote documents.
- **Customer search with an empty query lists everyone,** as supplier search does.
- **Credit limit (ADR-0026, amended):** enforced in the sale commit, with the quote only reporting the room. No limit
  set counts as ₹0. The balance is the ledger balance, so advances add room.
- **Paying a supplier also needs `suppliers.view`.** Cash through an open drawer moves expected cash (ADR-0029).
- **The session carries permissions** for the screens; main stays authoritative.
- **Home payables card** shows overdue amounts, not "due within 7 days" (the buckets cannot split the next 7 days).
- **Speed tests** have an explicit 60 s test timeout. Their p95 budgets are unchanged.
- **No crash child for purchases or payments.** They are single transactions with "failure leaves nothing" tests, and
  the sale crash suite mixes in credit sales.
- **The integrity check reports party mismatches** (`PARTY_LEDGER_MISMATCH`) and never rewrites entries.
- **Screens are not clicked through.** They are checked by typecheck, build and helper tests; the 5f manual checklist
  is for the user.
- **Review fixes (5h, user-reviewed list), all four parts done:**
  - customer edits keep every field;
  - the owner's permissions come with setup;
  - the import returns its products;
  - series accept kind-letter prefixes;
  - quote rows carry `draftLineNo`;
  - a full return takes back the round-off;
  - reverse charge is refused;
  - number format is by document type;
  - allocations carry business dates for as-of ageing (migration 0009);
  - party queries read one party (migration 0010).

  The year difference near 31 March (#8) is documented in ADR-0023 for Stage 6.
