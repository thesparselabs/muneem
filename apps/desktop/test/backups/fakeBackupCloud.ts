import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HttpBundleDownloader } from '../../src/main/sync/bundleDownloader.js';
import { TransportError, type Credentials } from '../../src/main/sync/transport.js';
import type { BackupTransport, CloudBackupDto, EscrowedKey } from '../../src/main/backups/transport.js';

interface Stored extends CloudBackupDto { status: 'pending' | 'ready'; object: Buffer | null }

// The Go /backups surface in miniature (presign, PUT, confirm with the checksum, list, presigned GET, escrow), for one member user.
export class FakeBackupCloud {
  readonly backups = new Map<string, Stored>();
  readonly keys = new Map<string, Map<string, string>>();
  readonly calls: string[] = [];
  private next = 1;

  transportFor(credentials: () => Credentials | null): BackupTransport {
    const device = () => {
      const id = credentials()?.deviceId;
      if (!id) throw new TransportError(401, 'DEVICE_NOT_REGISTERED');
      return id;
    };
    const log = <T>(op: string, f: () => T): Promise<T> => {
      this.calls.push(op);
      try { return Promise.resolve(f()); } catch (e) { return Promise.reject(e); }
    };
    return {
      escrowBackupKey: (k) => log('escrow', () => {
        device();
        const keys = this.keys.get(k.businessId) ?? this.keys.set(k.businessId, new Map()).get(k.businessId)!;
        if (keys.has(k.keyId) && keys.get(k.keyId) !== k.key) throw new TransportError(409, 'BACKUP_KEY_CONFLICT');
        keys.set(k.keyId, k.key);
      }),
      fetchBackupKey: (businessId, keyId) => log('fetchKey', (): EscrowedKey | null => {
        device();
        const keys = this.keys.get(businessId);
        const id = keyId ?? keys?.keys().next().value;
        const key = id ? keys?.get(id) : undefined;
        return key && id ? { businessId, keyId: id, key } : null;
      }),
      presignBackup: (r) => log('presign', () => {
        if (!this.keys.get(r.businessId)?.has(r.keyId)) throw new TransportError(404, 'BACKUP_KEY_NOT_FOUND');
        const backupId = `BK${String(this.next++).padStart(4, '0')}`;
        this.backups.set(backupId, { ...r, backupId, deviceId: device(), createdAt: new Date().toISOString(), status: 'pending', object: null });
        return { backupId, url: `https://objects.test/${backupId}`, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
      }),
      uploadBackup: (r, onProgress) => log('upload', () => {
        const b = this.backups.get(r.url.split('/').pop()!)!;
        b.object = readFileSync(r.path);
        onProgress(b.object.length);
      }),
      confirmBackup: (backupId) => log('confirm', () => {
        const b = this.backups.get(backupId);
        if (!b || b.deviceId !== device()) throw new TransportError(404, 'NOT_FOUND');
        if (!b.object) throw new TransportError(409, 'BACKUP_NOT_UPLOADED');
        if (b.object.length !== b.bytes || createHash('sha256').update(b.object).digest('hex') !== b.sha256) throw new TransportError(422, 'BACKUP_CHECKSUM_MISMATCH');
        b.status = 'ready';
        b.confirmedAt = new Date().toISOString();
        return this.dto(b);
      }),
      listBackups: (businessId) => log('list', () => {
        device();
        return [...this.backups.values()].filter((b) => b.businessId === businessId && b.status === 'ready').reverse().map((b) => this.dto(b));
      }),
      getBackup: (backupId) => log('get', () => {
        device();
        const b = this.backups.get(backupId);
        if (!b || b.status !== 'ready') throw new TransportError(404, 'NOT_FOUND');
        return { ...this.dto(b), url: `https://objects.test/${backupId}`, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
      }),
    };
  }

  private dto(b: Stored): CloudBackupDto {
    return {
      backupId: b.backupId, businessId: b.businessId, deviceId: b.deviceId, bytes: b.bytes, sha256: b.sha256, keyId: b.keyId, schemaVersion: b.schemaVersion,
      createdAt: b.createdAt, ...(b.confirmedAt && { confirmedAt: b.confirmedAt }),
    };
  }

  // Presigned GETs, with Range, as S3 serves them.
  readonly fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const object = this.backups.get(url.split('/').pop()!)?.object;
    if (!object) return new Response(null, { status: 404 });
    const range = (init?.headers as Record<string, string> | undefined)?.Range;
    const from = range ? Number(/bytes=(\d+)-/u.exec(range)![1]) : 0;
    return new Response(new Uint8Array(object.subarray(from)), { status: range ? 206 : 200 });
  }) as typeof fetch;

  downloader(): HttpBundleDownloader { return new HttpBundleDownloader(this.fetch); }
}
