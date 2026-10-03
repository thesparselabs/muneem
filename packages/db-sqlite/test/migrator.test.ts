import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { MIGRATIONS, backupDatabase, currentSchemaVersion, migrate, nativeBindingOf, openDatabase, quickCheck, foreignKeyCheck, stmt } from '../src/index.js';
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

describe('0004_invoice_prefix', () => {
  it('gives existing terminals a short prefix and moves their series onto it', async () => {
    const db = openDatabase(':memory:', { quickCheck: false });
    await migrate(db, { migrations: MIGRATIONS.slice(0, 3) });
    const t = "'2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z', 'u', 'd'";
    db.exec(`
      INSERT INTO organization (id, name, created_at, updated_at) VALUES ('o', 'O', 'a', 'a');
      INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('b', 'o', 'S', 'retail', '07', 'regular', ${t});
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', 'b', 'DEL1', 'D', '07', ${t});
      INSERT INTO terminal (id, business_id, branch_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('t1', 'b', 'br', 'T01', 'A', ${t});
      INSERT INTO terminal (id, business_id, branch_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('t2', 'b', 'br', 'T02', 'B', ${t});
      INSERT INTO doc_series (id, business_id, branch_id, terminal_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('s', 'b', 'br', 't2', 'tax_invoice', '2026-27', 'DEL1/T02', ${t});
    `);
    await migrate(db);
    expect(db.prepare('SELECT id, invoice_prefix FROM terminal ORDER BY id').all()).toEqual([{ id: 't1', invoice_prefix: 'T1' }, { id: 't2', invoice_prefix: 'T2' }]);
    expect(db.prepare("SELECT prefix FROM doc_series WHERE id = 's'").pluck().get()).toBe('T2');
  });
});

describe('native SQLite build', () => {
  it('verifies a backup with the same SQLite build the database was opened with', async () => {
    const { createRequire } = await import('node:module');
    const binding = join(dirname(createRequire(import.meta.url).resolve('better-sqlite3/package.json')), 'build', 'Release', 'better_sqlite3.node');
    const dir = mkdtempSync(join(tmpdir(), 'muneem-native-'));
    const db = openDatabase(join(dir, 'a.sqlite'), { nativeBinding: binding });
    expect(nativeBindingOf(db)).toBe(binding);
    await migrate(db);
    expect(await backupDatabase(db, join(dir, 'b.sqlite'))).toMatchObject({ verified: true });
    db.close();
  });
});

describe('0005_inventory', () => {
  async function stocked() {
    const db = await freshDb();
    const t = "'2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z', 'u', 'd'";
    db.exec(`
      INSERT INTO organization (id, name, created_at, updated_at) VALUES ('o', 'O', 'a', 'a');
      INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('b', 'o', 'S', 'retail', '07', 'regular', ${t});
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', 'b', 'DEL1', 'D', '07', ${t});
      INSERT INTO warehouse (id, business_id, branch_id, code, name, is_default, created_at, updated_at, created_by, device_id) VALUES ('w', 'b', 'br', 'MAIN', 'Main', 1, ${t});
      INSERT INTO uom (id, business_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('pcs', 'b', 'PCS', 'Pieces', ${t});
      INSERT INTO product (id, business_id, name, name_norm, base_uom_id, created_at, updated_at, created_by, device_id) VALUES ('p', 'b', 'Soap', 'soap', 'pcs', ${t});
    `);
    const move = db.prepare(`INSERT INTO stock_movement (id, business_id, warehouse_id, product_id, movement_type, signed_qty_milli, value_paise,
        ref_type, ref_id, ref_line_id, occurred_at, created_at, updated_at, created_by, device_id)
      VALUES (?, 'b', 'w', 'p', ?, ?, ?, ?, ?, ?, 'a', 'a', 'a', 'u', 'd')`);
    return { db, move };
  }

  it('keeps movements append-only and idempotent per reference', async () => {
    const { db, move } = await stocked();
    move.run('m1', 'opening', 1000, 500, 'opening', 'doc1', null);
    expect(() => move.run('m2', 'opening', 1000, 500, 'opening', 'doc1', null)).toThrow(/UNIQUE/);
    expect(() => db.prepare("UPDATE stock_movement SET value_paise = 1 WHERE id = 'm1'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM stock_movement WHERE id = 'm1'").run()).toThrow(/append-only/);
    expect(db.prepare("UPDATE stock_movement SET sync_state = 'synced' WHERE id = 'm1'").run().changes).toBe(1);
  });

  it('allows a zero quantity only for a value-only cost correction', async () => {
    const { move } = await stocked();
    expect(() => move.run('m1', 'sale', 0, 0, 'sale', 's1', 'l1')).toThrow(/CHECK/);
    expect(() => move.run('m2', 'cost_correction', 0, 0, 'correction', 'c1', null)).toThrow(/CHECK/);
    expect(() => move.run('m3', 'cost_correction', 0, -600, 'correction', 'c1', null)).not.toThrow();
    expect(() => move.run('m4', 'cost_correction', 1000, -600, 'correction', 'c2', null)).toThrow(/CHECK/);
  });

  it('refuses a cached level that has value without quantity', async () => {
    const { db } = await stocked();
    expect(() => db.prepare("INSERT INTO stock_level (business_id, warehouse_id, product_id, qty_milli, value_paise) VALUES ('b', 'w', 'p', 0, 5)").run()).toThrow(/CHECK/);
  });
});

describe('0006_parties', () => {
  const t = "'2026-10-03T00:00:00.000Z', '2026-10-03T00:00:00.000Z', 'u', 'd'";
  async function parties() {
    const db = await freshDb();
    db.exec(`
      INSERT INTO organization (id, name, created_at, updated_at) VALUES ('o', 'O', 'a', 'a');
      INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('b', 'o', 'S', 'retail', '07', 'regular', ${t});
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', 'b', 'DEL1', 'D', '07', ${t});
      INSERT INTO warehouse (id, business_id, branch_id, code, name, is_default, created_at, updated_at, created_by, device_id) VALUES ('w', 'b', 'br', 'MAIN', 'Main', 1, ${t});
      INSERT INTO uom (id, business_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('pcs', 'b', 'PCS', 'Pieces', ${t});
      INSERT INTO product (id, business_id, name, name_norm, base_uom_id, created_at, updated_at, created_by, device_id) VALUES ('p', 'b', 'Soap', 'soap', 'pcs', ${t});
      INSERT INTO supplier (id, business_id, name, name_norm, gstin, state_code, created_at, updated_at, created_by, device_id) VALUES ('s1', 'b', 'Acme', 'acme', '07AAAAA0000A1Z5', '07', ${t});
      INSERT INTO supplier (id, business_id, name, name_norm, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('s2', 'b', 'Local', 'local', '07', 'unregistered', ${t});
      INSERT INTO customer (id, business_id, name, name_norm, created_at, updated_at, created_by, device_id) VALUES ('c1', 'b', 'Ravi', 'ravi', ${t});
      INSERT INTO doc_series (id, business_id, branch_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('ps', 'b', 'br', 'purchase', '2026-27', 'PU', ${t});
      INSERT INTO doc_series (id, business_id, branch_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('pay', 'b', 'br', 'payment', '2026-27', 'PY', ${t});
      INSERT INTO doc_series (id, business_id, branch_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('dn', 'b', 'br', 'debit_note', '2026-27', 'DN', ${t});
    `);
    const purchase = (id: string, seq: number, over: Partial<Record<string, string | number>> = {}) => {
      const row: Record<string, string | number> = {
        id, supplier_id: 's1', supplier_invoice_no: `INV-${seq}`, doc_seq: seq, supply_type: 'intra', supplier_tax_scheme: 'regular',
        taxable_paise: 10_000, cgst_paise: 900, sgst_paise: 900, igst_paise: 0, charges_paise: 500, round_off_paise: -0, total_paise: 12_300, itc_paise: 1800, ...over,
      };
      db.prepare(`INSERT INTO purchase (id, business_id, branch_id, warehouse_id, supplier_id, supplier_snapshot_json, supplier_invoice_no, supplier_invoice_date,
          series_id, doc_number, doc_seq, doc_date, fy, place_of_supply_state, supply_type, supplier_tax_scheme, gross_paise, taxable_paise,
          cgst_paise, sgst_paise, igst_paise, charges_paise, round_off_paise, total_paise, itc_paise, due_date, created_at, updated_at, created_by, device_id)
        VALUES (@id, 'b', 'br', 'w', @supplier_id, '{}', @supplier_invoice_no, '2026-10-01', 'ps', @id, @doc_seq, '2026-10-03', '2026-27', '07', @supply_type,
          @supplier_tax_scheme, @taxable_paise, @taxable_paise, @cgst_paise, @sgst_paise, @igst_paise, @charges_paise, @round_off_paise, @total_paise, @itc_paise,
          '2026-11-02', ${t})`).run(row);
    };
    const item = (id: string, purchaseId: string, baseQty: number, over = '') => db.exec(`INSERT INTO purchase_item (id, purchase_id, business_id, line_no,
        product_id, product_name, uom_id, uom_code, qty_milli, base_qty_milli, unit_price_paise, price_is_inclusive, gross_paise, taxable_paise,
        tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, total_paise, itc_eligible, charges_paise, landed_value_paise, unit_cost_paise)
      VALUES ('${id}', '${purchaseId}', 'b', 1, 'p', 'Soap', 'pcs', 'PCS', ${baseQty}, ${baseQty}, 1000, 0, 10000, 10000, 'taxable', 1800, 900, 900, 11800,
        ${over || '1, 500, 10500'}, 1050)`);
    const payment = (id: string, seq: number, amount: number, party = "'supplier', 's1'", direction = 'out') => db.exec(`INSERT INTO payment (id, business_id,
        branch_id, direction, party_type, party_id, series_id, doc_number, doc_seq, payment_date, fy, method, amount_paise, created_at, updated_at, created_by, device_id)
      VALUES ('${id}', 'b', 'br', '${direction}', ${party}, 'pay', '${id}', ${seq}, '2026-10-03', '2026-27', 'cash', ${amount}, ${t})`);
    const allocate = (id: string, source: string, target: string, amount: number, party = "'supplier', 's1'") => db.exec(`INSERT INTO allocation (id,
        business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at, created_at, updated_at, created_by, device_id)
      VALUES ('${id}', 'b', ${party}, ${source}, ${target}, ${amount}, 'a', ${t})`);
    const col = (table: string, column: string, id: string) => db.prepare(`SELECT ${column} FROM ${table} WHERE id = ?`).pluck().get(id);
    return { db, purchase, item, payment, allocate, col };
  }

  it('makes a wrong purchase total, tax split or landed value impossible to store', async () => {
    const { purchase, item } = await parties();
    expect(() => purchase('p1', 1, { total_paise: 12_299 })).toThrow(/CHECK/);
    expect(() => purchase('p1', 1, { supply_type: 'inter' })).toThrow(/CHECK/);
    expect(() => purchase('p1', 1, { itc_paise: 1801 })).toThrow(/CHECK/);
    expect(() => purchase('p1', 1, { round_off_paise: 101, total_paise: 12_401 })).toThrow(/CHECK/);
    expect(() => purchase('p1', 1, { supplier_id: 's2', supplier_tax_scheme: 'unregistered' })).toThrow(/CHECK/);
    purchase('p1', 1);
    expect(() => item('i1', 'p1', 10_000, '0, 500, 10500')).toThrow(/CHECK/);
    expect(() => item('i1', 'p1', 10_000, '0, 500, 12300')).not.toThrow();
  });

  it('refuses the same supplier invoice twice in a year, in any case, until the first is cancelled', async () => {
    const { db, purchase } = await parties();
    purchase('p1', 1, { supplier_invoice_no: 'inv-9' });
    expect(() => purchase('p2', 2, { supplier_invoice_no: 'INV-9' })).toThrow(/UNIQUE/);
    db.exec("UPDATE purchase SET status = 'cancelled' WHERE id = 'p1'");
    expect(() => purchase('p2', 2, { supplier_invoice_no: 'INV-9' })).not.toThrow();
  });

  it('keeps purchase amounts frozen while status and settlement can move', async () => {
    const { db, purchase } = await parties();
    purchase('p1', 1);
    expect(() => db.exec("UPDATE purchase SET total_paise = 1 WHERE id = 'p1'")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM purchase WHERE id = 'p1'")).toThrow(/append-only/);
    expect(db.prepare("UPDATE purchase SET sync_state = 'synced' WHERE id = 'p1'").run().changes).toBe(1);
  });

  it('never returns more than was bought on a line', async () => {
    const { db, purchase, item } = await parties();
    purchase('p1', 1);
    item('i1', 'p1', 10_000);
    const note = (id: string, seq: number) => db.exec(`INSERT INTO debit_note (id, business_id, branch_id, warehouse_id, purchase_id, supplier_id, series_id,
        doc_number, doc_seq, doc_date, fy, reason, supply_type, taxable_paise, cgst_paise, sgst_paise, total_paise, created_at, updated_at, created_by, device_id)
      VALUES ('${id}', 'b', 'br', 'w', 'p1', 's1', 'dn', '${id}', ${seq}, '2026-10-03', '2026-27', 'damaged', 'intra', 6000, 540, 540, 7080, ${t})`);
    const line = (id: string, noteId: string, qty: number) => () => db.exec(`INSERT INTO debit_note_item (id, debit_note_id, business_id, line_no,
        purchase_item_id, product_id, qty_milli, base_qty_milli, taxable_paise, cgst_paise, sgst_paise, total_paise, landed_value_paise)
      VALUES ('${id}', '${noteId}', 'b', 1, 'i1', 'p', ${qty}, ${qty}, 6000, 540, 540, 7080, 6300)`);
    note('d1', 1);
    line('l1', 'd1', 6000)();
    note('d2', 2);
    expect(line('l2', 'd2', 4001)).toThrow(/RETURN_QTY_EXCEEDED/);
    expect(line('l2', 'd2', 4000)).not.toThrow();
  });

  it('keeps allocation totals on both documents and refuses over-allocation on either side', async () => {
    const { db, purchase, payment, allocate, col } = await parties();
    purchase('p1', 1);
    payment('pay1', 1, 20_000);
    allocate('a1', "'payment', 'pay1'", "'purchase', 'p1'", 12_000);
    expect([col('payment', 'allocated_paise', 'pay1'), col('purchase', 'settled_paise', 'p1')]).toEqual([12_000, 12_000]);
    expect(() => allocate('a2', "'payment', 'pay1'", "'purchase', 'p1'", 301)).toThrow(/CHECK/);
    payment('pay2', 2, 100);
    expect(() => allocate('a3', "'payment', 'pay2'", "'purchase', 'p1'", 300)).toThrow(/CHECK/);
    db.exec("UPDATE allocation SET voided_at = 'now' WHERE id = 'a1'");
    expect([col('payment', 'allocated_paise', 'pay1'), col('purchase', 'settled_paise', 'p1')]).toEqual([0, 0]);
    expect(() => db.exec("UPDATE allocation SET voided_at = 'again' WHERE id = 'a1'")).toThrow(/append-only/);
    expect(() => db.exec("UPDATE allocation SET amount_paise = 1 WHERE id = 'a1'")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM allocation WHERE id = 'a1'")).toThrow(/append-only/);
  });

  it('allocates only between live documents of the same party', async () => {
    const { db, purchase, payment, allocate } = await parties();
    purchase('p1', 1);
    payment('pay1', 1, 5000);
    payment('rc1', 2, 5000, "'customer', 'c1'", 'in');
    expect(() => allocate('a1', "'payment', 'rc1'", "'purchase', 'p1'", 100)).toThrow(/belong to its party/);
    expect(() => allocate('a1', "'payment', 'rc1'", "'purchase', 'p1'", 100, "'customer', 'c1'")).toThrow(/belong to its party/);
    expect(() => allocate('a1', "'payment', 'nope'", "'purchase', 'p1'", 100)).toThrow(/belong to its party/);
    db.exec("UPDATE purchase SET status = 'cancelled' WHERE id = 'p1'");
    expect(() => allocate('a1', "'payment', 'pay1'", "'purchase', 'p1'", 100)).toThrow(/belong to its party/);
  });

  it('lets an opening balance settle or be settled only on its own side', async () => {
    const { db, purchase, allocate, col } = await parties();
    const opening = (id: string, side: string) => db.exec(`INSERT INTO party_opening (id, business_id, party_type, party_id, side, amount_paise, as_of_date,
        created_at, updated_at, created_by, device_id) VALUES ('${id}', 'b', 'supplier', 's1', '${side}', 1000, '2026-04-01', ${t})`);
    opening('o1', 'receivable');
    purchase('p1', 1);
    allocate('a1', "'opening', 'o1'", "'purchase', 'p1'", 1000);
    expect(col('party_opening', 'allocated_paise', 'o1')).toBe(1000);
    db.exec("UPDATE party_opening SET status = 'cancelled', allocated_paise = 0 WHERE id = 'o1'");
    opening('o2', 'payable');
    expect(() => allocate('a2', "'opening', 'o2'", "'purchase', 'p1'", 100)).toThrow(/belong to its party/);
  });

  it('a payment runs in its party\'s direction', async () => {
    const { payment } = await parties();
    expect(() => payment('x', 1, 100, "'customer', 'c1'", 'out')).toThrow(/CHECK/);
    expect(() => payment('x', 1, 100, "'supplier', 's1'", 'in')).toThrow(/CHECK/);
  });

  it('keeps the party ledger append-only and one entry per document and kind', async () => {
    const { db } = await parties();
    const entry = db.prepare(`INSERT INTO party_ledger_entry (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date,
        occurred_at, created_at, updated_at, created_by, device_id) VALUES (?, 'b', 'supplier', 's1', 'purchase', 'p1', ?, ?, '2026-10-03', 'a', 'a', 'a', 'u', 'd')`);
    entry.run('e1', 'post', -12_300);
    expect(() => entry.run('e2', 'post', -12_300)).toThrow(/UNIQUE/);
    expect(() => entry.run('e3', 'cancel', 0)).toThrow(/CHECK/);
    entry.run('e4', 'cancel', 12_300);
    expect(() => db.exec("UPDATE party_ledger_entry SET amount_paise = 1 WHERE id = 'e1'")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM party_ledger_entry WHERE id = 'e1'")).toThrow(/append-only/);
  });

  it('a supplier is registered with a GSTIN from its own state, or unregistered without one', async () => {
    const { db } = await parties();
    const supplier = (gstin: string | null, scheme: string) => () => db.prepare(`INSERT INTO supplier (id, business_id, name, name_norm, gstin, state_code,
        tax_scheme, created_at, updated_at, created_by, device_id) VALUES (?, 'b', 'X', 'x', ?, '07', ?, 'a', 'a', 'u', 'd')`).run(`s-${scheme}-${gstin}`, gstin, scheme);
    expect(supplier(null, 'regular')).toThrow(/CHECK/);
    expect(supplier('27AAAAA0000A1Z5', 'regular')).toThrow(/CHECK/);
    expect(supplier('07BBBBB0000B1Z5', 'unregistered')).toThrow(/CHECK/);
    expect(supplier('07BBBBB0000B1Z5', 'composition')).not.toThrow();
  });

  it('settles no more of a sale than was sold on credit', async () => {
    const { db } = await parties();
    db.exec(`
      INSERT INTO terminal (id, business_id, branch_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('tm', 'b', 'br', 'T01', 'A', ${t});
      INSERT INTO doc_series (id, business_id, branch_id, terminal_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('ss', 'b', 'br', 'tm', 'tax_invoice', '2026-27', 'T1', ${t});
      INSERT INTO pos_session (id, business_id, branch_id, terminal_id, session_no, opened_by, opened_at, opening_cash_paise, created_at, updated_at, created_by, device_id)
        VALUES ('se', 'b', 'br', 'tm', 1, 'u', 'a', 0, ${t});
      INSERT INTO sale (id, business_id, branch_id, terminal_id, session_id, command_id, doc_type, series_id, doc_number, doc_seq, doc_date, fy, customer_id,
          customer_snapshot_json, place_of_supply_state, supply_type, gstr1_bucket, tax_scheme, gross_paise, taxable_paise, total_paise, paid_paise, credit_paise,
          created_at, updated_at, created_by, device_id)
        VALUES ('sa', 'b', 'br', 'tm', 'se', 'c', 'tax_invoice', 'ss', 'T1/1', 1, '2026-10-03', '2026-27', 'c1', '{}', '07', 'intra', 'b2cs', 'regular',
          1000, 1000, 1000, 400, 600, ${t});
    `);
    expect(() => db.exec("UPDATE sale SET settled_paise = 601 WHERE id = 'sa'")).toThrow(/over-allocated/);
    expect(db.prepare("UPDATE sale SET settled_paise = 600 WHERE id = 'sa'").run().changes).toBe(1);
  });
});

describe('0007_purchase_commands', () => {
  it('lets a command id be used once per business and never changed', async () => {
    const db = await freshDb();
    const t = "'a', 'a', 'u', 'd'";
    db.exec(`
      INSERT INTO organization (id, name, created_at, updated_at) VALUES ('o', 'O', 'a', 'a');
      INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('b', 'o', 'S', 'retail', '07', 'regular', ${t});
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', 'b', 'DEL1', 'D', '07', ${t});
      INSERT INTO warehouse (id, business_id, branch_id, code, name, created_at, updated_at, created_by, device_id) VALUES ('w', 'b', 'br', 'MAIN', 'Main', ${t});
      INSERT INTO supplier (id, business_id, name, name_norm, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('s', 'b', 'S', 's', '07', 'unregistered', ${t});
      INSERT INTO doc_series (id, business_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('ps', 'b', 'purchase', '2026-27', 'T1P', ${t});
    `);
    const insert = (id: string, seq: number, command: string) => () => db.exec(`INSERT INTO purchase (id, business_id, branch_id, warehouse_id, supplier_id,
        supplier_snapshot_json, supplier_invoice_no, supplier_invoice_date, series_id, doc_number, doc_seq, doc_date, fy, place_of_supply_state, supply_type,
        supplier_tax_scheme, gross_paise, taxable_paise, total_paise, due_date, command_id, created_at, updated_at, created_by, device_id)
      VALUES ('${id}', 'b', 'br', 'w', 's', '{}', '${id}', '2026-10-01', 'ps', '${id}', ${seq}, '2026-10-03', '2026-27', '07', 'intra', 'unregistered',
        100, 100, 100, '2026-10-03', '${command}', ${t})`);
    insert('p1', 1, 'c1')();
    expect(insert('p2', 2, 'c1')).toThrow(/UNIQUE/);
    expect(() => db.exec("UPDATE purchase SET command_id = 'c9' WHERE id = 'p1'")).toThrow(/append-only/);
  });
});

describe('0008_payment_commands', () => {
  it('lets a payment command id be used once per business and never changed', async () => {
    const db = await freshDb();
    const t = "'a', 'a', 'u', 'd'";
    db.exec(`
      INSERT INTO organization (id, name, created_at, updated_at) VALUES ('o', 'O', 'a', 'a');
      INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_at, updated_at, created_by, device_id) VALUES ('b', 'o', 'S', 'retail', '07', 'regular', ${t});
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', 'b', 'DEL1', 'D', '07', ${t});
      INSERT INTO doc_series (id, business_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('rs', 'b', 'receipt', '2026-27', 'T1R', ${t});
    `);
    const insert = (id: string, seq: number) => () => db.exec(`INSERT INTO payment (id, business_id, branch_id, direction, party_type, party_id, series_id,
        doc_number, doc_seq, payment_date, fy, method, amount_paise, command_id, created_at, updated_at, created_by, device_id)
      VALUES ('${id}', 'b', 'br', 'in', 'customer', 'c', 'rs', '${id}', ${seq}, '2026-10-03', '2026-27', 'cash', 100, 'cmd', ${t})`);
    insert('p1', 1)();
    expect(insert('p2', 2)).toThrow(/UNIQUE/);
    expect(() => db.exec("UPDATE payment SET command_id = 'x' WHERE id = 'p1'")).toThrow(/append-only/);
  });
});
