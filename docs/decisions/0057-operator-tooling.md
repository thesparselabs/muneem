# ADR-0057 — Operator tooling: who operators are, how they read across shops, and where the admin page lives

**Status:** Accepted, 2026-10-05

## Context
The pilot needs Muneem's own people to:
- see every shop's health in one place;
- revoke a lost device;
- resend or dismiss a dead letter;
- read review items, audit-chain breaks and backups.

Until now nothing could read across shops except the database owner, through raw SQL. Each tenant table is protected
by row-level security keyed on `app.business_id` (ADR-0051 put the API under it).

Three things must not happen:
- operator powers leaking to shop users;
- shop data leaking between shops through the new surface;
- an operator acting without a trace.

## Decision
- **An operator is a grant, not a role in a shop.**
  - `operator_grant` (migration 0009) names the operator accounts.
  - Only the owner role writes it, through `muneem-api grant-operator <email>` (`deploy.sh grant-operator`). That
    command creates the account, without an organization, if it is missing. `revoke-operator` ends a grant.
  - No API role has any privilege on the table, and shop sign-up never touches it.
- **Operator tokens are their own kind.**
  - They are signed with keys derived from the JWT keyring: HMAC(secret, `muneem-operator-v1`) for every kid
    (`Keyring.Derive`). A shop token therefore never verifies as an operator token, and an operator token never
    verifies on a shop route.
  - They carry `scope: "op"` and a token id. Shop routes refuse any scoped token, as defence in depth.
  - They live 15 minutes, with no refresh token. Every request re-checks the grant and that the account is active, so a
    revocation takes effect at once.
  - JWT key rotation (ADR-0052) rotates operator keys with it.
- **Cross-shop reads go through a dedicated database role: this addendum to ADR-0051.**
  - `muneem_admin` (NOLOGIN, migration 0009) holds SELECT on the tables the tooling reads (organization, business,
    device, entitlement, sync_operation, dead_letter, conflict_log, backup, audit_log, operator_grant), plus the login
    columns of app_user. It reads them through its own `FOR SELECT … USING (true)` policies.
  - It has no access to documents, journals, entity state, backup keys or refresh tokens.
  - Its only writes are the dead-letter resolution columns and audit rows whose action starts with `admin.`.
  - The API connects for this with a separate login role, `muneem_admin_app` (`MUNEEM_ADMIN_DATABASE_URL`, created by
    `roles.sql` when `MUNEEM_ADMIN_DB_PASSWORD` is set).
  - Every admin transaction runs `SET LOCAL ROLE muneem_admin`. That makes the policies decide even in development,
    and it fails closed if the URL names any other role.
  - The shop pool (`muneem_app`) is unchanged and still cannot read across shops.
- **Actions reuse the shop's own paths, inside one shop's scope.**
  - **Revoke:** `device.Revoke` with the control-stream message, then the key cache is invalidated.
  - **Resend:** `devicesync.Ingest.Reapply` runs the stored operation through the applier as its device. It is
    idempotent like any push. A refusal is reported, and not dead-lettered a second time.
  - Both run as the app role with `app.business_id` set to that shop, so an operator action can do nothing a shop
    request could not.
  - **Dismiss:** `muneem_admin`'s only write.
  - Every action needs a reason of 5 to 500 characters.
- **Dead-letter state:** a dead letter is open until either an operator resolves it (`resent` or `dismissed`, with
  who, when and the reason), or the device's same operation applies.
- **Audit:** every operator read is recorded before it is served (`admin.view`, with its route and query). So is every
  action, sign-in, failed sign-in, sign-out and grant (`admin.*`). Each row is in the append-only `audit_log`, with the
  operator's user id, the reason and the request id.
- **Where it is served:**
  - The API serves `/v1/admin` (JSON, documented in `packages/contracts/openapi/muneem-admin-v1.yaml`) and `/admin/`
    (the page) on a second listener, `MUNEEM_ADMIN_ADDR`.
  - In production that is port 8081, published only on the VM's loopback. Operators reach it through an SSH tunnel.
  - The public site serves it only when `MUNEEM_ADMIN_PUBLIC=true`.
  - The admin contract is a separate OpenAPI document, so the device API, and every server that composes it, is
    unchanged.
- **The page:** server-rendered `html/template`, with no JavaScript.
  - The session cookie is HttpOnly, Secure and SameSite=Strict, scoped to `/admin`.
  - Every POST carries a CSRF token: an HMAC of the session's token id under a key held in the process. The login form
    is a double-submit token.
  - The CSP allows only same-origin stylesheets and form posts.

## Consequences
- An operator needs SSH access to the VM and an operator grant. That is two factors in practice, which is why there is
  no TOTP yet. Turning `MUNEEM_ADMIN_PUBLIC` on removes the first factor, so it needs TOTP first.
- Caddy's CSP (`default-src 'none'`) would strip the stylesheet if the page were served publicly. It still works,
  unstyled.
- A restart rotates the CSRF key, so an open form must be reloaded.
- Signing out clears the cookie, but the token stays valid until it expires (at most 15 minutes). Revoking the grant
  ends it at once.
- The business-health probes (9c) count unresolved dead letters. They must also skip letters an operator resolved
  (`resolved_at IS NOT NULL`), or a dismissal never clears the alert.
- Reads of `admin.view` grow `audit_log`. At pilot scale (a handful of operators) that is a few hundred rows a day.
