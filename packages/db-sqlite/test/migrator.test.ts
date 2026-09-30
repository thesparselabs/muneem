import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIGRATIONS, currentSchemaVersion, migrate, openDatabase, quickCheck, foreignKeyCheck, stmt } from '../src/index.js';
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

describe('0002_catalog', () => {
  it('creates the catalog tables and a working FTS5 index', async () => {
    const db = await freshDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of ['uom', 'category', 'brand', 'product', 'product_variant', 'barcode', 'uom_conversion', 'price_list', 'price_list_item', 'product_fts']) {
      expect(tables).toContain(t);
    }
    db.prepare("INSERT INTO product_fts (product_id, business_id, name, sku, hsn_code, brand_name) VALUES ('p', 'b', 'Crème Brûlée Mix', 'SKU-1', '2106', 'Amul')").run();
    expect(db.prepare("SELECT product_id FROM product_fts WHERE product_fts MATCH 'creme'").get()).toEqual({ product_id: 'p' });
  });
  it('upgrades a v1 database in place', async () => {
    const db = openDatabase(':memory:', { quickCheck: false });
    await migrate(db, { migrations: MIGRATIONS.slice(0, 1) });
    const r = await migrate(db);
    expect(r.applied).toEqual(MIGRATIONS.slice(1).map((m) => m.version));
    expect(foreignKeyCheck(db).ok).toBe(true);
  });
});

describe('stmt', () => {
  it('returns the same compiled statement for the same SQL on the same connection', async () => {
    const a = await freshDb();
    const b = await freshDb();
    expect(stmt(a, 'SELECT 1')).toBe(stmt(a, 'SELECT 1'));
    expect(stmt(a, 'SELECT 1')).not.toBe(stmt(b, 'SELECT 1'));
  });
});
