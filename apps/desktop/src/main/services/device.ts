import { createHash, generateKeyPairSync } from 'node:crypto';
import { hostname } from 'node:os';
import { newUlid } from '@muneem/domain';
import { getMeta, setMeta, META_KEYS, type Db } from '@muneem/db-sqlite';
import type { HttpComponents } from '@muneem/contracts';
import { SECRET_KEYS, type SecretStore } from '../infra/secrets.js';
import type { CloudClient } from '../infra/cloudClient.js';
import type { Loggers } from '../infra/logger.js';

type DeviceDto = HttpComponents['schemas']['Device'];

export interface DeviceServiceDeps { db: () => Db; secrets: SecretStore; cloud: () => CloudClient; loggers: Loggers; appVersion: string; schemaVersion: () => number; platform: string }

/**
 * Identity of this installation.
 * - installation_id: ULID minted on first run; used as the LOCAL device id on every audit/outbox row
 *   (stable from the first write, before the cloud has assigned anything).
 * - device_id: assigned by the cloud at registration; sent on every request as X-Device-Id.
 * - Ed25519 keypair: private key in the OS secret store, public key (raw 32 bytes, base64) in app_meta.
 */
export class DeviceService {
  constructor(private readonly d: DeviceServiceDeps) {}

  ensureIdentity(): { installationId: string; publicKeyB64: string } {
    const db = this.d.db();
    let installationId = getMeta(db, META_KEYS.installationId);
    if (!installationId) { installationId = newUlid(); setMeta(db, META_KEYS.installationId, installationId); }
    let publicKeyB64 = getMeta(db, META_KEYS.devicePublicKey);
    if (!publicKeyB64 || !this.d.secrets.get(SECRET_KEYS.devicePrivateKey)) {
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      this.d.secrets.set(SECRET_KEYS.devicePrivateKey, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
      // raw 32-byte Ed25519 public key = last 32 bytes of the SPKI DER
      publicKeyB64 = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32).toString('base64');
      setMeta(db, META_KEYS.devicePublicKey, publicKeyB64);
      setMeta(db, META_KEYS.deviceId, ''); // a new key invalidates any prior registration
      this.d.loggers.app.info({ installationId }, 'device keypair generated');
    }
    return { installationId, publicKeyB64 };
  }

  installationId(): string { return this.ensureIdentity().installationId; }
  /** Local device id used in audit/outbox rows. */
  localDeviceId(): string { return this.installationId(); }
  cloudDeviceId(): string | null { return getMeta(this.d.db(), META_KEYS.deviceId) || null; }
  privateKeyPem(): string | null { return this.d.secrets.get(SECRET_KEYS.devicePrivateKey); }

  info() {
    const { installationId } = this.ensureIdentity();
    const deviceId = this.cloudDeviceId();
    return { deviceId, installationId, registered: !!deviceId, appVersion: this.d.appVersion, schemaVersion: this.d.schemaVersion(), platform: this.d.platform };
  }

  machineFingerprint(): string {
    return createHash('sha256').update(`${hostname()}|${this.d.platform}|${process.arch}`).digest('hex');
  }

  /** After an online login: register once; idempotent on installation_id server-side. */
  async registerIfNeeded(businessId?: string | null): Promise<string> {
    const existing = this.cloudDeviceId();
    if (existing) return existing;
    const { installationId, publicKeyB64 } = this.ensureIdentity();
    const r = await this.d.cloud().request<DeviceDto>('POST', '/devices/register', {
      installation_id: installationId, public_key: publicKeyB64, machine_fingerprint: this.machineFingerprint(),
      platform: this.d.platform, app_version: this.d.appVersion, schema_version: this.d.schemaVersion(),
      name: hostname(), ...(businessId && { business_id: businessId }),
    });
    setMeta(this.d.db(), META_KEYS.deviceId, r.data.id);
    setMeta(this.d.db(), META_KEYS.deviceRegisteredAt, new Date().toISOString());
    this.d.loggers.app.info({ deviceId: r.data.id }, 'device registered');
    return r.data.id;
  }
}
