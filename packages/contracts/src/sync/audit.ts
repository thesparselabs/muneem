import { z } from 'zod';

export const AUDIT_GENESIS_HASH = '0'.repeat(64);

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/u);

// An audit_entry operation carries the audit_log row exactly as stored, so the cloud recomputes its hash (ADR-0048).
export const AuditEntryPayload = z.object({
  id: z.string().min(1).max(64), business_id: z.string().min(1), seq: z.number().int().positive(), user_id: z.string(),
  device_id: z.string().min(1).max(64), terminal_id: z.string().nullable(), action: z.string(), entity_type: z.string(),
  entity_id: z.string().nullable(), before_json: z.string().nullable(), after_json: z.string().nullable(), reason: z.string().nullable(),
  occurred_at: z.string(), prev_hash: Hex64, hash: Hex64,
}).strict();
export type AuditEntryPayload = z.infer<typeof AuditEntryPayload>;

// The fields the hash covers, in the shape canonicalJson serialises (LLD §16).
export function auditHashInput(r: Omit<AuditEntryPayload, 'id' | 'hash' | 'terminal_id' | 'reason'>): Record<string, unknown> {
  return {
    seq: r.seq, business_id: r.business_id, device_id: r.device_id, user_id: r.user_id, action: r.action, entity_type: r.entity_type,
    entity_id: r.entity_id, before: r.before_json === null ? null : JSON.parse(r.before_json) as unknown,
    after: r.after_json === null ? null : JSON.parse(r.after_json) as unknown, occurred_at: r.occurred_at, prev_hash: r.prev_hash,
  };
}
