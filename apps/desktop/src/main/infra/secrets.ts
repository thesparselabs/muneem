import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppError } from '@muneem/contracts';

/** Small keyed secret store. Values never touch SQLite or plain config (NFR-007). */
export interface SecretStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
  readonly encrypted: boolean;
}

interface Codec { encrypt(plain: string): Buffer; decrypt(buf: Buffer): string }

export class FileSecretStore implements SecretStore {
  private cache: Record<string, string>;
  constructor(private readonly path: string, private readonly codec: Codec, readonly encrypted: boolean) {
    this.cache = this.load();
  }
  private load(): Record<string, string> {
    if (!existsSync(this.path)) return {};
    try {
      return JSON.parse(this.codec.decrypt(readFileSync(this.path))) as Record<string, string>;
    } catch {
      throw new AppError('SECRET_STORE_UNAVAILABLE', 'secret store could not be decrypted (OS profile changed?)');
    }
  }
  private flush(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, this.codec.encrypt(JSON.stringify(this.cache)), { mode: 0o600 });
  }
  get(key: string): string | null { return this.cache[key] ?? null; }
  set(key: string, value: string): void { this.cache[key] = value; this.flush(); }
  delete(key: string): void { delete this.cache[key]; this.flush(); }
}

export class MemorySecretStore implements SecretStore {
  private m = new Map<string, string>();
  readonly encrypted = true;
  get(k: string) { return this.m.get(k) ?? null; }
  set(k: string, v: string) { this.m.set(k, v); }
  delete(k: string) { this.m.delete(k); }
}

/** Uses Electron safeStorage (DPAPI on Windows). Dev-only plaintext fallback so Linux dev boxes without a keyring can run. */
export function createElectronSecretStore(path: string, safeStorage: { isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string }, allowPlaintextFallback: boolean, warn: (msg: string) => void): SecretStore {
  if (safeStorage.isEncryptionAvailable()) {
    return new FileSecretStore(path, { encrypt: (s) => safeStorage.encryptString(s), decrypt: (b) => safeStorage.decryptString(b) }, true);
  }
  if (!allowPlaintextFallback) throw new AppError('SECRET_STORE_UNAVAILABLE', 'OS credential storage is unavailable');
  warn('SECRET STORE: OS encryption unavailable — using PLAINTEXT secrets file. Development only.');
  return new FileSecretStore(path + '.plain.json', { encrypt: (s) => Buffer.from(s, 'utf8'), decrypt: (b) => b.toString('utf8') }, false);
}

export const SECRET_KEYS = {
  refreshToken: 'auth.refresh_token',
  accessToken: 'auth.access_token',
  accessExpiresAt: 'auth.access_expires_at',
  devicePrivateKey: 'device.private_key_pem',
} as const;
