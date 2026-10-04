# Releasing the Muneem desktop app

This page covers how a Windows installer is built, signed and published, and how it moves from `dev` to `beta` (the
pilot shops) to `stable`. The decisions are in ADR-0056, and the updater that consumes the result is in ADR-0049.

| File | What it does |
|---|---|
| `.github/workflows/release.yml` | Runs on a `v*` tag or by hand. Builds, signs, makes the SBOMs and checksums, publishes, and creates the GitHub Release. |
| `.github/workflows/promote.yml` | Runs by hand only. Copies a built release to a channel, or changes its rollout. |
| `scripts/release-version.ts` | Turns the tag into a version and a channel, and stamps the version into the build. |
| `scripts/release-manifest.ts` | Writes `<channel>/latest.yml` and the `releases/<version>/` archive. |
| `scripts/release-promote.ts` | Rewrites `latest.yml` for another channel or percentage, after checking every file's sha512. |
| `scripts/release-upload.sh` | Uploads one folder to the bucket, with `latest.yml` last. |

## Layout of the update host
`updates.muneem.app` serves one bucket:

```
dev/     latest.yml  Muneem-Setup-<v>.exe(.blockmap) …
beta/    …
stable/  …
releases/<version>/   immutable: installer, blockmap, latest.yml (no rollout), build-info.json,
                      muneem-desktop.cdx.json, muneem-cloud.cdx.json, SHA256SUMS.txt
```

## 1. Set up (once)
These are ops tasks. None of them is in the repo.

**Azure Trusted Signing**
- Create a Trusted Signing account in a region near the runners (for example East US,
  `https://eus.codesigning.azure.net`).
- Complete **identity validation** for the company (public trust; this takes days, so start early).
- Create a **certificate profile** of type *Public Trust*.
- Register an Entra application with a client secret, and give it the *Trusted Signing Certificate Profile Signer*
  role on the account.
- The **publisher name** is the certificate's CN, which is the validated company name. Set it once and never change
  it: every signed installation checks updates against it.

**The update host**
- Create a bucket on an S3-compatible store (R2, S3, Spaces or B2). Make it publicly readable, or put a CDN in front of
  it, at `https://updates.muneem.app/`.
- Make `updates.muneem.app` a CNAME to it, served over HTTPS only.
- Create an access key that can only put, get, head and list objects in that bucket. CI never deletes anything.
- An optional lifecycle rule may expire `releases/<version>/` after a year, but only for versions no channel serves.

**Repository secrets and variables** (Settings → Secrets and variables → Actions)

| Name | Kind | What |
|---|---|---|
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | secret | The signer app registration. |
| `AZURE_SIGNING_ENDPOINT` | variable | The account's endpoint, e.g. `https://eus.codesigning.azure.net`. |
| `AZURE_SIGNING_ACCOUNT` | variable | The Trusted Signing account name. |
| `AZURE_CERT_PROFILE` | variable | The certificate profile name. |
| `MUNEEM_PUBLISHER_NAME` | variable | The certificate's CN, exactly. |
| `UPDATES_S3_ACCESS_KEY_ID`, `UPDATES_S3_SECRET_ACCESS_KEY` | secret | The bucket key. |
| `UPDATES_S3_BUCKET` | variable | The bucket name. |
| `UPDATES_S3_ENDPOINT` | variable | Empty for AWS; otherwise the provider's S3 endpoint (e.g. R2's account URL). |
| `UPDATES_S3_REGION` | variable | Defaults to `auto`. |
| `MUNEEM_CRASH_DSN` | variable | The crash collector's DSN, baked into packaged builds (9c). Leave it unset for none. |
| `MUNEEM_ALLOW_UNSIGNED_PUBLISH` | variable | `true` lets an unsigned build go to `beta`. Use it only before the first signed release. |

If the signing settings are missing, the build is **unsigned**: the job warns, the GitHub Release says "(unsigned)",
and only `dev` receives it. If the bucket settings are missing, nothing is uploaded and the release is on GitHub only.
Neither case fails the run.

## 2. Cut a release
1. Merge to `main` with CI green.
2. Tag it:
   - `v1.5.0-dev.1` publishes to **dev**;
   - `v1.5.0-beta.1` or `v1.5.0-rc.1` publishes to **beta**;
   - a plain `v1.5.0` also publishes to **beta**, because stable is reached only by promotion.

   Run `git tag v1.5.0 && git push origin v1.5.0`.
3. Or run **release** by hand (Actions → release → Run workflow) with a version, a channel (`auto`, `dev` or `beta`)
   and a rollout percentage.
4. Check the run:
   - the *verify the Authenticode signature* step passed;
   - the GitHub Release lists the installer, the blockmap, `latest.yml`, both SBOMs and `SHA256SUMS.txt`;
   - `https://updates.muneem.app/<channel>/latest.yml` shows the new version.

   A version can be published only once. To fix a bad build, bump the version.

The `symbols-<version>` artifact on the run holds the source maps and the native module, for symbolicating crash
reports. It is kept for 90 days; copy it to private storage if you need it longer. It is never shipped or published.

## 3. Roll out: dev → beta → stable
Every move uses **promote** (Actions → promote → Run workflow). Its inputs are the version, `from`, `to` and the
rollout percentage. It never rebuilds: it checks each file's sha512 against the source `latest.yml`, copies the files,
and changes only `stagingPercentage`.

| Step | from | to | rollout |
|---|---|---|---|
| A dev build is ready for the pilot | `dev` | `beta` | 100 |
| The pilot is clean for a week (ADR-0054's measures) | `beta` | `stable` | 10 |
| No new errors after two days | `stable` | `stable` | 50 |
| Then | `stable` | `stable` | 100 |

A shop takes the release when the cohort of its installation id is below the percentage. Raising the percentage only
adds shops.

## 4. Halt
Run promote with `from` = `to` = the channel and **rollout 0**. Shops that already installed the release keep it, and
no other shop takes it. Then fix the problem and cut a new version.

## 5. Roll back
- **The program.** Run promote with `from: archive`, the previous good version, `to: stable` and rollout 100.
  - New shops, and shops that had not taken the bad version yet, stay on or get the good one.
  - Shops already on the bad version stay on it. The updater never downgrades.
  - Their way out is a fixed newer version, which is the usual answer.
  - A manual reinstall of the previous installer from the GitHub Release is safe only when the bad version changed no
    schema, or its migration was rolled back. Otherwise the older program would open a newer database. Uninstalling
    keeps the shop's data.
- **The data.** This is automatic (ADR-0049). A failed migration restores the pre-migration backup on the device and
  asks the user to reinstall the previous version.

## 6. Verify a download
In PowerShell on Windows:

```powershell
Get-AuthenticodeSignature .\Muneem-Setup-1.5.0.exe | Format-List Status, SignerCertificate
# Status must be Valid, and the subject's CN the publisher name above.
(Get-FileHash .\Muneem-Setup-1.5.0.exe -Algorithm SHA256).Hash.ToLower()
# The hash must match the installer's line in SHA256SUMS.txt from the same release.
```

On Linux or macOS, run `sha256sum -c SHA256SUMS.txt --ignore-missing` beside the downloaded files. To check the
signature there, use `osslsigncode verify Muneem-Setup-1.5.0.exe`.
