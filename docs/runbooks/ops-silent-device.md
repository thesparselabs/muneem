# Respond to a silent device

## Symptoms
- The [device silent](device-silent.md) alert fired.
- `/admin/shops` shows *Silent* above 0: an active device not seen for 24 hours.
- Related alerts: [outbox backlog](outbox-backlog.md) or [outbox not draining](outbox-stale.md). These fire when the
  device is reachable but its sync is failing.

A silent device may be closed for a holiday, offline, broken, or stuck. The desktop sells offline for up to 30 days,
so silence is not yet lost data. But everything it sold is only on that PC until it syncs.

## Checks
1. On `/admin/shops/<id>`, read the device's row:
   - **Last seen:** when it last synced.
   - **Outbox:** the depth it last reported, if any.
   - **App** and **Schema:** its versions.
   - **Clock skew:** its clock against the server's.
2. **The shop's other devices:** if they sync and this one doesn't, the cause is local to this PC. If all of them are
   silent, it is the shop's network, or a holiday.
3. **The cloud side:** are its requests arriving and being refused? Check the API logs in Loki:
   `{service="api"} | json | uri=~"/v1/sync/.*" | status >= 400`, filtered on the device id if it is logged. If the
   requests are arriving:
   - `DEVICE_CLOCK_SKEW`: the PC clock is more than 5 minutes off;
   - `DEVICE_REVOKED`: the device was revoked;
   - HTTP 426 `VERSION_UNSUPPORTED`: it runs a protocol older than N−1 (ADR-0049).
4. **SQL**, its last accepted operation:
   `adminsql -c "SELECT max(created_at) FROM sync_operation WHERE device_id = '<device id>'"`.

## Actions
1. **Call the shop.** Is the shop open? Is the PC on, and does it have internet?
2. **On the device:** Diagnostics → Sync shows the last error and the outbox depth. Common fixes:
   - **No network:** fix the router, or use a phone hotspot to sync once.
   - **Clock skew:** set Windows to automatic time, then sync now.
   - **Upgrade required:** install the current beta (the app offers it when idle).
   - **Signed out for too long:** the owner signs in again.
3. **A dead or lost PC:** see [ops-replace-device](ops-replace-device.md). Revoke it so it stops counting as silent.
   Whatever it never pushed is lost unless the disk is recovered.
4. **Closed shop:** note the dates in the pilot register. The alert clears when it syncs again.
5. **Verify:** the device's *Last seen* is recent, the outbox drains to 0, and no new dead letters appear.

## Escalation
- **Silent for 3 days with sales on it:** tell the lead. The data is at risk until it syncs.
- **The device is online but its sync fails with a server error (5xx):** escalate to on-call (API
  [error rate](error-rate.md)).
