# Investigate an audit-chain break

## Symptoms
- The [audit chain broken](audit-chain-break.md) alert fired.
- `/admin/shops` shows *Chain breaks* above 0 for a shop.
- Every device of the shop lists an `audit_chain_broken` review item.

A break means an audit row arrived that does not continue its device's hash chain (ADR-0048). Possible causes:
- audit history on the device was altered or removed;
- the device was restored from an older copy and kept writing;
- a disk fault;
- a defect.

**Treat it as evidence.** Nothing on the cloud or the device is edited to "repair" it.

## Checks
1. **The break:** `/admin/shops/<id>/chain-breaks` shows the time, the device, the operation, and the detail: the
   chain's device, the seq, and what did not match.
2. **The rejected row:** `/admin/shops/<id>/dead-letters?state=all` shows the `AUDIT_CHAIN_BROKEN` letter for the same
   operation. Its payload is the audit row as the device holds it.
3. **The chain the cloud holds:** the last rows before the break.
   ```sh
   adminsql -c "SELECT device_id, entity_id, detail, created_at FROM conflict_log WHERE business_id = '<id>' AND kind = 'audit_chain_broken' ORDER BY created_at DESC"
   ```
   The admin role cannot read `audit_entry` itself (least privilege). If you need the stored chain, the on-call
   engineer reads it as the owner:
   `SELECT seq, hash, prev_hash, received_at FROM audit_entry WHERE business_id = '<id>' AND device_id = '<chain device>' ORDER BY seq DESC LIMIT 5`.
4. **On the device:** Diagnostics → Audit trail → Verify. Ask the shop:
   - Was the PC restored from a backup, or was the app reinstalled?
   - Did anyone open the database file?
   - Did Windows report disk errors?
5. **Backups:** compare the break's time with the device's backups on `/admin/shops/<id>/backups`. A restore of an older
   backup just before the break explains it.

## Actions
- **Explained by a restore** (the device went back to an older backup and continued):
  - record the explanation in the pilot register and resolve the review item on the device;
  - the dead letter stays as evidence. **Dismiss** it with the reason `audit chain break explained: restore of backup <id> on <date>`;
  - do not resend it: it can never link.
- **Unexplained:**
  - it is an incident. Keep the device as it is and collect its support bundle (Diagnostics → Export support
    bundle);
  - escalate to the lead;
  - do not revoke the device until the bundle is safe, but stop the shop from deleting anything.
- **A defect** (the device verifies its own chain as intact, but the cloud refuses it): escalate to on-call with the
  dead letter's JSON and the device's chain export.

## Escalation
The lead, always, the same day. An unexplained break fails the pilot's "zero unexplained" measure for that shop
(ADR-0054).
