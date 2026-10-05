# Replace a device

## Symptoms
- **Lost or stolen:** a till is gone (laptop stolen, PC taken).
- **Dead:** the disk failed or the PC won't boot.
- **Swapped:** the shop bought a new PC.
- [Device silent](device-silent.md) fired, and the shop confirms the device is gone (see
  [ops-silent-device](ops-silent-device.md)).

## Checks
1. Open `/admin/shops/<business id>` and find the device: its name, last seen, outbox and app version.
2. **Was anything unsent?** The device's outbox is lost with it. Compare its *Last push seq* with what the shop
   remembers selling since *Last seen*.
3. For a dead PC whose disk may still be readable, ask whether the disk can be recovered before revoking. A recovered
   database can push its outbox.
4. SQL, the device's last accepted operations:
   `adminsql -c "SELECT entity_type, entity_id, device_seq, created_at FROM sync_operation WHERE device_id = '<device id>' ORDER BY device_seq DESC LIMIT 10"`.

## Actions
1. **Revoke the old device** on `/admin/shops/<id>`: enter a reason (`stolen 2026-10-12, FIR 123`) and press Revoke.
   - Its signed requests are refused at once, and the shop's other devices are told on their next pull.
   - A revoked device frees its slot in the device limit.
   - This is the only way to rotate a device key (ADR-0052), so revoke even when the PC "might come back".
2. **Install the app on the new PC.** Sign in with the owner's account, then do one of:
   - **Add this device:** hydrate from the cloud. This is the normal path when the old till's data was all synced.
   - **Restore from cloud backup** (Diagnostics → Backups at setup): use it when the shop has a single till and the
     newest confirmed backup is newer than the cloud's view of that till. See [ops-restore-shop](ops-restore-shop.md).
3. On `/admin/shops/<id>`, the new device is active, and its first push and pull have succeeded (*Last seen* is
   recent).
4. On the new device, Diagnostics: the Trial Balance and the tie-outs are green.
5. **Re-enter lost bills.** Anything the shop sold on the old device after its last push is lost with it. The shop
   re-enters those bills from their paper copies or receipts, as new documents, and you record that in the pilot
   register. Per ADR-0054, it is an operator-explained loss, not a product defect.

## Escalation
- **A stolen device holding unsynced sales:** tell the lead the same day. It counts against the pilot's "zero lost"
  unless the shop re-enters them.
- **Revoke fails, or the device still syncs after a revoke:** that is a security defect. Escalate to on-call
  immediately.
