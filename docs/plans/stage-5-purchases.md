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

**5d — Payments, allocation, write-off, expenses**
8. `PaymentService`: receipts and supplier payments, auto/manual allocation, advances, later allocation, cancel
   (voids allocations, reverses the entry). Write-off. `ExpenseService` with the cash-drawer link and credit
   expenses.

**5e — Credit at the POS**
9. `credit` tender, quote outstanding and limit issue, commit refusal / audited override, customer ledger entry in the
   sale's transaction (a new commit step after `document`, ADR-0019's order otherwise unchanged). Receipts print the
   credit portion and new outstanding. Kill -9 suite adds credit sales and checks reconciliation after the kills.

**5f — Screens**
10. `/suppliers` (list, edit, ledger); `/purchases` (list, new invoice with charges, ITC flags, bill-total check and
    import from file; return against an invoice); `/payments` (receive / pay with the allocation grid, advances,
    write-off); `/expenses`; customer ledger and outstanding with ageing; POS credit tender and limit message; Home
    cards for receivables and payables due. Pure helpers (allocation grid, bill-total difference) with node tests.

**5g — Close-out**
11. Golden flow extended: supplier opening → purchase with freight → sale partly on credit → receipt allocated →
    debit note → supplier payment → reconciliation and stock valuation checked. Integrity check and the 6-hourly
    timer run `reconcileParties`. Perf: `purchases.create` with 200 lines and `payments.create` allocating over 500
    open items within budget; `sales.complete` p95 still < 250 ms with the credit step. Docs: build-stages Stage 5 →
    Done with numbers, architecture (Parties section + invariants), LLD §10.2 surface, CHANGELOG, plan "as built".

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
