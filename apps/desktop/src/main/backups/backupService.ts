import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, type BackupHealth, type BackupKind, type BackupVerification } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import {
  backupDatabase, backupHealth, currentSchemaVersion, getBackupLog, getMeta, insertBackupLog, lastUploadChosenAt, listBackupLog, listBusinesses,
  markBackupPruned, META_KEYS, MIGRATIONS, nativeBindingOf, openCopy, quickCheck, setMeta, type BackupLogEntry, type Db,
} from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import { CHUNK_BYTES, openFile, readHeader, sealFile } from './archive.js';
import type { BackupKeyring } from './keyring.js';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, rowCounts, signManifest, type BackupManifest } from './manifest.js';
import { backupsToPrune, DEFAULT_RETENTION, type RetentionPolicy } from './retention.js';

export interface DeviceSigner { installationId(): string; publicKey(): string; privateKeyPem(): string | null }

export interface BackupServiceDeps {
  db: () => Db;
  dir: string;
  keyring: BackupKeyring;
  device: DeviceSigner;
  sessionBusinessId: () => string | null;
  appVersion: string;
  now: () => number;
  log: Loggers['app'];
  retention?: RetentionPolicy;
}

const STALE_HOURS = 26;
const NIGHTLY_EVERY_MS = 20 * 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const stamp = (at: string) => at.replace(/[:.]/g, '-');

export async function sha256File(path: string): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('hex');
}

const removeSqlite = (path: string) => { for (const s of ['', '-wal', '-shm']) rmSync(path + s, { force: true }); };

export interface CheckedCopy { manifest: BackupManifest | null; rowCounts: Record<string, number> }

// Encrypted local backups (ADR-0047): copy, verify, seal, verify the sealed file, log, prune.
export class BackupService {
  constructor(private readonly d: BackupServiceDeps) {}

  // The business a backup belongs to: the session's, else the last one used here, else the only one on the device.
  businessId(): string | null {
    const db = this.d.db();
    const fromMeta = getMeta(db, META_KEYS.activeBusinessId) || null;
    return this.d.sessionBusinessId() ?? fromMeta ?? listBusinesses(db)[0]?.id ?? null;
  }

  // A scheduled backup is the nightly cloud upload when none was chosen for about a day.
  nightlyDue(): boolean {
    const last = lastUploadChosenAt(this.d.db());
    return !last || this.d.now() - Date.parse(last) >= NIGHTLY_EVERY_MS;
  }

  async run(kind: BackupKind, opts: { upload?: boolean } = {}): Promise<BackupLogEntry> {
    const db = this.d.db();
    const businessId = this.businessId();
    if (!businessId) throw new AppError('INVALID_STATE', 'There is no business on this device to back up yet');
    mkdirSync(this.d.dir, { recursive: true });
    const id = newUlid();
    const createdAt = iso(this.d.now());
    const plain = join(this.d.dir, `.plain-${id}.sqlite`);
    const path = join(this.d.dir, `muneem-${stamp(createdAt)}-${kind}.mbk`);
    const base = { id, path, kind, createdAt, businessId, schemaVersion: currentSchemaVersion(db) };
    try {
      const copy = await backupDatabase(db, plain);
      if (!copy.verified) throw new Error('the database copy failed quick_check');
      const manifest = await this.manifest(db, plain, businessId, createdAt);
      const key = await this.d.keyring.current(businessId);
      const signed = signManifest({ ...manifest, keyId: key.keyId }, this.privateKey(), this.d.device.publicKey());
      const sealed = await sealFile(plain, path, key.key, signed);
      await openFile(path, key.key);
      insertBackupLog(db, { ...base, bytes: sealed.bytes, verified: true, encrypted: true, keyId: key.keyId, sha256: sealed.sha256, cloudStatus: opts.upload ? 'pending' : 'none' });
      setMeta(db, META_KEYS.lastBackupAt, createdAt);
      this.prune();
      return getBackupLog(db, id)!;
    } catch (e) {
      rmSync(path, { force: true });
      const error = e instanceof Error ? e.message : String(e);
      this.d.log.error({ code: 'BACKUP_FAILED', kind, err: error }, 'backup failed');
      insertBackupLog(db, { ...base, path: '', bytes: 0, verified: false, error });
      throw e instanceof AppError ? e : new AppError('INTERNAL', `Backup failed: ${error}`);
    } finally {
      removeSqlite(plain);
    }
  }

  private privateKey(): string {
    const pem = this.d.device.privateKeyPem();
    if (!pem) throw new AppError('SECRET_STORE_UNAVAILABLE', 'The device key is missing, so a backup cannot be signed');
    return pem;
  }

  private async manifest(db: Db, plain: string, businessId: string, createdAt: string): Promise<Omit<BackupManifest, 'keyId'>> {
    const copy = openCopy(plain, { nativeBinding: nativeBindingOf(db) });
    let counts: Record<string, number>;
    try { counts = rowCounts(copy); } finally { copy.close(); }
    const size = statSync(plain).size;
    return {
      format: BACKUP_FORMAT, version: BACKUP_FORMAT_VERSION, businessId, deviceId: this.d.device.installationId(), schemaVersion: currentSchemaVersion(db),
      appVersion: this.d.appVersion, createdAt, cipher: 'aes-256-gcm', chunkBytes: CHUNK_BYTES, plainBytes: size, sha256: await sha256File(plain), rowCounts: counts,
    };
  }

  list(): BackupLogEntry[] {
    return listBackupLog(this.d.db()).filter((b) => b.verified && existsSync(b.path));
  }

  get(id: string): BackupLogEntry {
    const b = getBackupLog(this.d.db(), id);
    if (!b || b.prunedAt || !b.verified || !existsSync(b.path)) throw new AppError('NOT_FOUND', 'That backup is not on this device');
    return b;
  }

  // Retention applies to verified backups still on disk; their files go, their rows stay as history.
  prune(): number {
    const db = this.d.db();
    const live = listBackupLog(db).filter((b) => b.verified);
    const gone = new Set(backupsToPrune(live, this.d.retention ?? DEFAULT_RETENTION));
    const at = iso(this.d.now());
    for (const b of live) {
      if (!gone.has(b.id)) continue;
      rmSync(b.path, { force: true });
      markBackupPruned(db, b.id, at);
    }
    return gone.size;
  }

  health(): BackupHealth {
    const h = backupHealth(this.d.db());
    const ageHours = h.lastSuccessAt ? Math.round((this.d.now() - Date.parse(h.lastSuccessAt)) / 360_000) / 10 : null;
    const failing = !!h.lastErrorAt && (!h.lastSuccessAt || h.lastErrorAt > h.lastSuccessAt);
    const status = failing ? 'failing' : ageHours === null ? 'never' : ageHours > STALE_HOURS ? 'stale' : 'ok';
    return { status, ageHours, ...h };
  }

  async verify(id: string): Promise<BackupVerification> {
    const b = this.get(id);
    const out = join(this.d.dir, `.verify-${newUlid()}.sqlite`);
    try {
      const checked = await this.decrypt(b.path, out);
      return { ok: true, detail: 'The backup decrypts, matches its signed manifest and passes quick_check', createdAt: checked.manifest?.createdAt ?? b.createdAt,
        schemaVersion: checked.manifest?.schemaVersion ?? b.schemaVersion, rowCounts: checked.rowCounts };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e), createdAt: b.createdAt, schemaVersion: b.schemaVersion, rowCounts: null };
    } finally {
      removeSqlite(out);
    }
  }

  // Writes the database a backup holds to `out` and checks it: tag, signature and hash, then quick_check, schema and row counts.
  // A plain backup from before 8f is only copied and checked.
  async decrypt(path: string, out: string): Promise<CheckedCopy> {
    let manifest: BackupManifest | null = null;
    if (path.endsWith('.mbk')) {
      const { signed } = await readHeader(path);
      manifest = await openFile(path, await this.d.keyring.resolve(signed.manifest.businessId, signed.manifest.keyId), out);
    } else {
      copyFileSync(path, out);
    }
    return { manifest, rowCounts: this.checkCopy(out, manifest) };
  }

  private checkCopy(path: string, manifest: BackupManifest | null): Record<string, number> {
    const copy = openCopy(path, { nativeBinding: nativeBindingOf(this.d.db()) });
    try {
      if (!quickCheck(copy).ok) throw new AppError('BACKUP_INVALID', 'The backup database fails quick_check');
      const version = currentSchemaVersion(copy);
      if (version > (MIGRATIONS.at(-1)?.version ?? 0)) throw new AppError('BACKUP_INVALID', 'This backup is from a newer version of Muneem; update the app first');
      const counts = rowCounts(copy);
      if (manifest && JSON.stringify(counts) !== JSON.stringify(manifest.rowCounts)) throw new AppError('BACKUP_INVALID', 'The backup row counts do not match its manifest');
      return counts;
    } finally {
      copy.close();
    }
  }
}
