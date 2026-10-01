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

describe('0003_pos', () => {
  async function seeded() {
    const db = await freshDb();
    const t = '2026-10-02T00:00:00.000Z';
    const sync = `'${t}', '${t}', 'u', 'd'`;
    db.exec(`
      INSERT INTO organization (id, name, created_at, updated_at) VALUES ('o', 'O', '${t}', '${t}');
      INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_at, updated_at, created_by, device_id)
        VALUES ('b', 'o', 'Shop', 'retail', '07', 'regular', ${sync});
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', 'b', 'DEL1', 'Delhi', '07', ${sync});
      INSERT INTO terminal (id, business_id, branch_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('t', 'b', 'br', 'T01', 'Till', ${sync});
      INSERT INTO uom (id, business_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('pcs', 'b', 'PCS', 'Pieces', ${sync});
      INSERT INTO product (id, business_id, name, name_norm, base_uom_id, created_at, updated_at, created_by, device_id) VALUES ('p', 'b', 'Soap', 'soap', 'pcs', ${sync});
      INSERT INTO doc_series (id, business_id, branch_id, terminal_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id)
        VALUES ('s', 'b', 'br', 't', 'tax_invoice', '2026-27', 'DEL1/T01', ${sync});
      INSERT INTO pos_session (id, business_id, branch_id, terminal_id, session_no, opened_by, opened_at, opening_cash_paise, created_at, updated_at, created_by, device_id)
        VALUES ('ps', 'b', 'br', 't', 1, 'u', '${t}', 0, ${sync});
      INSERT INTO sale (id, business_id, branch_id, terminal_id, session_id, command_id, doc_type, series_id, doc_number, doc_seq, doc_date, fy,
          customer_snapshot_json, place_of_supply_state, supply_type, gstr1_bucket, tax_scheme, gross_paise, taxable_paise, cgst_paise, sgst_paise,
          total_paise, paid_paise, created_at, updated_at, created_by, device_id)
        VALUES ('sale1', 'b', 'br', 't', 'ps', 'c1', 'tax_invoice', 's', 'DEL1/T01/2026-27/000001', 1, '2026-10-02', '2026-27',
          '{}', '07', 'intra', 'b2cs', 'regular', 1000, 1000, 90, 90, 1180, 1180, ${sync});
      INSERT INTO sale_item (id, sale_id, business_id, line_no, product_id, product_name, uom_id, uom_code, qty_milli, base_qty_milli,
          unit_price_paise, price_is_inclusive, gross_paise, taxable_paise, tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, total_paise)
        VALUES ('si1', 'sale1', 'b', 1, 'p', 'Soap', 'pcs', 'PCS', 1000, 1000, 1000, 0, 1000, 1000, 'taxable', 1800, 90, 90, 1180);
      INSERT INTO sale_tender (id, sale_id, business_id, line_no, method, amount_paise) VALUES ('st1', 'sale1', 'b', 1, 'cash', 1180);
    `);
    return db;
  }

  it('keeps sales, lines and tenders append-only while allowing sync bookkeeping', async () => {
    const db = await seeded();
    expect(() => db.prepare("UPDATE sale SET total_paise = 1 WHERE id = 'sale1'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM sale WHERE id = 'sale1'").run()).toThrow(/append-only/);
    expect(() => db.prepare("UPDATE sale_item SET qty_milli = 2000").run()).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM sale_tender').run()).toThrow(/append-only/);
    expect(db.prepare("UPDATE sale SET sync_state = 'synced' WHERE id = 'sale1'").run().changes).toBe(1);
  });

  it('refuses a sale whose payments do not balance or whose tax split is wrong', async () => {
    const db = await seeded();
    const insert = (over: string) => () => db.exec(`INSERT INTO sale (id, business_id, branch_id, terminal_id, session_id, command_id, doc_type, series_id,
        doc_number, doc_seq, doc_date, fy, customer_snapshot_json, place_of_supply_state, supply_type, gstr1_bucket, tax_scheme,
        gross_paise, taxable_paise, igst_paise, total_paise, paid_paise, created_at, updated_at, created_by, device_id)
      VALUES ('x', 'b', 'br', 't', 'ps', 'c2', 'tax_invoice', 's', 'n', 2, '2026-10-02', '2026-27', '{}', '07', ${over}, 'b2cs', 'regular',
        1000, 1000, 180, 1180, 1180, 'a', 'a', 'u', 'd')`);
    expect(insert("'intra'")).toThrow(/CHECK/);
    expect(insert("'inter'")).not.toThrow();
    expect(() => db.prepare("INSERT INTO sale_tender (id, sale_id, business_id, line_no, method, amount_paise, change_paise) VALUES ('st2', 'sale1', 'b', 2, 'upi', 100, 10)").run()).toThrow(/CHECK/);
  });

  it('allows one open register per terminal and one business-wide series per key', async () => {
    const db = await seeded();
    expect(() => db.exec(`INSERT INTO pos_session (id, business_id, branch_id, terminal_id, session_no, opened_by, opened_at, opening_cash_paise, created_at, updated_at, created_by, device_id)
      VALUES ('ps2', 'b', 'br', 't', 2, 'u', 'a', 0, 'a', 'a', 'u', 'd')`)).toThrow(/UNIQUE/);
    const series = `INSERT INTO doc_series (id, business_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES (?, 'b', 'receipt', '2026-27', 'R', 'a', 'a', 'u', 'd')`;
    db.prepare(series).run('r1');
    expect(() => db.prepare(series).run('r2')).toThrow(/UNIQUE/);
  });
});
