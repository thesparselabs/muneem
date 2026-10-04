# Pilot runbook (Stage 9)

The pilot runs **5 shops for 30 days** with zero lost transactions and zero unexplained imbalances, as defined in
ADR-0054. This runbook is the plan; dates and names are filled in when the pilot starts.

## Before day 1 (all ops tasks)
- **Cloud:** VM, managed Postgres 16 with point-in-time recovery, managed S3 with the lifecycle rules, container
  registry, DNS and TLS (`docs/operations/deploy.md`), and secrets provisioned with offline copies.
- **Monitoring:** the monitoring VM, WireGuard and alert email (`docs/operations/deploy.md` §8). Every alert in
  `docs/runbooks/` has been triggered once in staging.
- **Release:** Azure Trusted Signing set up, the update host live, and the first signed build on **beta**
  (`docs/operations/release.md`).
- **Compliance:** the CA has signed `docs/compliance/ca-review-pack.md`, and any "no" answers are fixed.
- **Manual checks:** the Windows QA in `docs/qa/manual-checklist.md` has passed on the pilot's printer models.
- **Recovery:** a restore drill has been done and recorded.

## Choosing shops
- **GST:** regular-scheme registration. Composition returns (GSTR-4/CMP-08) are not generated yet.
- **Not pharmacies, not loose goods:** no batch or expiry tracking, and no weighed barcodes.
- **No reverse charge:** reverse-charge purchases are refused.
- **Hardware:** Windows 10/11 64-bit, at least 4 GB RAM, a receipt printer that is USB/Windows-installed or networked
  ESC/POS, and some internet daily.
- **People:** one owner who will report problems the same day.

## Onboarding a shop (per `docs/runbooks/ops-*.md`)
1. Create the organisation and owner, and install the beta build. The owner signs in and registers the device.
2. Set up the business, branch and terminal. Import the catalog (CSV/XLSX) with HSN codes, set opening stock and
   party openings, and record opening cash with a manual journal (posting matrix note).
3. Configure the printer and print a test receipt with ₹ and the shop's language.
4. Make one sale online and check it reaches the cloud. Turn on crash reporting if the owner agrees.
5. For a second terminal, use "Add this device" (hydration).

## Every day
- Review the **pilot health report** for each shop (ADR-0054) and the Grafana pilot dashboard. Act on any alert using
  its runbook.
- Resolve every dead letter and review item within 24 hours, and record whether each was a product defect or an
  operator error.

## Support
- **Proposed SLA:** billing is blocked → respond within 1 hour, 08:00–22:00 IST. Anything else → the next business
  day.
- **Fixes** ship through the **beta** channel with a staged rollout. Halt with rollout 0 if a release misbehaves
  (`docs/operations/release.md`).

## Known risks and mitigations
- **Set-off:** two offline devices can post a GST set-off for the same month. Set off from one designated device,
  online, after filing. Diagnostics flags duplicates.
- **No manager PIN override:** a manager acts from their own login.
- **Printing:** payment receipts and debit notes can't be printed; export them to PDF from Reports.
- **Upgrades:** a failed upgrade restores the data but not the program. Reinstall the previous version and halt the
  rollout.
- **Main-thread pauses:** heavy integrity checks on very large shops could pause the POS. 9f moves them off the main
  thread; verify on the pilot data.

## Exit
Thirty consecutive daily reports with every ADR-0054 check passing for all 5 shops. The reports and their inputs are
kept as the evidence.
