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
