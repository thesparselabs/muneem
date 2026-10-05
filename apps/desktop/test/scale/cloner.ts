import { createHash } from 'node:crypto';
import { addDays, financialYearOf, formatDocNumber, formatInvoiceNumber } from '@muneem/domain';
import { canonicalJson, computeAuditHash, ensurePeriod, findOrCreateSeries, type Actor, type AuditRow, type Db } from '@muneem/db-sqlite';
import type { Prng } from '../soak/generator.js';

type Row = Record<string, unknown>;

interface TableSpec { table: string; where: string; reset?: string[] }

// Insert order follows the foreign keys and the allocation triggers (documents before what settles them).
const BLOCK_TABLES: readonly TableSpec[] = [
  { table: 'sale', where: 'created_at >= @since', reset: ['settled_paise'] },
  { table: 'sale_item', where: 'sale_id IN (SELECT id FROM sale WHERE created_at >= @since)' },
  { table: 'sale_tender', where: 'sale_id IN (SELECT id FROM sale WHERE created_at >= @since)' },
  { table: 'purchase', where: 'created_at >= @since', reset: ['settled_paise'] },
  { table: 'purchase_item', where: 'purchase_id IN (SELECT id FROM purchase WHERE created_at >= @since)' },
  { table: 'purchase_charge', where: 'purchase_id IN (SELECT id FROM purchase WHERE created_at >= @since)' },
  { table: 'payment', where: 'created_at >= @since', reset: ['allocated_paise'] },
  { table: 'cash_movement', where: 'created_at >= @since' },
  { table: 'stock_movement', where: 'created_at >= @since' },
  { table: 'party_ledger_entry', where: 'created_at >= @since' },
  { table: 'allocation', where: 'created_at >= @since' },
  { table: 'journal_entry', where: 'created_at >= @since' },
  { table: 'journal_line', where: 'entry_id IN (SELECT id FROM journal_entry WHERE created_at >= @since)' },
  { table: 'print_job', where: 'created_at >= @since' },
];
// Kept by triggers or rebuilt after cloning, so never copied.
export const DERIVED_TABLES = new Set(['daily_sales_summary', 'daily_payment_summary', 'product_sales_daily', 'account_balance', 'doc_series', 'stock_level', 'accounting_period']);
export const CLONED_TABLES = new Set([...BLOCK_TABLES.map((t) => t.table), 'audit_log', 'sync_outbox']);

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ULID_PREFIXED = /^([0-9A-HJKMNP-TV-Z]{26})(-.+)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const IN_JSON = /"([0-9A-HJKMNP-TV-Z]{26})(-[0-9]{3})?"|"(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?"|"([A-Z0-9]{1,5}\/\d{4}\/\d{5,6})"/g;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DAY_MS = 86_400_000;

const ulidTime = (id: string) => [...id.slice(0, 10)].reduce((t, c) => t * 32 + CROCKFORD.indexOf(c), 0);
const dateOf = (r: Row) => (r.entry_date ?? r.doc_date ?? r.payment_date) as string;

export interface BlockSnapshot { since: string; sinceMs: number; tables: { spec: TableSpec; rows: Row[] }[]; audit: AuditRow[]; outbox: Row[] }

export function snapshotBlock(db: Db, businessId: string, since: string): BlockSnapshot {
  const tables = BLOCK_TABLES.map((spec) => ({ spec, rows: db.prepare(`SELECT * FROM ${spec.table} WHERE ${spec.where} ORDER BY rowid`).all({ since }) as Row[] }));
  const audit = db.prepare('SELECT * FROM audit_log WHERE business_id = ? AND occurred_at >= ? ORDER BY seq').all(businessId, since) as AuditRow[];
  const outbox = db.prepare('SELECT * FROM sync_outbox WHERE business_id = ? AND created_at >= ? ORDER BY seq').all(businessId, since) as Row[];
  return { since, sinceMs: Date.parse(since), tables, audit, outbox };
}

export interface CloneShift { offsetDays: number; productShift: number; customerShift: number; tag: string }
interface Party { id: string; name: string; phone: string }

// Copies a block of real documents to a later date with fresh ids, its own numbers and different products and customers.
export class BlockCloner {
  private readonly inserts = new Map<string, (r: Row) => void>();
  private readonly productNames: Map<string, string>;
  private readonly customerInfo: Map<string, Party>;
  private readonly seriesRows = new Map<string, Row>();
  private readonly nextSeq = new Map<string, number>();

  constructor(
    private readonly db: Db, private readonly businessId: string, private readonly actor: Actor, private readonly block: BlockSnapshot,
    private readonly products: readonly { id: string; name: string }[], private readonly customers: readonly Party[], private readonly rng: Prng,
  ) {
    this.productNames = new Map(products.map((p) => [p.id, p.name]));
    this.customerInfo = new Map(customers.map((c) => [c.id, c]));
  }

  clone(shift: CloneShift): void {
    new CloneRun(this, shift).run();
  }

  insert(table: string, row: Row): void {
    let run = this.inserts.get(table);
    if (!run) {
      const cols = Object.keys(row);
      const s = this.db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`);
      run = (r) => { s.run(r); };
      this.inserts.set(table, run);
    }
    run(row);
  }

  series(oldId: string, fy: string): { id: string; number: (seq: number) => string; take: () => number } {
    let base = this.seriesRows.get(oldId);
    if (!base) {
      base = this.db.prepare('SELECT * FROM doc_series WHERE id = ?').get(oldId) as Row;
      this.seriesRows.set(oldId, base);
    }
    const id = base.fy === fy ? oldId : findOrCreateSeries(this.db, {
      businessId: this.businessId, branchId: base.branch_id as string, terminalId: base.terminal_id as string, docType: base.doc_type as string, fy,
    }, base.prefix as string, this.actor, base.pad_width as number);
    if (!this.nextSeq.has(id)) this.nextSeq.set(id, this.db.prepare('SELECT next_seq FROM doc_series WHERE id = ?').pluck().get(id) as number);
    const invoice = (base.pad_width as number) === 6;
    return {
      id,
      number: (seq) => (invoice ? formatInvoiceNumber : formatDocNumber)(base.prefix as string, fy, seq),
      take: () => { const seq = this.nextSeq.get(id)!; this.nextSeq.set(id, seq + 1); return seq; },
    };
  }

  saveSeries(): void {
    const save = this.db.prepare('UPDATE doc_series SET next_seq = ? WHERE id = ?');
    for (const [id, seq] of this.nextSeq) save.run(seq, id);
  }

  period(date: string): string { return ensurePeriod(this.db, this.businessId, date, this.actor); }
  productName(id: string): string { return this.productNames.get(id) ?? ''; }
  customer(id: string): Party | undefined { return this.customerInfo.get(id); }
  get snapshot(): BlockSnapshot { return this.block; }
  get database(): Db { return this.db; }
  get business(): string { return this.businessId; }
  get productList(): readonly { id: string }[] { return this.products; }
  get customerList(): readonly Party[] { return this.customers; }
  random(): number { return this.rng.next(); }
}

class CloneRun {
  private readonly ids = new Map<string, string>();
  private readonly numbers = new Map<string, string>();
  private readonly offsetMs: number;
  private readonly audits = new Map<string, AuditRow>();

  constructor(private readonly c: BlockCloner, private readonly shift: CloneShift) {
    this.offsetMs = shift.offsetDays * DAY_MS;
    const swap = <T extends { id: string }>(xs: readonly T[], by: number) => xs.forEach((x, i) => this.ids.set(x.id, xs[(i + by) % xs.length]!.id));
    swap(c.productList, shift.productShift);
    swap(c.customerList, shift.customerShift);
  }

  run(): void {
    for (const { spec, rows } of this.c.snapshot.tables) for (const r of rows) this.c.insert(spec.table, this.row(spec, r));
    this.cloneAudit();
    this.cloneOutbox();
    this.c.saveSeries();
  }

  private id(old: string): string {
    const mapped = this.ids.get(old);
    if (mapped) return mapped;
    if (ulidTime(old) < this.c.snapshot.sinceMs) return old;
    const fresh = this.ulid(ulidTime(old) + this.offsetMs);
    this.ids.set(old, fresh);
    return fresh;
  }

  private ulid(ms: number): string {
    let time = '';
    for (let t = ms, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = CROCKFORD[t % 32] + time;
    let rand = '';
    for (let i = 0; i < 16; i++) rand += CROCKFORD[Math.floor(this.c.random() * 32)];
    return time + rand;
  }

  private value(v: unknown): unknown {
    if (typeof v !== 'string') return v;
    if (ULID.test(v)) return this.id(v);
    const derived = ULID_PREFIXED.exec(v);
    if (derived) return this.id(derived[1]!) + derived[2]!;
    if (DATE.test(v)) return addDays(v, this.shift.offsetDays);
    if (STAMP.test(v)) return new Date(Date.parse(v) + this.offsetMs).toISOString();
    if (v.startsWith('{') || v.startsWith('[')) return this.json(v);
    return v;
  }

  private json(text: string): string {
    return text.replace(IN_JSON, (m, id: string | undefined, line: string | undefined, date: string | undefined, time: string | undefined, num: string | undefined) => {
      if (id) return `"${this.id(id)}${line ?? ''}"`;
      if (date) return `"${time ? new Date(Date.parse(date + time) + this.offsetMs).toISOString() : addDays(date, this.shift.offsetDays)}"`;
      if (num) return `"${this.numbers.get(num) ?? num}"`;
      return m;
    });
  }

  private row(spec: TableSpec, r: Row): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) out[k] = this.value(v);
    for (const k of spec.reset ?? []) out[k] = 0;
    if ('fy' in out) out.fy = financialYearOf(dateOf(out));
    if (typeof r.series_id === 'string') {
      const s = this.c.series(r.series_id, out.fy as string);
      const seq = s.take();
      out.series_id = s.id;
      out.doc_seq = seq;
      out.doc_number = s.number(seq);
      this.numbers.set(r.doc_number as string, out.doc_number as string);
    }
    if (spec.table === 'journal_entry') {
      out.entry_no = this.numbers.get(r.entry_no as string) ?? r.entry_no;
      out.period_id = this.c.period(out.entry_date as string);
    }
    if (spec.table === 'sale_item' || spec.table === 'purchase_item') out.product_name = this.c.productName(out.product_id as string);
    if (spec.table === 'sale' && out.customer_id) {
      const who = this.c.customer(out.customer_id as string)!;
      out.customer_snapshot_json = canonicalJson({ ...JSON.parse(r.customer_snapshot_json as string), name: who.name, phone: who.phone });
    }
    if (spec.table === 'purchase') out.supplier_invoice_no = `${r.supplier_invoice_no as string}-${this.shift.tag}`;
    return out;
  }

  // The hash chain carries on from the device's last row, so the copies verify like real entries.
  private cloneAudit(): void {
    const db = this.c.database;
    for (const a of this.c.snapshot.audit) {
      const last = db.prepare('SELECT seq, hash FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq DESC LIMIT 1').get(a.business_id, a.device_id) as { seq: number; hash: string };
      const base: Omit<AuditRow, 'id' | 'hash'> = {
        business_id: a.business_id, seq: last.seq + 1, user_id: a.user_id, device_id: a.device_id, terminal_id: a.terminal_id, action: a.action, entity_type: a.entity_type,
        entity_id: a.entity_id === null ? null : this.value(a.entity_id) as string, before_json: a.before_json === null ? null : this.json(a.before_json),
        after_json: a.after_json === null ? null : this.json(a.after_json), reason: a.reason, occurred_at: this.value(a.occurred_at) as string, prev_hash: last.hash,
      };
      const row: AuditRow = { id: this.id(a.id), ...base, hash: computeAuditHash(base) };
      this.c.insert('audit_log', row as unknown as Row);
      this.audits.set(row.id, row);
    }
  }

  // Copies are already synced; only work done after the dataset is built waits in the queue.
  private cloneOutbox(): void {
    for (const o of this.c.snapshot.outbox) {
      const entityId = this.value(o.entity_id) as string;
      const payload = o.entity_type === 'audit_entry' ? canonicalJson(this.audits.get(entityId)) : this.json(o.payload_json as string);
      this.c.insert('sync_outbox', {
        operation_id: this.id(o.operation_id as string), business_id: o.business_id, device_id: o.device_id, entity_type: o.entity_type, entity_id: entityId,
        operation_type: o.operation_type, payload_json: payload, payload_hash: `sha256:${createHash('sha256').update(payload).digest('hex')}`,
        depends_on_operation_id: o.depends_on_operation_id === null ? null : this.id(o.depends_on_operation_id as string),
        status: 'sent', attempt_count: 1, created_at: this.value(o.created_at), last_attempt_at: this.value(o.created_at),
      });
    }
  }
}
