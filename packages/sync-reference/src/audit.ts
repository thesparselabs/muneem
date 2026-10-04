import { createHash } from 'node:crypto';
import { AUDIT_GENESIS_HASH, auditHashInput, type AuditEntryPayload } from '@muneem/contracts';
import { canonicalJson } from './canonical.js';

export interface StoredAuditEntry { row: AuditEntryPayload; operationId: string; pushedBy: string }

export type AuditVerdict =
  | { kind: 'append' }
  | { kind: 'duplicate' }
  | { kind: 'gap'; detail: string }
  | { kind: 'broken'; detail: string };

export const auditHash = (row: AuditEntryPayload): string => createHash('sha256').update(canonicalJson(auditHashInput(row))).digest('hex');

// One business's audit chains, one per device, kept whole and in seq order (ADR-0048).
export class AuditLedger {
  private readonly chains = new Map<string, StoredAuditEntry[]>();

  chain(deviceId: string): readonly StoredAuditEntry[] { return this.chains.get(deviceId) ?? []; }

  devices(): string[] { return [...this.chains.keys()].sort(); }

  // The row's own hash first, then its place: a seq already held, the next seq linked to the last hash, or a gap to wait on.
  check(row: AuditEntryPayload): AuditVerdict {
    if (auditHash(row) !== row.hash) return { kind: 'broken', detail: `seq ${row.seq}: the hash does not match the row` };
    const chain = this.chain(row.device_id);
    const held = chain[row.seq - 1];
    if (held) return held.row.hash === row.hash ? { kind: 'duplicate' } : { kind: 'broken', detail: `seq ${row.seq} already holds another row` };
    if (row.seq > chain.length + 1) return { kind: 'gap', detail: `waiting for audit seq ${chain.length + 1}` };
    const previous = chain.at(-1)?.row.hash ?? AUDIT_GENESIS_HASH;
    if (row.prev_hash !== previous) return { kind: 'broken', detail: `seq ${row.seq}: prev_hash does not link to seq ${row.seq - 1}` };
    return { kind: 'append' };
  }

  append(entry: StoredAuditEntry): void {
    const chain = this.chains.get(entry.row.device_id) ?? [];
    chain.push(entry);
    this.chains.set(entry.row.device_id, chain);
  }
}
