# Negative stock spike

**Alert:** `muneem-negative-stock-spike` (warning) fires when `max by (business_id) (delta(muneem_business_negative_stock_max[1h]))` > 10 for 5m.

## What it means
More than 10 additional products went below zero on a device of the shop within an hour. Usually a purchase not yet entered, an import, or offline oversell across terminals (HLD risk).

## How to check
- Ask the shop whether stock was just received but not entered.
- Stock reconciliation report on the device.

## How to fix
- Enter the purchase or a stock adjustment; the count falls on the next push.
- If it follows an app update, compare the movement ledger with the previous version.
