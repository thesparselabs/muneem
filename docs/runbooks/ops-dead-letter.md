# Resend or dismiss a dead letter

## Symptoms
- The [unresolved dead letters](dead-letters.md) alert fired for a shop.
- `/admin/shops` shows a non-zero *Open dead letters* count.
- The shop sees a failed operation in Diagnostics → Sync. The device marks an operation dead after 12 attempts, or
  at once when the cloud rejects it.

Until it is resolved, a dead letter is a transaction the cloud does not hold. ADR-0054 counts it as **lost** after
24 hours.

## Checks
1. Open `/admin/shops/<id>/dead-letters`. For each letter, read:
   - the **error code and detail**;
   - the entity type and id, the device, and the received time;
   - the **payload preview**.
2. **Classify it by code:**

   | Code | Means | Usual action |
   |---|---|---|
   | `TOTAL_MISMATCH`, `JOURNAL_MISMATCH`, `JOURNAL_IMBALANCE` | The Go and TypeScript engines disagree on this document | Product defect. Fix, release, then **resend** |
   | `PAYLOAD_INVALID` | A shape the server refused (version skew, a document that already exists, a business mismatch) | Check versions; fix, then **resend**, or **dismiss** if it is a true duplicate |
   | `INVALID_STATE` | The document breaks a state rule (e.g. a cancel of something not cancellable) | Usually **dismiss** after the shop corrects it on the device |
   | `AUDIT_CHAIN_BROKEN` | An audit row does not continue its chain | **Never** resend or dismiss blindly: follow [ops-audit-chain-break](ops-audit-chain-break.md) |

3. **Reproduce a mismatch** without touching the shop:
   - open the letter as JSON: `GET /v1/admin/dead-letters/<id>` with an operator token, or use the page's preview;
   - run it through `cloud/cmd/verify-fixture`;
   - compare with the device's view of the document (the shop's printed bill).
4. **Versions:** `/admin/shops/<id>` shows the device's app and schema. A device on an old app after a protocol change
   explains a `PAYLOAD_INVALID` (ADR-0049).
5. **Is it already applied?** The device may have re-pushed it since. The page then shows *applied since*, and the
   letter no longer counts as open.

## Actions
- **Resend:** use it once the cause is fixed (a server release, or a dependency that has since arrived).
  - It runs the stored operation through ingest again, as its device, inside that shop's scope.
  - It is **idempotent**: resending twice, or after the device itself re-pushed, applies once.
  - **`applied` / `duplicate`:** the letter is resolved as `resent`.
  - **`rejected` / `deferred`:** the letter stays open, and the code appears in the notice. The cause is not fixed yet.
- **Dismiss:** use it only when the transaction must **not** reach the cloud.
  - Examples: the shop re-entered it as a new document, or it is a duplicate of one that applied.
  - A dismissal is final; it cannot be resent afterwards.
  - The reason must say what replaced the transaction (`re-entered as sale INV-A-00123 on 2026-10-12`).
- Both are recorded in `audit_log` (`admin.dead_letter.resent` / `.dismissed` / `.resend_failed`) with your reason.

**Verify:**
- `/admin/shops` shows 0 open dead letters.
- The device's Diagnostics → Sync is clear.
- The next probe clears the alert. Note that the 9c probe counts letters whose operation has not applied, so a dismissed
  letter clears it only once that probe also skips resolved letters (see ADR-0057).

## Escalation
- **Mismatch codes:** a product defect. Raise it with on-call, with the letter JSON, and fix forward through the beta
  channel. Don't dismiss to make an alert go away.
- **More than 10 letters from one shop in an hour** ([verification rejections](verification-rejections.md)): stop and
  escalate before resending anything.
