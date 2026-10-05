# Manual QA checklist (Stage 9j)

Every hand-run check written in the Stage 2–8 plans is listed here once, grouped by area. Each step is either
**automated** (a Playwright UI test drives the built Electron app; the test is named) or **manual** (still needs a
person, usually because it needs real hardware, Windows, a second machine or a real cloud).

The plans keep their original lists, each with a pointer here; this file is the one to run and fill in.

## How the automated UI suite runs

- `pnpm e2e:ui` (CI job `e2e-ui`, Ubuntu under `xvfb-run`) runs `apps/desktop/e2e/flows/*.spec.ts` with
  `@playwright/test` and `_electron.launch()` on `apps/desktop/out/main/index.js`. Build the app and its native SQLite
  binding first: `pnpm turbo run gen build --filter=@muneem/desktop...` and `pnpm --filter @muneem/desktop native`.
- **Temp profile:** each launch passes `--user-data-dir=<tmp>`, which also moves Electron's `userData` (database,
  receipts, logs), so nothing touches a real profile.
- **Stub cloud:** `e2e/support/stubCloud.ts` answers sign-in (an owner and a cashier), device registration and
  health inline, and serves `/sync/push` and `/sync/pull` from the reference sync server (ADR-0042). Like the Go
  cloud, sign-in lists the businesses synced so far. It can be switched off and on to test offline billing.
- **Printer:** the default printer is the simulator, which writes each receipt to `userData/receipts/*.txt|.bin|.html`.
  Tests read those files. **Save dialogs** are stubbed in the main process to write to a temp path.
- **Screen size:** the window is 1366×768 (NFR-023). Every main screen is captured to
  `apps/desktop/test-results/ui/*.png` (a CI artifact) and checked for no horizontal overflow
  (`document.documentElement.scrollWidth <= 1366`). The screenshots are not compared pixel by pixel.
- **Load:** one worker, no retries locally (one in CI); the full suite takes about 1.5 minutes, most of it in the two
  30-second connectivity probes of the offline spec.

| Spec | What it drives |
|---|---|
| `golden.spec.ts` | First-run setup → catalog (products with barcodes, CSV import, search) → opening stock → keyboard POS sale with receipt → hold/recall → customer credit sale → return/credit note → receipt payment → supplier with opening balance and a purchase with freight → stock adjustment → X and Z report → reports run + CSV export → GST returns + CSV export → Diagnostics (sync, backup, audit) → low-stock notification → books balanced → every main screen at 1366×768 |
| `keyboard.spec.ts` | The POS with no mouse: open register, F2 search + Enter, scan, Tab to quantity / line discount / Remove, F3, F4, Esc, F6, F7 + Enter, F5 + Enter, F9, Esc clears, Tab to cash in/out, X report and Close register |
| `offline.spec.ts` | Sale synced; cloud off → "● Offline", sale still saved and printed, badge "N waiting · offline"; sign out and sign in offline; cloud on → Sync now → "✓ Synced" |
| `roles.spec.ts` | A cashier on the owner's till: hidden menus, customers-only Parties, product create refused, over-limit discount refused at completion |

## Results

Fill one row per run. "Here" means the 9j run on Linux with simulated hardware (2026-10-05).

| Date | Tester | Machine / OS | Scope | Pass / fail | Notes |
|---|---|---|---|---|---|
| 2026-10-05 | qa agent (automated) | Linux, Xvfb, printer simulator, stub cloud | All automated steps below | Pass (33 UI tests) | Five UI bugs found and fixed (see "Bugs found in 9j") |
| | | Windows 10/11, real printer | Windows host section | | |
| | | | Manual steps (non-Windows) | | |

## Catalog (Stage 2)

| # | Step | Status | Where |
|---|---|---|---|
| 2.1 | Import a product file; search by barcode, by a partial English name and by a partial Hindi name in `/products` | Automated (3-row CSV) | `golden.spec.ts` › catalog |
| 2.2 | Import `fixtures/import/5000.csv` in the app and check the summary | Manual (the 5,000-row import is covered at service level by `import.test.ts`) | |
| 2.3 | Scan a barcode into `/products` with a USB scanner | Manual — Windows host | |
| 2.4 | Log in as a cashier and confirm create is denied | Automated | `roles.spec.ts` › creating a product is refused |

## POS and register (Stage 3)

| # | Step | Status | Where |
|---|---|---|---|
| 3.1 | Open the register | Automated | `keyboard.spec.ts` › open the register |
| 3.2 | Scan/type products, F-key flow to payment, complete | Automated | `golden.spec.ts` › POS golden flow; `keyboard.spec.ts` |
| 3.3 | Receipt file in `userData/receipts/` | Automated (simulator) | `golden.spec.ts`, `keyboard.spec.ts`, `offline.spec.ts` |
| 3.4 | Close register and read the Z report | Automated | `golden.spec.ts` › close the register; `keyboard.spec.ts` |
| 3.5 | Stop the cloud and bill again offline | Automated (stub cloud off) | `offline.spec.ts` |
| 3.6 | Same with the real Go API stopped | Manual (needs the Go API; `e2e-cloud` covers sync against it) | |
| 3.7 | 200-iteration `crash-loop --scenario sales` with its PASS output | Manual (long run; 20 iterations run in CI) | |

## Inventory (Stage 4)

| # | Step | Status | Where |
|---|---|---|---|
| 4.1 | Enter opening stock, sell, see stock fall | Automated | `golden.spec.ts` › opening stock, stock adjustment (stock 50 → 48) |
| 4.2 | See the product's ledger line after a sale | Manual | |
| 4.3 | Sell past zero and see the warning | Manual | |
| 4.4 | Do a stock take | Manual | |
| 4.5 | Valuation and low stock | Partly automated: low stock raises a notification; the valuation screen loads | `golden.spec.ts` › notifications bell, every main screen |

## Purchases, parties and payments (Stage 5, 5f list)

| # | Step | Status | Where |
|---|---|---|---|
| 5.1 | Owner sees Purchases, Parties, Payments, Expenses; a cashier sees only Parties (customers) and Payments, no Suppliers tab | Automated | `roles.spec.ts` |
| 5.2 | New supplier with a GSTIN fills the state; 30 credit days; ₹1,000 opening balance | Automated | `golden.spec.ts` › purchase with freight |
| 5.3 | Purchase with ₹100 freight; a bill total ₹2 off shows "Off by…" and Save stays disabled; correct it and save | Automated (one line in PCS) | `golden.spec.ts` › purchase with freight |
| 5.3b | A second line bought in boxes; the purchase page's landed costs | Manual | |
| 5.4 | Import purchase lines from a CSV with one bad row | Manual | |
| 5.5 | Return goods to the supplier (debit note settles the purchase and the statement) | Manual | |
| 5.6 | Pay the supplier: auto oldest first; switch to Choose, over-type, see the error, save | Manual | |
| 5.7 | Give a customer a credit limit, sell partly on credit at the POS, receipt lines and the customer's page | Automated | `golden.spec.ts` › customer credit sale |
| 5.8 | Receive a payment and allocate it | Automated (auto allocation) | `golden.spec.ts` › receive a payment |
| 5.9 | Sell on credit past the limit and see the refusal | Manual | |
| 5.10 | Expense with a vendor GSTIN on cash; the X report's expected cash drops | Manual | |
| 5.11 | Home: both cards and the outstanding report totals | Partly automated (Home and Outstanding load and fit) | `golden.spec.ts` › every main screen |

## Accounting (Stage 6, 6e list)

| # | Step | Status | Where |
|---|---|---|---|
| 6.1 | Accounts in the owner's menu, not a cashier's | Automated | `roles.spec.ts` |
| 6.2 | Chart of accounts: add "1210 HDFC Current", rename 1300, open a ledger | Manual | |
| 6.3 | After selling, buying with freight, a payment: Trial Balance "Balanced", P&L shows, Balance Sheet "Balanced" | Automated (expense not included) | `golden.spec.ts` › books |
| 6.4 | Manual journal (card settlement): Post disabled until balanced, 1300 not offered; reverse from the day book | Manual | |
| 6.5 | Lock last month, backdate a payment, see it under late postings | Manual | |

## Sync (Stage 7, 7g list)

| # | Step | Status | Where |
|---|---|---|---|
| 7.1 | Badge reads "✓ Synced · …"; clicking it opens Diagnostics | Automated (badge text) | `golden.spec.ts` › diagnostics; `offline.spec.ts` |
| 7.2 | Offline: badge "⚠ N waiting · offline"; back online it drains to Synced | Automated | `offline.spec.ts` |
| 7.2b | "· oldest N min" after a minute offline | Manual | |
| 7.3 | A permanent reject: degraded, then blocked after 12 tries; payload preview; manager Resend; cashier sees no Resend | Manual (needs a server-side reject; covered by `sync` vitest suites) | |
| 7.4 | A revoked device: "✕ Needs attention · device removed" | Manual | |
| 7.5 | Stock staleness line with a second terminal | Manual — two machines | |
| 7.6 | A price conflict between two devices under Review items; Mark reviewed | Manual — two machines | |
| 7.7 | Oversell from two offline terminals; Inventory → Reconciliation | Manual — two machines | |
| 7.8 | Sync now in Diagnostics starts a sync; cursors show the last pull | Automated (Sync now) | `golden.spec.ts` › diagnostics; `offline.spec.ts` |
| 7.9 | Setup "Add this device to an existing business" | Manual — two machines and a cloud backup | |

## Reports, returns, GST and the rest (Stage 8 list)

| # | Step | Status | Where |
|---|---|---|---|
| 8.1 | Return part of a bill with a cash refund: a credit note prints, the bill shows what is returned | Automated (one line in part) | `golden.spec.ts` › a return issues a credit note |
| 8.1b | Expected cash drops; cancel another bill for a full credit note | Manual | |
| 8.2 | Return part of a credit sale; outstanding falls | Manual | |
| 8.3 | GST → Returns for the month: sections with totals, tie-out green, export CSV | Automated (current month, B2CS CSV) | `golden.spec.ts` › GST returns |
| 8.3b | Each section's CSV/XLSX opens in the GST offline tool | Manual — Windows (the offline tool is Windows-only) | |
| 8.4 | GST set-off and challan | Manual | |
| 8.5 | Year end for a closed financial year | Manual (needs a past year of data) | |
| 8.6 | Run reports and export | Automated (Sales by product, CSV) | `golden.spec.ts` › reports |
| 8.6b | XLSX and PDF exports; receivables as of a date; Trial Balance report; print one | Manual | |
| 8.7 | Dashboard matches the reports | Manual | |
| 8.8 | Diagnostics → Backups: back up now | Automated | `golden.spec.ts` › diagnostics |
| 8.8b | Verify a backup; restore from a cloud backup on a second machine | Manual — needs object storage and a second machine | |
| 8.9 | Diagnostics → Audit trail "verified" | Automated | `golden.spec.ts` › diagnostics |
| 8.10 | Updates on a dev feed: Check now, refused with a sale in the cart, allowed when idle | Manual (see Windows host for the real installer) | |
| 8.11 | Bell shows the unread count; a low-stock notification after a reorder level above stock; mark read | Automated | `golden.spec.ts` › notifications bell |
| 8.11b | Dismiss; restock and it resolves; a cashier sees no stock or backup items | Manual | |
| 8.12 | Consent and erasure on a customer | Manual | |
| 8.13 | "Update … is ready" in the notification centre | Manual | |

## Screens and keyboard (NFR-023)

| # | Step | Status | Where |
|---|---|---|---|
| K.1 | Every POS action reachable without a mouse (F2–F9, Esc, Tab order) | Automated | `keyboard.spec.ts` |
| K.2 | Every main screen at 1366×768 without horizontal overflow | Automated (34 routes) | `golden.spec.ts` › every main screen |
| K.3 | The same on a real 1366×768 laptop at 100 % and 125 % Windows scaling | Manual — Windows host | |

## Windows host

Run on a Windows 10/11 PC with a real USB thermal printer (58 or 80 mm) with its driver installed, a cash drawer on the
printer's RJ11 port, and a USB barcode scanner in keyboard mode.

| # | Step | Expected |
|---|---|---|
| W.1 | Install the signed NSIS installer from the beta channel | SmartScreen shows the publisher; the app starts and creates `%APPDATA%\Muneem` |
| W.2 | Settings → Printer: kind "Installed printer", pick the printer from the list (9d spooler enumeration) | The printer appears by its Windows name |
| W.3 | ESC/POS mode: print a test receipt and a real sale | Text receipt prints; the drawer opens after a cash sale |
| W.4 | Rupee as symbol, and a product named in Hindi and one in Tamil | ₹ and the Indic names print as raster lines with conjuncts formed; amounts stay aligned |
| W.5 | Image mode (driver-only printers) | A roll-sized page prints; the drawer kick still fires; a failed kick is logged and the receipt is not reprinted |
| W.6 | Unplug the printer and complete a sale | The sale is saved; the POS shows "Receipt not printed"; Retry prints after plugging back in |
| W.7 | USB scanner at the POS and in `/products` | Scans add the product / find it, with no stray characters in the search box |
| W.8 | Update: publish a newer build to the beta channel, Check now, restart and update | Refused while a bill is in the cart; installs when idle; data intact after the update |
| W.9 | Kill the app from Task Manager mid-sale (9g's Windows kill loop) and reopen | No lost or half-saved sale; the audit chain verifies |
| W.10 | GST offline tool opens the exported GSTR-1 CSV/XLSX | Files import without errors |
| W.11 | 1366×768 laptop at 100 % and 125 % scaling | Every main screen fits without horizontal scroll; the POS fits without vertical scroll |

## Bugs found in 9j

Each fix is covered by the UI test named.

1. **Dialogs opened with focus on "Esc" (Close).** F5 then Enter closed the payment dialog instead of completing the
   sale (the button even says "Complete sale (Enter)"); F4 then typing went nowhere. `Dialog` now focuses the first
   field in its body, keeps that focus when the parent re-renders, and returns focus to the opener when it closes.
   (`keyboard.spec.ts`, `golden.spec.ts` › POS golden flow)
2. **F7 then Enter did nothing.** The held bills arrive after the dialog opens, so nothing had focus; the first
   Retrieve button now takes focus. (`keyboard.spec.ts` › F6 holds, F7 then Enter recalls)
3. **After a sale, focus was lost.** Typing a product name for the next customer went nowhere until F2; the search
   box now takes focus after every completed sale. (`keyboard.spec.ts` › F5 then Enter completes the sale)
4. **Every report and the GST returns page failed in the Electron app** ("Something went wrong"): the read-only
   report connection opened better-sqlite3 without the Electron-ABI binding the main connection uses, so it loaded
   the Node-ABI build. Packaged builds were affected too (`npmRebuild: false`). (`golden.spec.ts` › reports, GST)
5. **Stale screens after a sale or a return.** The POS invalidated only the print queue and Returns only the sales
   lists, so for 5 s a customer's open items, ageing and stock could show pre-sale values (Receive payment said
   "Nothing is open"). Both now mark every cached read stale. (`golden.spec.ts` › receive a payment)
6. **The bell missed notifications raised while signing in.** They are raised before the shell (and the bell's event
   listener) mounts, so the bell showed "none open" for up to a minute; it now refetches whenever it mounts.
   (`golden.spec.ts` › notifications bell)

Seen but not changed: after "Create product" the form navigates to the product's page and the "Saved." message is
lost (the heading shows the new name, so it is clear enough); `reports.export` allows one call a second, so two
quick exports show "Too many requests"; a cashier's over-limit discount is accepted by the quote and refused only
when the sale completes.
