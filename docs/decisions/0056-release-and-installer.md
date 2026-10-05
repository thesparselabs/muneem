# ADR-0056 — Release and installer: CI-built, Azure-signed, promoted between channels without a rebuild

**Status:** Accepted, 2026-10-05

## Context
ADR-0049 built the updater: a generic-provider feed at `updates.muneem.app/<channel>/latest.yml`, channels
`dev | beta | stable`, a rollout percentage in `stagingPercentage`, and an Authenticode publisher check on Windows.
What it left open was how an installer is built, signed, described and moved through the channels. Until now an
installer was built by hand (`pnpm package`) and nothing was signed, so SmartScreen warns and the publisher check is
off. HLD §12/§13 ask for a signed Windows build, a staged rollout and an SBOM. The certificate and the update bucket do
not exist yet, and forks and dev runs must still build.

## Decision
- **One workflow builds; another promotes.** `.github/workflows/release.yml` runs on a `v*` tag or by hand (version,
  channel, rollout). `promote.yml` runs only by hand. `ci.yml` never packages or publishes, so pull requests are
  unaffected.
- **Build on `windows-latest`.** The tag gives the version (`scripts/release-version.ts`), which is stamped into
  `apps/desktop/package.json` for that run only; the committed version stays as it is. electron-builder makes the
  NSIS x64 installer, `Muneem-Setup-<version>.exe`, with its blockmap.
- **Azure Trusted Signing through electron-builder's `azureSignOptions`.** The options, including `publisherName`, go
  on the command line only when every signing secret and variable is set. The signature is then checked with
  `Get-AuthenticodeSignature` against the publisher. Without them the job still builds, warns, and records
  `signed: false`. An unsigned build records no publisher, so its updater checks the sha512 only.
  - Why Azure Trusted Signing and not an EV token: it signs from CI without hardware. Its certificates give
    SmartScreen reputation the way EV does today, and it costs far less. EV stays possible later through
    `signtoolOptions`.
- **Unsigned builds stay out of the shops.** An unsigned build is published to `dev` only, unless
  `vars.MUNEEM_ALLOW_UNSIGNED_PUBLISH` is `true`. That switch is for the pilot before the certificate exists. Never use
  it once signed builds are in the field: their updaters would refuse the unsigned one anyway. `promote.yml` refuses
  to put an unsigned build on `stable`.
- **A fresh build never goes straight to stable.** A `-dev` version goes to `dev`. Every other version, `-beta`,
  `-rc` and plain `x.y.z` alike, goes to `beta` (the pilot shops). `stable` is reached only by promotion, so what beta
  ran is byte for byte what stable gets.
- **An immutable archive per version.** Every build writes `releases/<version>/` on the update host. It holds the
  installer, the blockmap, a `latest.yml` without a rollout, `build-info.json` (version, commit, signed, first
  channel), the SBOMs and `SHA256SUMS.txt`. A version already in the archive is never replaced; the publish fails,
  and the fix is a version bump.
- **Promotion copies; it does not rebuild.** `promoteRelease` (`apps/desktop/src/main/update/release.ts`) reads the
  source `latest.yml`, checks each file's size and sha512 against it, copies the files, and rewrites only
  `stagingPercentage`. The source is a channel that serves the version now, or `archive`. The same action does three
  jobs:
  - widen or narrow a rollout: from and to are the same channel;
  - halt a rollout: rollout 0;
  - roll back: re-promote an earlier version from `archive`.
- **Upload order.** `scripts/release-upload.sh` uploads to any S3-compatible bucket with `aws s3`. Installers and
  blockmaps go first, with immutable caching. `latest.yml` goes last with `no-cache`, so a client never reads a
  manifest that names a missing file. Publishing is skipped, with a notice, when the bucket secrets are absent.
- **SBOM.** CycloneDX 1.6 for the pnpm workspace (`@cyclonedx/cdxgen`) and for the Go cloud
  (`cyclonedx-gomod mod`). Both are attached to the GitHub Release and the archive.
- **Checksums.** `SHA256SUMS.txt` covers every file in the archive, so a downloaded installer can be checked without
  the updater.
- **The crash collector and symbols (9c).** `vars.MUNEEM_CRASH_DSN` is baked into the main bundle at build time as
  `import.meta.env.MAIN_VITE_CRASH_DSN`. When it is unset the value is empty and the DSN is null. A release build
  emits hidden source maps. electron-builder leaves them out of the installer, and they are kept, with the Electron
  version and the native SQLite module, as a 90-day `symbols-<version>` workflow artifact. Electron's own symbols come
  from Electron's symbol server.
- **The GitHub Release.** Every build gets one, `v<version>`, with the archive's files. It is a prerelease when the
  version has a prerelease part or the build is unsigned, and its title says "(unsigned)" when it is.

## Consequences
- Rolling back the *program* still means the shops already on the bad version stay on it. `allowDowngrade` is off,
  so an older `latest.yml` stops new installs from taking the bad version but does not take anyone back. The fix is
  forward: a new version, or a manual reinstall. The *data* rollback from ADR-0049 is unchanged.
- The update host's `releases/` prefix grows by one installer per version (~100 MB). A lifecycle rule may expire old
  versions, but never the one any channel serves.
- Ops must create the Azure Trusted Signing account, identity validation and certificate profile, an Entra app
  registration with the signer role, and the update bucket with its DNS (`docs/operations/release.md`).
- The publisher name is fixed by the first signed release. Changing it later breaks updates for every signed
  installation, because electron-updater compares against the name the running build recorded.
- The release workflow cannot be run end to end without a Windows runner. Locally, the config is checked against
  electron-builder's schema, the workflows with actionlint, and the manifest and promotion logic with unit tests
  (`apps/desktop/test/update/release.test.ts`).
