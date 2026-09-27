# ADR-0004 — CI takes the Go version from `cloud/go.mod`

**Status:** Accepted, 2026-09-27

## Context
The plan said Go 1.25, but the module resolved to `go 1.26.0` when a dependency required it and the local toolchain
auto-downloaded 1.26. CI pinned `go-version: '1.25'`; `setup-go` v7 sets `GOTOOLCHAIN=local` and refused to build.

## Decision
`actions/setup-go` uses `go-version-file: cloud/go.mod` in every job. The module file is the single statement of the
Go version.

## Consequences
- A Go upgrade is one edit in `go.mod`, reviewed like any other dependency change.
- The project is on Go 1.26; returning to 1.25 would mean pinning dependencies back — a separate decision if ever wanted.
