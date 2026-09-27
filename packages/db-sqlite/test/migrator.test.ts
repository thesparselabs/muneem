import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIGRATIONS, currentSchemaVersion, migrate, openDatabase, quickCheck, foreignKeyCheck } from '../src/index.js';
import { freshDb } from './helpers.js';

describe('migrator', () => {
  it('applies all migrations in order and sets user_version', async () => {
    const db = await freshDb();
    expect(currentSchemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
    expect(quickCheck(db).ok).toBe(true);
    expect(foreignKeyCheck(db).ok).toBe(true);
    const again = await migrate(db);
    expect(again.applied).toEqual([]);
  });
  it('applies LLD §2 pragmas on a file database and writes a pre-migration backup on upgrade', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'muneem-'));
    const path = join(dir, 'muneem.sqlite');
    const db = openDatabase(path);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(2); // FULL
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    // pretend we are at v1 with a fake v2 migration
    await migrate(db);
    const r = await migrate(db, { backupPath: join(dir, 'pre.sqlite'), migrations: [...MIGRATIONS, { version: MIGRATIONS.length + 1, name: 'fake', sql: 'CREATE TABLE fake(x);' }] });
    expect(r.applied).toEqual([MIGRATIONS.length + 1]);
    expect(r.backupPath).toBe(join(dir, 'pre.sqlite'));
    db.close();
  });
  it('rolls back the whole batch when one migration fails', async () => {
    const db = openDatabase(':memory:', { quickCheck: false });
    await expect(migrate(db, { migrations: [{ version: 1, name: 'bad', sql: 'CREATE TABLE a(x); CREATE TABLE a(y);' }] })).rejects.toThrow();
    expect(currentSchemaVersion(db)).toBe(0);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'a'").get()).toBeUndefined();
  });
  it('rejects a migration gap', async () => {
    const db = openDatabase(':memory:', { quickCheck: false });
    await expect(migrate(db, { migrations: [{ version: 2, name: 'gap', sql: 'CREATE TABLE a(x);' }] })).rejects.toThrow(/gap/);
  });
});

describe('append-only enforcement', () => {
  it('audit_log refuses UPDATE and DELETE via triggers', async () => {
    const db = await freshDb();
    db.prepare(`INSERT INTO audit_log (id, business_id, seq, user_id, device_id, action, entity_type, occurred_at, prev_hash, hash)
      VALUES ('a', 'b', 1, 'u', 'd', 'x', 'y', 'now', '0', '1')`).run();
    expect(() => db.prepare("UPDATE audit_log SET action = 'z' WHERE id = 'a'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM audit_log WHERE id = 'a'").run()).toThrow(/append-only/);
  });
});
