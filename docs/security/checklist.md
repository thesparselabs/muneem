# Security checklist (Stage 9k)

Status: **✓** built and tested · **ops** needs an account or a person before the pilot · **later** accepted for the
pilot.

## Identity and access
- ✓ **Tokens:** access tokens last 15 minutes. Refresh tokens last 60 days, are rotated by family, and reuse revokes
  the family. JWT signing keys carry a `kid` and rotate without logging anyone out (ADR-0052).
- ✓ **Device signatures:** every device request is signed with Ed25519 and checked within ±5 minutes of skew. A
  revoked device is refused everywhere, and the other devices are told.
- ✓ **Permissions** are enforced in the main process from the cloud's permission snapshot, never in the renderer.
  The IPC registry gives every channel a schema, a permission and a rate limit.
- ✓ **Operators** use an identity separate from shop users, granted only from the server CLI. Every operator action
  is audited (9i).
- **ops:** each operator turns on MFA in the identity provider, if one is adopted. Until then operator access stays on
  the internal admin address.

## Data
- ✓ **Tenant isolation:** Postgres RLS on every tenant table, under a non-owner API role. Probes and the admin package
  read across tenants only through security-definer functions or a dedicated role.
- ✓ **Money and audit:** money values are integer paise. The audit trail is append-only and hash-chained, and the
  cloud verifies it (ADR-0048).
- ✓ **Backups:** AES-256-GCM with a device-signed manifest. The data key is escrowed under a versioned master keyring
  that can be rewrapped (ADR-0047, ADR-0052).
- **ops:** keep `MUNEEM_BACKUP_MASTER_KEYS` and `JWT_SECRETS` in the host's secret manager, with an offline copy of
  the master keys. Losing them loses every escrowed backup key.
- **later:** the SQLite database is not encrypted at rest (NFR-020: decided, documented in ADR-0047). The OS account
  is the boundary.
- ✓ **DPDP:** consent, profile export and erasure that keeps statutory invoices (ADR-0050).

## Transport and hosting
- ✓ **TLS:** Caddy terminates TLS with automatic certificates and security headers, and caps request bodies at 2 MiB.
- ✓ **Internal endpoints:** `/metrics` and the admin page are never on the public site.
- ✓ **Proxy headers:** `X-Forwarded-For` is trusted only from private networks.
- **ops:** the VM firewall exposes only 80/443 publicly. Monitoring uses WireGuard.

## Software supply chain
- ✓ **CI `security` job:**
  - `pnpm audit --prod` at moderate and above;
  - `govulncheck` (0 reachable vulnerabilities after pinning Go 1.26.8);
  - a gitleaks secrets scan over the whole history (test fixtures allowlisted in `.gitleaks.toml`).
- ✓ **Releases:** SBOMs (CycloneDX) and SHA-256 checksums for every release. Installers are Azure-signed, and
  unsigned builds never reach stable (ADR-0056).
- **ops:** an Azure Trusted Signing account and a publisher identity. Until then installers are unsigned and dev-only.
- **later:** `latest.yml` is not signed itself. The installer's sha512 and its Authenticode signer are checked
  (ADR-0049).

## Telemetry and privacy
- ✓ **Crash reports** are opt-in per business and allow-list scrubbed, on both the device and the collector. They
  never contain invoice contents, names, phones, GSTINs or amounts. Minidumps stay on the machine (ADR-0053).
- ✓ **Support bundles** carry no invoice contents.

## Before the pilot
- **ops:** a short external review or penetration test of the API, admin page and update path, scoped from this
  list.
- **ops:** the restore drill (NFR-010: RPO ≤ 15 min, RTO ≤ 4 h) is done and recorded.
