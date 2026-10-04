import { randomBytes } from 'node:crypto';
import { AppError } from '@muneem/contracts';
import type { SecretStore } from '../infra/secrets.js';
import { DATA_KEY_BYTES, keyIdOf } from './archive.js';

export interface DataKey { keyId: string; key: Buffer }

// The cloud half of key escrow (ADR-0047); null when this device cannot reach a cloud.
export interface KeyEscrow {
  escrowKey(businessId: string, keyId: string, keyB64: string): Promise<void>;
  fetchKey(businessId: string, keyId?: string): Promise<{ keyId: string; key: string } | null>;
}

interface Stored { current: string; keys: Record<string, string>; escrowed: string[] }

const secretKey = (businessId: string) => `backup.keys.${businessId}`;

// Per-business AES-256 data keys, kept only in the OS secret store and escrowed to the cloud.
export class BackupKeyring {
  constructor(private readonly secrets: SecretStore, private readonly escrow: () => KeyEscrow | null) {}

  private load(businessId: string): Stored | null {
    const raw = this.secrets.get(secretKey(businessId));
    return raw ? JSON.parse(raw) as Stored : null;
  }

  private save(businessId: string, s: Stored): void { this.secrets.set(secretKey(businessId), JSON.stringify(s)); }

  private remember(businessId: string, key: DataKey, opts: { current: boolean; escrowed: boolean }): void {
    const s = this.load(businessId) ?? { current: key.keyId, keys: {}, escrowed: [] };
    s.keys[key.keyId] = key.key.toString('base64');
    if (opts.current) s.current = key.keyId;
    if (opts.escrowed && !s.escrowed.includes(key.keyId)) s.escrowed.push(key.keyId);
    this.save(businessId, s);
  }

  // The key new backups use: this device's, else the business's escrowed one, else a fresh one (escrowed later).
  async current(businessId: string): Promise<DataKey> {
    const s = this.load(businessId);
    if (s) return { keyId: s.current, key: Buffer.from(s.keys[s.current]!, 'base64') };
    const adopted = await this.fromCloud(businessId).catch(() => null);
    if (adopted) return adopted;
    const key = randomBytes(DATA_KEY_BYTES);
    const fresh = { keyId: keyIdOf(key), key };
    this.remember(businessId, fresh, { current: true, escrowed: false });
    return fresh;
  }

  local(businessId: string, keyId: string): Buffer | null {
    const b64 = this.load(businessId)?.keys[keyId];
    return b64 ? Buffer.from(b64, 'base64') : null;
  }

  // A backup names its key; one this device never had comes from the escrow.
  async resolve(businessId: string, keyId: string): Promise<Buffer> {
    const key = this.local(businessId, keyId) ?? (await this.fromCloud(businessId, keyId))?.key;
    if (!key) throw new AppError('NOT_FOUND', 'The key for this backup is not on this device or in the cloud');
    return key;
  }

  async ensureEscrowed(businessId: string, keyId: string): Promise<void> {
    const s = this.load(businessId);
    if (s?.escrowed.includes(keyId)) return;
    const b64 = s?.keys[keyId];
    const escrow = this.escrow();
    if (!b64 || !escrow) throw new AppError('INVALID_STATE', 'The backup key cannot be escrowed from this device');
    await escrow.escrowKey(businessId, keyId, b64);
    this.remember(businessId, { keyId, key: Buffer.from(b64, 'base64') }, { current: false, escrowed: true });
  }

  private async fromCloud(businessId: string, keyId?: string): Promise<DataKey | null> {
    const got = await this.escrow()?.fetchKey(businessId, keyId);
    if (!got) return null;
    const key = Buffer.from(got.key, 'base64');
    if (key.length !== DATA_KEY_BYTES || keyIdOf(key) !== got.keyId) throw new AppError('BACKUP_INVALID', 'The cloud returned a key that does not match its id');
    const k = { keyId: got.keyId, key };
    this.remember(businessId, k, { current: !this.load(businessId), escrowed: true });
    return k;
  }
}
