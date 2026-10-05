# ADR-0047 — Backups and key escrow

**Status:** Accepted, 2026-10-04

## Context
FR-071 asks for encrypted cloud backup and restore; its clarification leaves the key holder open. Local backups today are plain copies with no retention. The user chose a cloud-escrowed key (2026-10-04).

## Decision
- **Format:** a backup is the online-backup SQLite copy, `quick_check`ed and encrypted with AES-256-GCM using a
  per-business data key. A signed manifest records the hash, schema version and row counts.
- **The key:** generated on first backup, kept in the OS credential store, and escrowed to the cloud. The cloud
  stores it wrapped by a server master key, from env/KMS.
- **Retention:** 7 daily, 4 weekly and 3 monthly backups locally; the cloud keeps the last 30.
- **Restore order:** first a local backup, then a cloud backup (fetch the escrowed key, download, verify, swap),
  then hydration.

## Consequences
- Built in Stage 8 (8f); amended with an "As built" note if reality differs.

## As built (8f)
- **File format (`.mbk`):** `MUNEEMBK` | u16 format version | u32 header length | header JSON `{manifest, signature,
  publicKey}`, then chunks of at most 1 MiB of plaintext, each `u32 length | u8 final | 12-byte random nonce |
  ciphertext | 16-byte GCM tag`. Each chunk's AAD is `sha256(everything before the chunks) | u32 index | u8 final`, so
  the data key authenticates the manifest, the chunk order and the end of the stream; a truncated or extended file,
  a reordered chunk or an edited manifest fails. Per-chunk random nonces keep the format streamable in both directions.
- **Manifest:** `{format: 'muneem-backup', version, businessId, deviceId (installation id), schemaVersion, appVersion,
  createdAt, keyId, cipher, chunkBytes, plainBytes, sha256 of the plaintext, rowCounts}`, signed (Ed25519, canonical
  JSON) with the device key; the raw public key travels with it. The signature names the device; the data key is what
  makes a backup trustworthy, since a forger's own signature cannot produce valid tags.
- **Verification before any restore:** signature, key id, every tag, final chunk, no trailing bytes, plaintext size and
  hash, then `quick_check`, a schema no newer than the app, and row counts equal to the manifest's.
- **Keys:** `keyId` = first 16 hex of `sha256("muneem-backup-key-id\0" | key)`. A device uses its own key, else adopts the
  business's escrowed one, else makes one. The cloud stores keys per **(business, key id)** rather than strictly one per
  business, so a device that made a key offline never conflicts; escrow is idempotent and a different key under the same
  id is `409 BACKUP_KEY_CONFLICT`. Keys are wrapped with AES-256-GCM under `MUNEEM_BACKUP_MASTER_KEY` with
  `business|keyId` as AAD. A presign is refused until its key is escrowed, so no cloud backup is unrestorable.
- **Cloud:** `POST /backups/presign` (records a pending row, presigned PUT), the device PUTs straight to object storage,
  `POST /backups/{id}/confirm` streams the object back and checks its size and SHA-256 (a mismatch deletes it, `422`),
  then keeps the newest 30 ready backups per business and drops pending ones older than a day. `GET /backups`,
  `GET /backups/{id}` (presigned GET, resumable by Range) and `GET /backups/key` are for any member's registered device;
  RLS as for snapshots, with a member read policy for reading by id.
- **Upload:** in the sync utility process, the whole object in one streamed PUT with its length (S3 refuses a chunked
  presigned PUT), retried with backoff (2 s, 8 s, 30 s), then left `failed` for the next trigger. Multipart resume was
  not worth it at shop database sizes. Only the newest waiting backup goes up; older waiting ones are superseded.
- **When:** a local backup every 6 hours (first after 10 minutes); the first scheduled one after 20 hours without an
  upload is the nightly upload; a register close (Z report) and "Back up now" back up and upload.
- **Retention:** newest per day for 7 days, per ISO week for 4 weeks, per month for 3 months, plus the last 3 safety
  copies (`pre_migration`, `pre_restore`). Pruned files are deleted; their `backup_log` rows stay with `pruned_at`.
  Pre-migration copies are still plain SQLite (written before the secret store opens); 8i owns that path.
- **Restore** keeps the device's identity (installation id, public key, cloud device id) in the restored file and
  carries the backup log over. Another device's backup also clears the active branch and till and the sync
  registration. A device restoring its own backup pulls its own changes back once (`includeOwn` until a full pull
  ends), since the cloud already has what it sent after the backup. A safety backup is taken first, the swap happens
  with the database closed, and the app relaunches. The restore is audited in the restored file.
- **Permissions:** listing, verifying and backing up need `diagnostics.view`; restoring needs `diagnostics.manage`
  (owner, and now manager). Restoring from setup checks the session and membership itself, as hydration does.
