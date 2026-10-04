# Runbooks

One page per alert in `deploy/monitoring/grafana/provisioning/alerting/rules.yml` (ADR-0053). Each alert's
`runbook_url` links its page. Shop and device ids are the labels on the alert.

| Alert | Severity | Fires when |
|---|---|---|
| [Outbox backlog](outbox-backlog.md) | critical | A device of shop <shop> has more than 500 operations waiting to sync. |
| [Outbox not draining](outbox-stale.md) | critical | An operation on a device of shop <shop> has waited more than an hour to sync. |
| [Device silent](device-silent.md) | warning | A device of shop <shop> has not synced for more than 24 hours. |
| [Unresolved dead letters](dead-letters.md) | critical | Shop <shop> has operations the cloud rejected and that have not since applied. |
| [Verification rejections rising](verification-rejections.md) | warning | More than 10 operations from shop <shop> failed server verification in the last hour. |
| [Audit chain broken](audit-chain-break.md) | critical | The cloud refused an audit row of shop <shop> as a broken chain in the last 24 hours. |
| [Trial Balance imbalance](tb-imbalance.md) | critical | Shop <shop> has journals on the cloud whose lines do not balance. |
| [Device books differ from the cloud](device-books-differ.md) | critical | Device <device> of shop <shop> holds different journal totals from the cloud at the same seq. |
| [Device integrity check failing](device-integrity-failing.md) | critical | The last integrity run on device <device> of shop <shop> found tie-out, replay or audit-chain failures. |
| [Negative stock spike](negative-stock-spike.md) | warning | More than 10 more products went below zero stock in shop <shop> within an hour. |
| [Cloud backup stale](backup-stale.md) | critical | Shop <shop> has no confirmed cloud backup in the last 26 hours. |
| [Backup confirmations failing](backup-confirm-failing.md) | warning | Backup confirmations failed or mismatched in the last hour. |
| [Hydration bundle builds failing](snapshot-build-failing.md) | warning | A hydration bundle build failed in the last hour; a new device cannot be set up from the cloud. |
| [API down](api-down.md) | critical | Prometheus cannot scrape the API. |
| [Readiness failing](readiness-failing.md) | critical | The API readiness check <check> is failing. |
| [API error rate](error-rate.md) | critical | More than 2% of API requests are failing with a 5xx. |
| [Business-health probes stale](health-probe-stale.md) | critical | The business-health probes have not completed for 10 minutes, so the business alerts are blind. |
| [Sync alert logged](sync-alert-log.md) | critical | The API logged an alert line (a rejected operation or a failed snapshot build). |
| [Desktop crashes rising](desktop-crashes.md) | warning | More than 5 desktop crash or error reports arrived in the last hour. |

## Operator procedures

Step-by-step operator tasks (onboarding, replacing a device, dead letters, restores, key rotation) are listed in
[ops-index.md](ops-index.md).
