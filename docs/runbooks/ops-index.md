# Operator procedures

These are the operator runbooks (Stage 9i, ADR-0057). The per-alert pages beside them (Stage 9c) say what an alert
means; these say how to act, using the admin page. Each page lists symptoms, checks, actions and escalation.

| Procedure | When |
|---|---|
| [Onboard a shop](ops-onboard-shop.md) | A new pilot shop starts. |
| [Replace a device](ops-replace-device.md) | A till is lost, stolen, dead or swapped. |
| [Resend or dismiss a dead letter](ops-dead-letter.md) | The cloud rejected an operation (alert: [dead letters](dead-letters.md)). |
| [Investigate an audit-chain break](ops-audit-chain-break.md) | The cloud refused an audit row (alert: [audit chain broken](audit-chain-break.md)). |
| [Restore a shop from backup](ops-restore-shop.md) | A device's database is lost or corrupt, or a shop must be rebuilt. |
| [Rotate keys](ops-rotate-keys.md) | On schedule, or after a suspected leak. |
| [Respond to a silent device](ops-silent-device.md) | A device has not synced for 24 hours (alert: [device silent](device-silent.md)). |

## Before you start

**The admin page.** Open a tunnel to the VM, then open `http://localhost:8081/admin/` (`docs/operations/deploy.md`
§8):

```sh
ssh -N -L 8081:127.0.0.1:8081 <vm>
```

- Sign in with your operator account. A session lasts 15 minutes.
- Every page you open and every action you take is recorded in `audit_log` with your user id. Every action asks for a
  reason, so write one a colleague will understand in a month.

**Paths on the page:**
- `/admin/shops`: every shop.
- `/admin/shops/<business id>`: devices, with Revoke.
- `/admin/shops/<id>/dead-letters`: Resend and Dismiss (`?state=all` includes resolved ones).
- `/admin/shops/<id>/review-items`, `/admin/shops/<id>/chain-breaks` and `/admin/shops/<id>/backups`.

The same data is JSON under `/v1/admin/...` (`packages/contracts/openapi/muneem-admin-v1.yaml`).

**Read-only SQL.** On the VM, define this once per shell. It connects as `muneem_admin_app`, which sees only the
tables the tooling needs, with every transaction read-only:

```sh
adminsql() {
  docker run --rm -i -e PGOPTIONS='-c default_transaction_read_only=on' postgres:16-alpine \
    psql -X "$(sed -n 's/^MUNEEM_ADMIN_DATABASE_URL=//p' /opt/muneem/deploy/.env)" "$@"
}
```

- Use the owner role (`MUNEEM_OWNER_DATABASE_URL`) only where a page says so. It bypasses every safeguard.
- Never `UPDATE` or `DELETE` shop data by hand. Fixes go through the product: a resend, a new document on the device,
  or a release.

**Escalation, in general:**
- **On-call engineer:** product defects, and anything a page says to escalate.
- **The lead:** anything touching money, tax or audit evidence, and any data loss.
- **The shop:** keep the shop's owner informed in their language, by phone, the same day.
