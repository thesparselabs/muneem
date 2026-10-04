import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { canonicalJson, type Db } from '@muneem/db-sqlite';

export const BACKUP_FORMAT = 'muneem-backup';
export const BACKUP_FORMAT_VERSION = 1;

// What a backup is, signed by the device that made it; the ciphertext's AAD covers it too.
export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  businessId: string;
  deviceId: string;
  schemaVersion: number;
  appVersion: string;
  createdAt: string;
  keyId: string;
  cipher: 'aes-256-gcm';
  chunkBytes: number;
  plainBytes: number;
  sha256: string;
  rowCounts: Record<string, number>;
}

export interface SignedManifest { manifest: BackupManifest; signature: string; publicKey: string }

const COUNTED = ['business', 'branch', 'terminal', 'user', 'product', 'customer', 'supplier', 'sale', 'sale_item', 'purchase', 'payment', 'expense',
  'stock_movement', 'journal_entry', 'journal_line', 'party_ledger_entry', 'audit_log', 'sync_outbox'] as const;

export function rowCounts(db: Db): Record<string, number> {
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all() as string[]);
  const out: Record<string, number> = {};
  for (const t of COUNTED) if (present.has(t)) out[t] = db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get() as number;
  return out;
}

// Ed25519 raw public keys travel as base64 of 32 bytes (as the cloud registers them); node wants SPKI.
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const publicKeyFromRaw = (raw: string) => createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(raw, 'base64')]), format: 'der', type: 'spki' });

export function signManifest(manifest: BackupManifest, privateKeyPem: string, publicKeyB64: string): SignedManifest {
  const signature = sign(null, Buffer.from(canonicalJson(manifest), 'utf8'), createPrivateKey(privateKeyPem)).toString('base64');
  return { manifest, signature, publicKey: publicKeyB64 };
}

export function manifestSignatureValid(s: SignedManifest): boolean {
  try {
    return verify(null, Buffer.from(canonicalJson(s.manifest), 'utf8'), publicKeyFromRaw(s.publicKey), Buffer.from(s.signature, 'base64'));
  } catch {
    return false;
  }
}
