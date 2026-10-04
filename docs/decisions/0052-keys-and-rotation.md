# ADR-0052 — Keys and rotation

**Status:** Accepted, 2026-10-05

## Context
Two server secrets could not be rotated:
- **`JWT_SECRET`** signs every access token, with HS256 and no key id.
- **`MUNEEM_BACKUP_MASTER_KEY`** wraps every escrowed backup data key (ADR-0047). Losing it makes every cloud backup
  unrecoverable; leaking it, together with the database, exposes them all.

A secret that cannot change without logging everyone out, or without orphaning every backup, never gets rotated in
practice. That includes after a suspected leak.

## Decision
- **JWT keyring:**
  - `JWT_SECRETS` is `kid:secret,...`. The first entry signs and puts its `kid` in the token header, and every entry
    verifies tokens bearing its own `kid`. A secret has at least 32 bytes.
  - `JWT_SECRET` stays as the legacy key. Alone, it behaves exactly as before. Next to `JWT_SECRETS` it only verifies
    tokens without a `kid`, so moving to the keyring logs no one out.
  - A token's `kid` picks its key. An unknown `kid` fails, and the legacy key never stands in for a named one.
  - Access tokens live 15 minutes, and refresh tokens are opaque database rows, not JWTs. So an old key can be removed
    15 minutes after a new one starts signing.
- **Backup master keyring:**
  - `MUNEEM_BACKUP_MASTER_KEYS` is `version:base64,...`. The first version wraps new keys.
  - The legacy `MUNEEM_BACKUP_MASTER_KEY` joins the ring as `v1`. Startup is refused if it differs from a `v1` listed
    in the ring.
  - `backup_key.master_key_version` (migration 0007, default `v1`) records which version wrapped each key, and
    unwrapping uses that version. The AAD is unchanged, so existing rows open as `v1`.
  - `muneem-api rewrap` (`deploy.sh rewrap`) re-wraps every key that is not under the active version, one key per
    transaction, with a compare-and-swap on the old version. It reports how many keys failed, and exits non-zero if
    any did.
  - It runs as the owner role, so the API role keeps no UPDATE on `backup_key`.
  - An old version is removed only after `rewrap` reports `failed=0`.
- **Custody:** every master key version is also kept offline, out of band (a sealed export in the password manager
  plus a second custodian). Keys are never committed.
- **Device keys** (Ed25519 per device, ADR-0039) are unchanged. Revoking a device is how a device key is rotated.

## Consequences
- Rotating either secret is a configuration change and a restart. The procedures are in `docs/operations/deploy.md`.
- With more than one API instance, a new JWT key must first be added in second place (verify-only) on every
  instance, and only then moved to first.
- A backup master key version must outlive every row wrapped by it. `rewrap` makes that a short window rather than
  forever.
- A KMS can later stand behind the same `Wrapper` shape, with the version naming a KMS key.
