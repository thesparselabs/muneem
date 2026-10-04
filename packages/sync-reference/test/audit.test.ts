import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AuditEntryPayload } from '@muneem/contracts';
import { AuditLedger, auditHash, canonicalJson } from '../src/index.js';

const DIR = new URL('../../contracts/fixtures/canonical/', import.meta.url);
const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(name, DIR), 'utf8')) as T;
const { cases } = read<{ cases: { name: string; json: string; canonical: string }[] }>('canonical-json.json');
const { rows } = read<{ rows: AuditEntryPayload[] }>('audit-chain.json');

describe('the reference server hashes as the device does (8g)', () => {
  it('canonicalJson matches every shared case', () => {
    for (const c of cases) expect(canonicalJson(JSON.parse(c.json)), c.name).toBe(c.canonical);
  });

  it('the shared chain verifies row by row; gaps wait, repeats are duplicates, edits are breaks', () => {
    const ledger = new AuditLedger();
    const append = (r: AuditEntryPayload) => { ledger.append({ row: r, operationId: r.id, pushedBy: 'device-A' }); };
    expect(rows.map((r) => auditHash(r) === r.hash)).toEqual(rows.map(() => true));
    expect(ledger.check(rows[1]!)).toMatchObject({ kind: 'gap' });
    append(rows[0]!);
    expect(ledger.check(rows[0]!)).toEqual({ kind: 'duplicate' });
    expect(ledger.check(rows[1]!)).toEqual({ kind: 'append' });
    append(rows[1]!);
    expect(ledger.check({ ...rows[2]!, after_json: '{"tampered":true}' })).toMatchObject({ kind: 'broken', detail: 'seq 3: the hash does not match the row' });
    const relinked = { ...rows[2]!, prev_hash: rows[0]!.hash };
    expect(ledger.check({ ...relinked, hash: auditHash(relinked) })).toEqual({ kind: 'broken', detail: 'seq 3: prev_hash does not link to seq 2' });
    expect(ledger.check({ ...rows[1]!, id: 'other', occurred_at: 'x', hash: auditHash({ ...rows[1]!, occurred_at: 'x' }) })).toEqual({ kind: 'broken', detail: 'seq 2 already holds another row' });
  });
});
