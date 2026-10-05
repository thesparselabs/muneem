# ADR-0049 — Updates and protocol support

**Status:** Accepted, 2026-10-04

## Context
NFR-013 and HLD §12/§13 ask for signed, staged, resumable updates with rollback. FR-105 says the server supports N−2 protocols; LLD §7 says N and N−1.

## Decision
- **Updates:** a generic-provider `electron-updater` with a signed `latest.yml` per channel.
- **Staged rollout:** the cohort is a stable hash of the installation id, against the rollout percentage in the
  manifest.
- **Installing:** the download resumes. The install happens on restart, after a pre-migration backup, and a failed
  migration restores it and reports.
- **Protocols:** the cloud accepts sync protocols N and N−1 (LLD §7, which takes precedence over FR-105's N−2), and
  a contract test runs the previous protocol's fixtures against the current server.

## Consequences
- Built in Stage 8 (8i); amended with an "As built" note if reality differs.

## As built (8i, 2026-10-05)
- **Updater:** `apps/desktop/src/main/update/`. An `Updater` port with an `electron-updater` adapter (generic provider,
  feed `<host>/<channel>/latest.yml`, `autoDownload` off, install on quit on) and a `FolderUpdater` (a static folder or
  `file://` feed) for tests and dev runs (`MUNEEM_UPDATE_DIR`). The host defaults to `https://updates.muneem.app`
  (`MUNEEM_UPDATE_URL` overrides it). An unpackaged run without a folder feed reports `disabled`.
- **Channels:** `dev | beta | stable`, kept per installation in `app_meta.update_channel` (it never syncs); a build
  starts on the channel its version names. Changing it needs `settings.manage` (owner); installing needs
  `diagnostics.manage` (manager and owner).
- **Staged rollout:** the manifest's `stagingPercentage` (electron-updater's own field). The cohort is
  `sha256("muneem-rollout:" + installation id)` mod 100, and the device takes the release when cohort < percentage.
  electron-updater's random-id staging check is switched off, so one rule decides.
- **Integrity, not a signed manifest:** `latest.yml` itself is not signed. The installer's sha512 from it is always
  checked; on Windows electron-updater also checks the installer's Authenticode signature against the publisher the
  running build was signed by. The code-signing certificate is an ops task; until it exists, only HTTPS and sha512
  protect an update.
- **Resuming:** a finished download is cached and reused across restarts, and with a blockmap only the changed blocks
  of the installer are fetched (differential). An interrupted transfer is not resumed byte-wise; it starts again.
- **Install gate:** never mid-sale. "Restart and update" installs only when the POS screen reports an empty cart, no
  IPC command is running, and the register is closed or untouched for 10 minutes; otherwise it says "Update ready —
  will install when you close the register". Quitting the app installs a downloaded update.
- **Migration guard** (`infra/db.ts`): quick_check on open → an encrypted 8f backup (`pre_migration`) when a business
  and the device key exist, else a verified plain copy → every pending migration in one transaction with
  `foreign_key_check` inside it → no core table may lose rows. Any failure restores the backup, records
  `app_meta.migration_failure` and the log, and the app shows a dialog and quits.
- **What rollback means:** the *data* is rolled back automatically, on every platform. The *program* is not: the NSIS
  installer has already replaced it, and electron-updater keeps only the new installer, not the previous one. The
  dialog asks the user to reinstall the previous version; ops can also set the release's rollout to 0 so no other shop
  takes it. Only Windows (NSIS) is built today.
- **Protocols:** `httpx.Protocols{Min, Current}`; `MUNEEM_SYNC_MIN_PROTOCOL` sets the minimum (default N−1, never below
  1). Every `/v1/sync/*` request needs `X-Sync-Protocol` in range and a push body's `protocol` must be too; otherwise
  426 `VERSION_UNSUPPORTED`. The reference server mirrors this for pushes. With N = 1 today, `fixtures/sync/v1/` is
  a frozen copy, replayed against a server configured as N = 2, min 1.
