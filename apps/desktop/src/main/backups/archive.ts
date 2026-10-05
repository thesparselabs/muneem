import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { open, rm, type FileHandle } from 'node:fs/promises';
import { AppError } from '@muneem/contracts';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, manifestSignatureValid, type BackupManifest, type SignedManifest } from './manifest.js';

// Layout and per-chunk AAD as in ADR-0047 "As built (8f)": the data key authenticates the manifest, chunk order and stream end.
const MAGIC = Buffer.from('MUNEEMBK', 'ascii');
const PREFIX_BYTES = MAGIC.length + 2 + 4;
const MAX_HEADER_BYTES = 1 << 20;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const CHUNK_HEAD_BYTES = 5;
export const CHUNK_BYTES = 1 << 20;
export const DATA_KEY_BYTES = 32;

const invalid = (why: string) => new AppError('BACKUP_INVALID', why);

export function keyIdOf(key: Buffer): string {
  return createHash('sha256').update('muneem-backup-key-id\0').update(key).digest('hex').slice(0, 16);
}

function aad(headerHash: Buffer, index: number, final: boolean): Buffer {
  const b = Buffer.alloc(headerHash.length + 5);
  headerHash.copy(b);
  b.writeUInt32BE(index, headerHash.length);
  b.writeUInt8(final ? 1 : 0, headerHash.length + 4);
  return b;
}

function prefixOf(signed: SignedManifest): Buffer {
  const header = Buffer.from(JSON.stringify(signed), 'utf8');
  const fixed = Buffer.alloc(PREFIX_BYTES);
  MAGIC.copy(fixed);
  fixed.writeUInt16BE(BACKUP_FORMAT_VERSION, MAGIC.length);
  fixed.writeUInt32BE(header.length, MAGIC.length + 2);
  return Buffer.concat([fixed, header]);
}

async function readExactly(fh: FileHandle, length: number, position: number): Promise<Buffer> {
  const buf = Buffer.alloc(length);
  const { bytesRead } = await fh.read(buf, 0, length, position);
  if (bytesRead !== length) throw invalid('the backup file is truncated');
  return buf;
}

export interface SealResult { bytes: number; sha256: string }

// Encrypts a plain SQLite copy into a backup file; the result's hash is of the file written (what the cloud checks).
export async function sealFile(plainPath: string, outPath: string, key: Buffer, signed: SignedManifest): Promise<SealResult> {
  const prefix = prefixOf(signed);
  const headerHash = createHash('sha256').update(prefix).digest();
  const fileHash = createHash('sha256');
  const src = await open(plainPath, 'r');
  const out = await open(outPath, 'w');
  try {
    const size = (await src.stat()).size;
    let written = 0;
    const write = async (b: Buffer) => { await out.write(b); fileHash.update(b); written += b.length; };
    await write(prefix);
    const buf = Buffer.alloc(CHUNK_BYTES);
    let position = 0;
    for (let index = 0; ; index++) {
      const { bytesRead } = await src.read(buf, 0, CHUNK_BYTES, position);
      position += bytesRead;
      const final = position >= size;
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, nonce).setAAD(aad(headerHash, index, final));
      const head = Buffer.alloc(CHUNK_HEAD_BYTES);
      head.writeUInt32BE(bytesRead);
      head.writeUInt8(final ? 1 : 0, 4);
      await write(Buffer.concat([head, nonce, cipher.update(buf.subarray(0, bytesRead)), cipher.final(), cipher.getAuthTag()]));
      if (final) break;
    }
    await out.sync();
    return { bytes: written, sha256: fileHash.digest('hex') };
  } finally {
    await src.close();
    await out.close();
  }
}

export interface BackupHeader { signed: SignedManifest; dataOffset: number; headerHash: Buffer }

// Reads and checks the signed manifest without the key: format, version and the device signature.
export async function readHeader(path: string): Promise<BackupHeader> {
  const fh = await open(path, 'r');
  try {
    const fixed = await readExactly(fh, PREFIX_BYTES, 0);
    if (!fixed.subarray(0, MAGIC.length).equals(MAGIC)) throw invalid('not a Muneem backup file');
    if (fixed.readUInt16BE(MAGIC.length) !== BACKUP_FORMAT_VERSION) throw invalid('this backup was made by a newer version of Muneem');
    const length = fixed.readUInt32BE(MAGIC.length + 2);
    if (length > MAX_HEADER_BYTES) throw invalid('the backup header is too large');
    const header = await readExactly(fh, length, PREFIX_BYTES);
    let signed: SignedManifest;
    try { signed = JSON.parse(header.toString('utf8')) as SignedManifest; } catch { throw invalid('the backup manifest is unreadable'); }
    const m = signed?.manifest;
    if (m?.format !== BACKUP_FORMAT || m.version !== BACKUP_FORMAT_VERSION || typeof m.keyId !== 'string' || typeof m.sha256 !== 'string') throw invalid('the backup manifest is malformed');
    if (!manifestSignatureValid(signed)) throw invalid('the backup manifest signature does not verify');
    return { signed, dataOffset: PREFIX_BYTES + length, headerHash: createHash('sha256').update(Buffer.concat([fixed, header])).digest() };
  } finally {
    await fh.close();
  }
}

// Decrypts and checks every chunk tag, the chunk order, the end of the stream, the size and the plaintext hash.
// With an outPath the plaintext is written there (and removed again if any check fails); without one it is only verified.
export async function openFile(inPath: string, key: Buffer, outPath?: string): Promise<BackupManifest> {
  const { signed, dataOffset, headerHash } = await readHeader(inPath);
  const m = signed.manifest;
  if (keyIdOf(key) !== m.keyId) throw invalid('this backup was encrypted with a different key');
  const fh = await open(inPath, 'r');
  const out = outPath ? await open(outPath, 'w') : null;
  try {
    const size = (await fh.stat()).size;
    const hash = createHash('sha256');
    let position = dataOffset;
    let plainBytes = 0;
    for (let index = 0; ; index++) {
      const head = await readExactly(fh, CHUNK_HEAD_BYTES + NONCE_BYTES, position);
      const length = head.readUInt32BE(0);
      const final = head.readUInt8(4) === 1;
      if (length > m.chunkBytes) throw invalid('a backup chunk is larger than the manifest allows');
      const body = await readExactly(fh, length + TAG_BYTES, position + head.length);
      position += head.length + body.length;
      const decipher = createDecipheriv('aes-256-gcm', key, head.subarray(CHUNK_HEAD_BYTES)).setAAD(aad(headerHash, index, final));
      decipher.setAuthTag(body.subarray(length));
      let plain: Buffer;
      try { plain = Buffer.concat([decipher.update(body.subarray(0, length)), decipher.final()]); } catch { throw invalid(`backup chunk ${index} failed authentication (tampered or corrupt)`); }
      hash.update(plain);
      plainBytes += plain.length;
      if (out) await out.write(plain);
      if (final) break;
    }
    if (position !== size) throw invalid('the backup file has data after its last chunk');
    if (plainBytes !== m.plainBytes || hash.digest('hex') !== m.sha256) throw invalid('the restored database does not match the manifest hash');
    if (out) await out.sync();
    return m;
  } catch (e) {
    if (out) { await out.close(); await rm(outPath!, { force: true }); }
    throw e;
  } finally {
    await fh.close();
    if (out) await out.close().catch(() => undefined);
  }
}
