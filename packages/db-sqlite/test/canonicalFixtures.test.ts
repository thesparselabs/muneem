import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalJson, computeAuditHash, GENESIS_HASH, type AuditRow } from '../src/index.js';

// Shared with the Go port (cloud/internal/devicesync/auditchain); regenerate with MUNEEM_GEN_CANONICAL_FIXTURES=1.
const DIR = new URL('../../contracts/fixtures/canonical/', import.meta.url);
const GENERATE = process.env.MUNEEM_GEN_CANONICAL_FIXTURES === '1';

const CASES: Record<string, string> = {
  'sorted-keys': '{"b":1,"a":2,"c":{"z":null,"y":true,"x":false}}',
  'nested-arrays-keep-order': '{"z":[3,{"y":null,"x":[2,1]}],"a":{"c":"d","b":[]}}',
  'array-index-keys-first': '{"10":"a","9":"b","a":1,"01":2,"-1":3,"4294967295":4,"4294967294":5,"0":6,"1.5":7}',
  'numbers-in-js-form': '[1.0,1e3,-0,0.1,1e21,1e-7,123456789012345680000,1.5e-6,2.5e+25,-3.75,100,0.000001,1e-6,5e-324,1.7976931348623157e308]',
  'paise-and-quantities': '{"totalPaise":11800,"qtyMilli":-2500,"gstRateBp":1800,"roundOffPaise":-0}',
  'string-escapes': '{"s":"quote\\" back\\\\ slash/ nl\\n tab\\t cr\\r bs\\b ff\\f ctl\\u0001 \\u001f del\\u007f html<>& ls\\u2028 ps\\u2029 rupee₹ é emoji😀"}',
  'utf16-key-order': '{"é":1,"z":2,"😀":3,"\\uffff":4,"A":5,"":6}',
  'scalars': '[{},[],"",0,null,true,false]',
  'top-level-string': '"plain"',
};

const row = (seq: number, prev: string, fields: Partial<AuditRow>): AuditRow => {
  const base = {
    business_id: '01J0000000000000000000BIZ1', seq, user_id: '01J0000000000000000000USR1', device_id: '01J0000000000000000000DEV1', terminal_id: null,
    action: 'product.update', entity_type: 'product', entity_id: '01J0000000000000000000PRD1', before_json: null, after_json: null, reason: null,
    occurred_at: `2026-10-04T10:00:0${seq}.000Z`, prev_hash: prev, ...fields,
  };
  return { id: `01J00000000000000000AUDIT${seq}`, ...base, hash: computeAuditHash(base) };
};

function auditChain(): AuditRow[] {
  const rows: AuditRow[] = [];
  const add = (fields: Partial<AuditRow>) => rows.push(row(rows.length + 1, rows.at(-1)?.hash ?? GENESIS_HASH, fields));
  add({ action: 'business.create', entity_type: 'business', entity_id: '01J0000000000000000000BIZ1', after_json: canonicalJson({ name: 'Sharma Store', stateCode: '07', version: 1 }) });
  add({ before_json: canonicalJson({ name: 'Soap', sellingPricePaise: 11_800 }), after_json: canonicalJson({ name: 'Soap "Bar" <large>', sellingPricePaise: 12_500 }), terminal_id: '01J0000000000000000000TRM1' });
  add({ action: 'ipc.sales.complete', entity_type: 'sales', entity_id: null, after_json: canonicalJson({ lines: [{ qtyMilli: 1500, rate: 0.5 }], 10: 'x', 9: 'y', note: 'é😀 ' }) });
  add({ action: 'period.unlock', entity_type: 'accounting_period', reason: 'late bill', after_json: canonicalJson({ status: 'open', unlockReason: 'late bill' }) });
  return rows;
}

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, DIR), 'utf8')) as unknown;

describe('canonical JSON and audit hash fixtures (8g, shared with Go)', () => {
  if (GENERATE) {
    it('writes the fixtures', () => {
      mkdirSync(DIR, { recursive: true });
      const cases = Object.entries(CASES).map(([name, json]) => ({ name, json, canonical: canonicalJson(JSON.parse(json)) }));
      writeFileSync(new URL('canonical-json.json', DIR), `${JSON.stringify({ cases }, null, 1)}\n`);
      writeFileSync(new URL('audit-chain.json', DIR), `${JSON.stringify({ genesis: GENESIS_HASH, rows: auditChain() }, null, 1)}\n`);
    });
  }

  it('canonicalJson gives each recorded output', () => {
    const { cases } = read('canonical-json.json') as { cases: { name: string; json: string; canonical: string }[] };
    expect(cases.map((c) => c.name)).toEqual(Object.keys(CASES));
    for (const c of cases) expect(canonicalJson(JSON.parse(c.json)), c.name).toBe(c.canonical);
  });

  it('every recorded audit row hashes to its hash and links to the one before', () => {
    const { rows } = read('audit-chain.json') as { rows: AuditRow[] };
    expect(rows).toEqual(auditChain());
    rows.forEach((r, i) => {
      expect(computeAuditHash(r)).toBe(r.hash);
      expect(r.prev_hash).toBe(i === 0 ? GENESIS_HASH : rows[i - 1]!.hash);
    });
  });
});
