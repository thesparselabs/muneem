# Architecture Decision Records

One file per decision, numbered, never edited after acceptance (write a new ADR that supersedes it).
Template: Context → Decision → Consequences → Status.

| # | Decision |
|---|---|
| [0001](0001-go-echo-cloud-with-fixture-contract.md) | Cloud in Go/Echo; engine equality enforced by shared fixtures |
| [0002](0002-integer-money-and-shared-numeric-bounds.md) | Integer paise, one rounding primitive, identical numeric bounds in TS and Go |
| [0003](0003-device-signature-convention.md) | Device request signature: unix-seconds timestamp, Ed25519 over METHOD/PATH/TS/body-hash |
| [0004](0004-ci-reads-go-version-from-go-mod.md) | CI takes the Go version from `cloud/go.mod` |
| [0005](0005-local-device-id-is-installation-id.md) | Local `device_id` is the installation id; cloud id kept separately |
| [0006](0006-outbox-from-day-one-sync-worker-in-stage-7.md) | Outbox rows written from Stage 1; the worker waits for Stage 7 |
| [0007](0007-openapi-single-source-for-http-types.md) | One OpenAPI 3.0 document generates Go and TS HTTP types |
