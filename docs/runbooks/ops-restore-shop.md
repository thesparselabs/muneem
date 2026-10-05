# Restore a shop from backup

## Symptoms
- **A device's database is corrupt:** the app shows the corrupt-database dialog at start, or Diagnostics fails
  integrity.
- **A single-till shop lost its PC**, and its cloud view is behind its last backup.
- **The cloud itself** must be restored: managed Postgres loss. That case is not here; follow the restore drill in
  `docs/operations/deploy.md` §6.

## Checks
1. Open `/admin/shops/<id>`:
   - **Devices:** their status, last seen and last push seq. They show whether the cloud holds everything the device
     had sent.
   - **Backups** (`/admin/shops/<id>/backups`): the newest `ready` backup, its *Confirmed* time and the device that made
     it.
2. **Choose the source, in this order** (ADR-0047):
   1. **A local backup** on the same PC (Diagnostics → Backups). This is the newest, if the disk is fine.
   2. **A cloud backup:** the newest confirmed one. It holds everything up to its time, including anything the device
      had not pushed.
   3. **Hydration** ("Add this device"). It holds everything the cloud accepted, but not what was still in the outbox.

   With more than one till, hydration is usually right: the other tills kept syncing, so the cloud is the newest
   complete copy. With a single till, compare the last backup's time with the device's *Last seen*. If the backup is
   newer, restore it, so that the unsent operations come back and push.
3. **The key:** cloud backups are decrypted with the escrowed key, so the master keyring on the cloud must still hold the
   version that wrapped it (ADR-0052). If a restore fails with a key error, escalate; do not rotate keys meanwhile.

## Actions
1. **Same PC, corrupt database:** in the start-up dialog, restore the newest local backup. If there is none, use
   Diagnostics → Backups → Restore from cloud backup.
2. **New PC:** install the app and sign in as the owner. Then choose **Restore from cloud backup** (single till, backup
   newer) or **Add this device** (hydrate).
   - Before the new PC syncs, revoke the old device on `/admin/shops/<id>` (reason: `replaced by restore on <date>`).
     See [ops-replace-device](ops-replace-device.md).
3. **After the restore:**
   - Diagnostics: the Trial Balance, tie-outs and audit chain are green.
   - The device pushes whatever the backup held that the cloud did not. Duplicates are harmless, because pushes are
     idempotent.
   - `/admin/shops/<id>/dead-letters` shows nothing new. `/admin/shops/<id>/chain-breaks` shows nothing new. A break
     right after a restore of an *old* backup on a device that kept writing is expected; handle it with
     [ops-audit-chain-break](ops-audit-chain-break.md).
4. **Bills after the backup:** anything sold after the restored backup's time and never pushed is gone. The shop
   re-enters those bills from their paper copies, and you record it.

## Escalation
- **A cloud backup that fails to decrypt or verify:** escalate to on-call immediately. A backup that cannot be
  restored is a broken promise (NFR-010).
- **A Trial Balance difference between the restored device and the cloud** (the
  [device books differ](device-books-differ.md) alert): escalate to the lead.
