# Rotate keys

## Symptoms
- **A scheduled rotation** is due.
- **Suspected leak:** a secret may have leaked, through a laptop loss, a pasted log, a departing engineer or a
  provider incident.
- **A device key** must change. A device key cannot be rotated: revoke the device and add it again
  ([ops-replace-device](ops-replace-device.md)).

The procedures themselves are in `docs/operations/deploy.md` §5 (ADR-0052). This page says which to run, and how to
check each.

## Checks
- `./deploy.sh status`: the tag that is running. Rotation restarts it with the same tag.
- Startup logs: `docker compose logs api | grep -E 'jwt keys|backup master keys|admin listening'`. They show the active
  JWT `kid` and the active backup master key version.
- Every master key version is held offline (password manager plus the second custodian) **before** any change.

## Actions
| Secret | Procedure (`deploy.md` §5) | Effect, and how to check it |
|---|---|---|
| JWT signing key (`JWT_SECRETS`) | Add the new key second, move it first, and remove the old one after 15 minutes | Device sessions continue. Operator sessions use keys derived from the same ring, so operators sign in again after the old key is removed |
| Backup master key (`MUNEEM_BACKUP_MASTER_KEYS`) | New version first, then `./deploy.sh rewrap` until `failed=0`, then remove the old version | Backups on `/admin/shops/<id>/backups` keep confirming. Keep the old version offline until the next restore drill |
| `muneem_app` password | Change `MUNEEM_APP_DB_PASSWORD` and `DATABASE_URL` together, then `./deploy.sh up <tag>` | `/v1/ready` answers 200 |
| `muneem_admin_app` password | Change `MUNEEM_ADMIN_DB_PASSWORD` and `MUNEEM_ADMIN_DATABASE_URL` together, then `./deploy.sh up <tag>` | The admin page lists shops again |
| Object storage key | Create a second key, switch the variables, deploy, then delete the old key | A device backup confirms |
| An operator's account | There is no password change for operators yet: `./deploy.sh revoke-operator <old email>`, then `grant-operator <new email>` with a new password | The old session ends at its next request |

**After a suspected leak**, rotate in this order:
1. The leaked secret.
2. Anything it could have reached. A leaked owner URL means every database password. A leaked `.env` means
   everything in it.
3. Then read `audit_log` for `admin.%` actions, and for logins, since the suspected time:
   `adminsql -c "SELECT occurred_at, user_id, action, entity_id FROM audit_log WHERE action LIKE 'admin.%' AND occurred_at > '<time>' ORDER BY id"`.

## Escalation
- **A leak of a backup master key together with the database:** every cloud backup is exposed. Tell the lead
  immediately; shops may need to be told.
- **`rewrap` reporting `failed>0`:** do not remove the old version. Escalate to on-call.
