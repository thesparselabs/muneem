import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHUNK_BYTES, keyIdOf, openFile, readHeader, sealFile } from '../../src/main/backups/archive.js';
import { BACKUP_FORMAT, signManifest, type BackupManifest, type SignedManifest } from '../../src/main/backups/manifest.js';
import { sha256File } from '../../src/main/backups/backupService.js';

function deviceKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), raw: (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32).toString('base64') };
}

async function sealed(plainBytes: number) {
  const dir = mkdtempSync(join(tmpdir(), 'muneem-archive-'));
  const plain = join(dir, 'plain.sqlite');
  writeFileSync(plain, randomBytes(plainBytes));
  const key = randomBytes(32);
  const device = deviceKey();
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT, version: 1, businessId: 'BIZ', deviceId: 'DEV', schemaVersion: 15, appVersion: 'test', createdAt: '2026-10-04T10:00:00.000Z',
    keyId: keyIdOf(key), cipher: 'aes-256-gcm', chunkBytes: CHUNK_BYTES, plainBytes, sha256: await sha256File(plain), rowCounts: { sale: 3 },
  };
  const signed = signManifest(manifest, device.pem, device.raw);
  const out = join(dir, 'backup.mbk');
  const r = await sealFile(plain, out, key, signed);
  return { dir, plain, out, key, device, signed, r };
}

// Rewrites the header JSON of a sealed file (the prefix is magic, u16 version, u32 length).
function rewriteHeader(path: string, signed: SignedManifest): void {
  const raw = readFileSync(path);
  const length = raw.readUInt32BE(10);
  const header = Buffer.from(JSON.stringify(signed), 'utf8');
  const prefix = Buffer.alloc(14);
  raw.copy(prefix, 0, 0, 14);
  prefix.writeUInt32BE(header.length, 10);
  writeFileSync(path, Buffer.concat([prefix, header, raw.subarray(14 + length)]));
}

const invalid = (why: RegExp) => expect.objectContaining({ code: 'BACKUP_INVALID', message: expect.stringMatching(why) });

describe('encrypted backup archive (8f, ADR-0047)', () => {
  it('round-trips a multi-chunk database and reports the hash of the file it wrote', async () => {
    const s = await sealed(2 * CHUNK_BYTES + 12_345);
    expect(s.r.sha256).toBe(await sha256File(s.out));
    expect(readFileSync(s.out).includes(readFileSync(s.plain).subarray(0, 64))).toBe(false);
    const back = join(s.dir, 'back.sqlite');
    const m = await openFile(s.out, s.key, back);
    expect(m.rowCounts).toEqual({ sale: 3 });
    expect(readFileSync(back).equals(readFileSync(s.plain))).toBe(true);
  });

  it('round-trips an empty file and exactly one chunk', async () => {
    for (const n of [0, CHUNK_BYTES]) {
      const s = await sealed(n);
      await expect(openFile(s.out, s.key)).resolves.toMatchObject({ plainBytes: n });
    }
  });

  it('refuses a flipped ciphertext byte', async () => {
    const s = await sealed(CHUNK_BYTES + 100);
    const raw = readFileSync(s.out);
    raw.writeUInt8(raw.readUInt8(raw.length - 40) ^ 1, raw.length - 40);
    writeFileSync(s.out, raw);
    await expect(openFile(s.out, s.key, join(s.dir, 'x.sqlite'))).rejects.toEqual(invalid(/chunk 1 failed authentication/));
  });

  it('refuses an edited manifest, and one re-signed by another device', async () => {
    const s = await sealed(5000);
    rewriteHeader(s.out, { ...s.signed, manifest: { ...s.signed.manifest, rowCounts: { sale: 4 } } });
    await expect(readHeader(s.out)).rejects.toEqual(invalid(/signature does not verify/));
    const forger = deviceKey();
    rewriteHeader(s.out, signManifest({ ...s.signed.manifest, rowCounts: { sale: 4 } }, forger.pem, forger.raw));
    await expect(openFile(s.out, s.key)).rejects.toEqual(invalid(/chunk 0 failed authentication/));
  });

  it('refuses the wrong key, by its id and by the tag', async () => {
    const s = await sealed(5000);
    await expect(openFile(s.out, randomBytes(32))).rejects.toEqual(invalid(/different key/));
  });

  it('refuses a truncated file, a dropped final chunk and trailing data', async () => {
    const s = await sealed(CHUNK_BYTES + 10);
    const raw = readFileSync(s.out);
    writeFileSync(s.out, raw.subarray(0, raw.length - 5));
    await expect(openFile(s.out, s.key)).rejects.toEqual(invalid(/truncated/));
    const lastChunk = 5 + 12 + 10 + 16;
    writeFileSync(s.out, raw.subarray(0, raw.length - lastChunk));
    await expect(openFile(s.out, s.key)).rejects.toEqual(invalid(/truncated/));
    writeFileSync(s.out, Buffer.concat([raw, Buffer.from('extra')]));
    await expect(openFile(s.out, s.key)).rejects.toEqual(invalid(/after its last chunk/));
  });

  it('refuses a file that is not a backup', async () => {
    const s = await sealed(10);
    writeFileSync(s.out, 'SQLite format 3\0 and then some');
    await expect(readHeader(s.out)).rejects.toEqual(invalid(/not a Muneem backup/));
  });
});
