import { readdirSync } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { LocalBackup } from '@muneem/contracts';
import { quickCheck } from '@muneem/db-sqlite';
import { caller, testApp } from '../helpers.js';
import { goldenDay } from '../sync/goldenDay.js';
import { checkDocuments } from './checkDocuments.js';

const disk = vi.hoisted(() => ({ full: false, allowBytes: 64 * 1024 }));

// The sealed backup's writes run out of space part-way, as on a full disk; everything else writes normally.
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  const open = async (...args: Parameters<typeof real.open>): Promise<FileHandle> => {
    const handle = await real.open(...args);
    if (!disk.full || !String(args[0]).endsWith('.mbk') || args[1] !== 'w') return handle;
    let written = 0;
    return new Proxy(handle, {
      get(target, prop, receiver) {
        if (prop !== 'write') return Reflect.get(target, prop, receiver) as unknown;
        return async (buffer: Buffer) => {
          written += buffer.length;
          if (written > disk.allowBytes) throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC', errno: -28 });
          return target.write(buffer);
        };
      },
    });
  };
  return { ...real, open, default: { ...real, open } };
});

describe('disk full during a backup (9g)', () => {
  it('fails the backup, records it in health, leaves no partial file, and corrupts nothing; the next backup succeeds', async () => {
    const { app, db, dir } = await testApp({ file: true });
    await goldenDay(app, db);
    const api = caller(app);
    const { backup: first } = await api.data<{ backup: LocalBackup }>('backups.runNow');
    const sales = db.prepare('SELECT COUNT(*) FROM sale').pluck().get();
    const files = readdirSync(join(dir, 'backups'));

    disk.full = true;
    await expect(app.backups.backups.run('manual')).rejects.toThrow(/Backup failed: ENOSPC: no space left on device/);
    expect(app.backups.backups.health()).toMatchObject({ status: 'failing', lastError: expect.stringContaining('no space left on device'), lastSuccessAt: first.createdAt });
    expect(readdirSync(join(dir, 'backups'))).toEqual(files);
    expect(await api.data('backups.verify', { source: 'local', id: first.id })).toMatchObject({ ok: true });
    expect(quickCheck(db).ok).toBe(true);
    expect(db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(sales);
    expect(checkDocuments(join(dir, 'muneem.sqlite')).failures).toEqual([]);

    disk.full = false;
    await app.backups.scheduler.now();
    const health = app.backups.backups.health();
    expect(health.status).toBe('ok');
    expect(health.lastSuccessAt! >= health.lastErrorAt!).toBe(true);
    expect(app.backups.backups.list()[0]).toMatchObject({ verified: true, createdAt: health.lastSuccessAt });
  });
});
