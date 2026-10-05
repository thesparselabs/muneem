# ADR-0054 — What "zero lost, zero unexplained" means for the pilot

**Status:** Accepted, 2026-10-05

## Context
The Stage 9 exit criterion is "30 days, zero lost transactions, zero unexplained imbalances" across 5 pilot shops.
The designs define the mechanisms but no single measure: server re-verification, the audit chain, nightly integrity
checks and the HLD §11 business-health alerts. Without a precise definition, the exit cannot be checked.

## Decision
- **A transaction is lost** if any of these holds for a shop:
  - a device's outbox has a row that is not `sent` or `superseded` 24 hours after it was written;
  - a dead letter is still unresolved after 24 hours;
  - a document number series has a gap that no cancelled or voided document explains;
  - the cloud holds a different number of documents of a type than the device that created them.
- **An imbalance is unexplained** if any of these holds:
  - the cloud Trial Balance differs from a device's Trial Balance by any amount;
  - any tie-out (stock 1400, parties 1300/2100, tax heads, monthly GST) fails on any device;
  - the replay check differs from the projections;
  - an audit chain does not verify on the device or the cloud.

  Oversells and late arrivals are **explained** only when they appear as review items. A difference with no review
  item counts as unexplained.
- **The pilot health report** is a nightly job on the cloud, with device evidence from the sync heartbeat and the
  integrity results each device pushes. It computes every check above per shop and stores the result with its
  inputs, so a day can be re-checked.
- **Dashboards and alerts:** the Grafana dashboard shows the last 30 days per shop, and any failing check alerts
  (ADR-0053).
- **The exit evidence** is 30 consecutive days of reports with every check passing for all 5 shops.
- **A failure** resets the shop's count only if its root cause is a product defect. An operator error that is
  corrected the same day is recorded but does not reset it.

## Consequences
- Devices must report their integrity results (tie-outs, replay, audit chain) to the cloud nightly. This is a small
  addition to the sync heartbeat in 9c/9l.
- The definition is stricter than the PRD §37 pass criteria, because it covers every day of real use, not one
  scripted run.
- An operator can re-run the report for any past day from the stored inputs.
