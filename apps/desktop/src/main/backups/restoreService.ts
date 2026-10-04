import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, type BackupRef, type BackupVerification, type CloudBackup, type RestoreResult } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import {
  appendAudit, currentSchemaVersion, deleteMeta, getMembership, getMeta, getSyncDevice, listBusinesses, META_KEYS, nativeBindingOf, openCopy, setMeta, type Db,
} from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import type { SessionService } from '../services/session.js';
import { isTransportError, type BundleFetcher } from '../sync/transport.js';
import { sha256File, type BackupService, type CheckedCopy } from './backupService.js';
import type { BackupManifest } from './manifest.js';
import type { BackupTransport, CloudBackupDownload, CloudBackupDto } from './transport.js';

// Closes the live database, puts the restored file in its place and restarts the app (Electron), or just swaps (tests).
export interface RestoreHost { install(restoredFile: string): void }

export interface RestoreDeps {
  db: () => Db;
  dir: string;
  backups: BackupService;
  transport: () => BackupTransport | null;
  fetcher: BundleFetcher;
  device: { installationId(): string; cloudDeviceId(): string | null };
  session: SessionService;
  host: RestoreHost;
  log: Loggers['app'];
  auditScope: string;
}

const DOWNLOAD_ATTEMPTS = 3;
// What makes a database this device's rather than the backup's: its identity is kept across a restore.
const IDENTITY = [META_KEYS.installationId, META_KEYS.devicePublicKey, META_KEYS.deviceId, META_KEYS.deviceRegisteredAt] as const;

const removeSqlite = (path: string) => { for (const s of ['', '-wal', '-shm']) rmSync(path + s, { force: true }); };

export const cloudView = (b: CloudBackupDto): CloudBackup => ({
  backupId: b.backupId, businessId: b.businessId, deviceId: b.deviceId, createdAt: b.confirmedAt ?? b.createdAt, bytes: b.bytes, schemaVersion: b.schemaVersion, keyId: b.keyId,
});

// ADR-0047 restore order: a local backup, or a cloud one (escrowed key, download, verify), swapped in and restarted.
export class RestoreService {
  constructor(private readonly d: RestoreDeps) {}

  private transport(): BackupTransport {
    const t = this.d.transport();
    if (!t || !this.d.device.cloudDeviceId()) throw new AppError('INVALID_STATE', 'This device is not registered with the cloud yet. Sign in online first.');
    return t;
  }

  async listCloud(businessId: string): Promise<CloudBackup[]> {
    return (await this.transport().listBackups(businessId)).map(cloudView);
  }

  async verify(ref: BackupRef): Promise<BackupVerification> {
    if (ref.source === 'local') return this.d.backups.verify(ref.id);
    const out = this.tempPath('verify');
    try {
      const checked = await this.d.backups.decrypt(await this.download(ref.id), out);
      return { ok: true, detail: 'The cloud backup downloads, decrypts, matches its signed manifest and passes quick_check',
        createdAt: checked.manifest?.createdAt ?? null, schemaVersion: checked.manifest?.schemaVersion ?? null, rowCounts: checked.rowCounts };
    } catch (e) {
      if (!(e instanceof AppError) || e.code !== 'BACKUP_INVALID') throw e;
      return { ok: false, detail: e.message, createdAt: null, schemaVersion: null, rowCounts: null };
    } finally {
      removeSqlite(out);
    }
  }

  // Diagnostics → Backups: one of this business's backups, local or cloud.
  async restore(ref: BackupRef): Promise<RestoreResult> {
    const userId = this.d.session.require().user.id;
    if (ref.source === 'local') return this.install(this.d.backups.get(ref.id).path, userId);
    const path = await this.download(ref.id, this.d.backups.businessId());
    return this.install(path, userId);
  }

  // Setup on a new device: the newest cloud backup of a business this user belongs to; a pull then catches up.
  async restoreFromCloud(businessId: string): Promise<RestoreResult> {
    const s = this.d.session.require();
    if (!getMembership(this.d.db(), s.user.id, businessId)) throw new AppError('PERMISSION_DENIED', 'You are not a member of that business');
    const newest = (await this.transport().listBackups(businessId))[0];
    if (!newest) throw new AppError('NOT_FOUND', 'This business has no cloud backup yet. Add this device instead.');
    return this.install(await this.download(newest.backupId, businessId), s.user.id);
  }

  // A presigned GET, resumed from what is already on disk, then checked against the size and hash the cloud confirmed.
  private async download(backupId: string, businessId?: string | null): Promise<string> {
    mkdirSync(this.d.dir, { recursive: true });
    const path = join(this.d.dir, `cloud-${backupId.replace(/[^A-Za-z0-9]/g, '')}.mbk`);
    let dto: CloudBackupDownload | null = null;
    for (let attempt = 1; ; attempt++) {
      try {
        dto = await this.transport().getBackup(backupId);
        if (businessId && dto.businessId !== businessId) throw new AppError('NOT_FOUND', 'That cloud backup belongs to another business');
        const offset = existsSync(path) ? Math.min(statSync(path).size, dto.bytes) : 0;
        if (offset < dto.bytes) await this.d.fetcher.download({ url: dto.url, path, offset }, () => undefined);
        break;
      } catch (e) {
        if (attempt >= DOWNLOAD_ATTEMPTS || !isTransportError(e)) throw e;
        this.d.log.warn({ backupId, attempt, err: String(e) }, 'backup download interrupted; resuming');
      }
    }
    if (statSync(path).size !== dto.bytes || (await sha256File(path)) !== dto.sha256) {
      rmSync(path, { force: true });
      throw new AppError('BACKUP_INVALID', 'The downloaded backup does not match the size and checksum the cloud recorded');
    }
    return path;
  }

  private tempPath(what: string): string {
    mkdirSync(this.d.dir, { recursive: true });
    return join(this.d.dir, `.${what}-${newUlid()}.sqlite`);
  }

  private async install(source: string, userId: string): Promise<RestoreResult> {
    const out = this.tempPath('restore');
    try {
      const checked = await this.d.backups.decrypt(source, out);
      const safety = listBusinesses(this.d.db()).length > 0 ? await this.d.backups.run('pre_restore') : null;
      this.adopt(out, checked, userId);
      this.d.log.warn({ from: checked.manifest?.createdAt, device: checked.manifest?.deviceId, safetyBackupId: safety?.id }, 'restoring the database from a backup; restarting');
      this.d.host.install(out);
      return { restarting: true, safetyBackupId: safety?.id ?? null };
    } catch (e) {
      removeSqlite(out);
      throw e;
    }
  }

  // The restored file keeps this device's identity; another device's backup also drops its till and its cloud registration.
  private adopt(path: string, checked: CheckedCopy, userId: string): void {
    const live = this.d.db();
    const copy = openCopy(path, { writable: true, nativeBinding: nativeBindingOf(live) });
    try {
      const m: BackupManifest | null = checked.manifest;
      const sameDevice = !m || m.deviceId === this.d.device.installationId();
      copy.transaction(() => {
        for (const key of IDENTITY) {
          const value = getMeta(live, key);
          if (value === null) deleteMeta(copy, key);
          else setMeta(copy, key, value);
        }
        const registered = getSyncDevice(copy);
        if (registered && registered.cloudDeviceId !== this.d.device.cloudDeviceId()) copy.prepare('DELETE FROM sync_device').run();
        this.carryBackupLog(live, copy);
        this.carryAuditLog(live, copy);
        if (sameDevice) setMeta(copy, META_KEYS.restoreCatchUp, '1');
        else for (const key of [META_KEYS.activeBranchId, META_KEYS.activeTerminalId]) setMeta(copy, key, '');
        appendAudit(copy, {
          businessId: m?.businessId ?? this.d.auditScope, deviceId: this.d.device.installationId(), userId, action: 'backup.restored', entityType: 'backup',
          after: { createdAt: m?.createdAt ?? null, schemaVersion: m?.schemaVersion ?? null, fromDevice: m?.deviceId ?? null },
        });
      })();
      copy.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      copy.close();
    }
  }

  // 8g: this device's audit rows written since the backup stay, so the restore does not fork a chain the cloud already holds.
  private carryAuditLog(live: Db, copy: Db): void {
    const columns = 'id, business_id, seq, user_id, device_id, terminal_id, action, entity_type, entity_id, before_json, after_json, reason, occurred_at, prev_hash, hash';
    const insert = copy.prepare(`INSERT OR IGNORE INTO audit_log (${columns}) VALUES (${columns.split(', ').map((c) => '@' + c).join(', ')})`);
    for (const row of live.prepare(`SELECT ${columns} FROM audit_log WHERE device_id = ? ORDER BY business_id, seq`).iterate(this.d.device.installationId())) insert.run(row);
  }

  // The backups on disk (the safety copy among them) stay listed after the swap; an older schema's log is left as it is.
  private carryBackupLog(live: Db, copy: Db): void {
    if (currentSchemaVersion(copy) !== currentSchemaVersion(live)) return;
    const columns = (live.prepare('SELECT name FROM pragma_table_info(?)').pluck().all('backup_log') as string[]).join(', ');
    const insert = copy.prepare(`INSERT OR IGNORE INTO backup_log (${columns}) VALUES (${columns.split(', ').map((c) => '@' + c).join(', ')})`);
    for (const row of live.prepare('SELECT * FROM backup_log').all()) insert.run(row);
  }
}
