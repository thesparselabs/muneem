# Onboard a shop

## Symptoms
A new pilot shop is ready to start: the hardware is in place and the owner is available. (This is a procedure, not a
fault.)

## Checks before the visit
- The pilot criteria (pilot runbook, 9k): regular GST scheme, no batch/expiry needs, no reverse-charge purchases.
- The latest beta installer is published, and the cloud is healthy: `curl -fsS https://<api domain>/v1/ready`.
- No shop of the same name already exists: `/admin/shops`.

## Actions
1. **Install** the signed app on the shop's first PC (Windows 10/11, 64-bit).
2. **Create the account and business on the device.** The owner signs up in the app, which creates the user and
   organization on the cloud, then creates the business: name, GSTIN, state, tax scheme and financial year.
   - The business is created offline. It reaches the cloud with the device's **first push**, which also makes the
     owner its member and gives it a trial entitlement of 3 devices.
3. **Wait for the first push** (it starts within a minute when online). Then check:
   - `/admin/shops` lists the shop, with 1 active device and a recent *Last sync*;
   - on `/admin/shops/<id>`, the device shows its app version and schema, and a clock skew under 5,000 ms.
   - A skew of minutes means the PC clock is wrong. Fix the Windows time settings (automatic time) before the first
     sale.
4. **Set up the masters** with the owner: units, products and opening stock, customers and suppliers with opening
   balances, then printers (Settings → Printers; test a receipt with ₹ and the shop's language).
5. **A second till**, if any: install, sign in with the owner's account, and choose **Add this device**. It hydrates from the
   cloud (the bootstrap bundle). Afterwards, `/admin/shops/<id>` shows 2 active devices. Its first push must succeed
   before it sells.
6. **Backups:** on the device, Diagnostics → Backups → run a backup now. `/admin/shops/<id>/backups` must show it as
   `ready` with a *Confirmed* time.
7. **Record** the shop's business id, the device ids, and the owner's contact details in the pilot register.

## Checks after the first day
- `/admin/shops`: 0 open dead letters, 0 chain breaks, a latest backup under 26 hours old, and no silent device.
- SQL: `adminsql -c "SELECT entity_type, count(*) FROM sync_operation WHERE business_id = '<id>' GROUP BY 1 ORDER BY 1"`
  shows sales and payments arriving.

## Escalation
- **The first push dead-letters:** follow [ops-dead-letter](ops-dead-letter.md) and keep the shop on paper bills.
  Escalate to on-call the same day.
- **`DEVICE_LIMIT_REACHED`** when adding a till: the entitlement needs raising. That is a decision for the lead; today it
  is an owner-role SQL change to `entitlement.device_limit`.
