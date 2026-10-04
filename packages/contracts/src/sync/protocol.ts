import { z } from 'zod';
import type { OutboxEntityType, PushStream, SyncStream } from './types.js';

export const SYNC_PROTOCOL = 1;
export const PUSH_MAX_OPERATIONS = 200;
export const PUSH_MAX_BYTES = 2 * 1024 * 1024;
export const PULL_MAX_LIMIT = 500;

// LLD §7.2: control first so a revocation or lock is never stuck behind thousands of products.
export const STREAM_ORDER: readonly SyncStream[] = ['control', 'config', 'masters', 'documents'];

export const STREAM_OF: Readonly<Record<OutboxEntityType, PushStream>> = {
  accounting_period: 'control',
  business: 'config', branch: 'config', terminal: 'config', doc_series: 'config', setting: 'config', user_pin: 'config', account: 'config',
  expense_category: 'config',
  uom: 'masters', category: 'masters', brand: 'masters', product: 'masters', barcode: 'masters', uom_conversion: 'masters', price_list: 'masters',
  price_list_item: 'masters', customer: 'masters', customer_credit_limit: 'masters', supplier: 'masters', warehouse: 'masters',
  pos_session: 'documents', cash_movement: 'documents', sale: 'documents', stock_adjustment: 'documents', party_opening: 'documents',
  purchase: 'documents', debit_note: 'documents', credit_note: 'documents', payment: 'documents', write_off: 'documents', expense: 'documents', allocation: 'documents',
  journal_entry: 'documents',
  audit_entry: 'audit',
};
export const SYNC_ENTITY_TYPES = Object.keys(STREAM_OF) as OutboxEntityType[];

export const SYNC_ERROR_CODES = {
  TOTAL_MISMATCH: 'permanent', JOURNAL_IMBALANCE: 'permanent', JOURNAL_MISMATCH: 'permanent', PAYLOAD_INVALID: 'permanent',
  AUDIT_CHAIN_BROKEN: 'permanent', DEPENDENCY_MISSING: 'dependency', BUSINESS_UNKNOWN: 'transient', VERSION_UNSUPPORTED: 'transient', UNKNOWN_ENTITY: 'transient',
} as const;
export type SyncErrorCode = keyof typeof SYNC_ERROR_CODES;

const Ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/u);
const Iso = z.string().datetime({ offset: true });
const ErrorClass = z.enum(['transient', 'permanent', 'dependency']);

export const PushOperation = z.object({
  operationId: Ulid, seq: z.number().int().positive(), entityType: z.string().min(1).max(40), entityId: z.string().min(1).max(64),
  operationType: z.enum(['create', 'update', 'cancel', 'void']), dependsOn: Ulid.nullable(), payloadHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  payload: z.record(z.unknown()),
});
export type PushOperation = z.infer<typeof PushOperation>;

export const PushRequest = z.object({
  businessId: Ulid, protocol: z.literal(SYNC_PROTOCOL), schemaVersion: z.number().int().nonnegative(), clientTime: Iso,
  operations: z.array(PushOperation).min(1).max(PUSH_MAX_OPERATIONS),
});
export type PushRequest = z.infer<typeof PushRequest>;

export const SyncError = z.object({ code: z.string(), class: ErrorClass, detail: z.string() });
export type SyncError = z.infer<typeof SyncError>;

export const PushResult = z.object({
  operationId: Ulid, status: z.enum(['applied', 'duplicate', 'rejected', 'deferred']), serverSeq: z.number().int().optional(), error: SyncError.optional(),
});
export type PushResult = z.infer<typeof PushResult>;

export const PushResponse = z.object({ serverTime: Iso, nextPullSeq: z.number().int().nonnegative(), results: z.array(PushResult) });
export type PushResponse = z.infer<typeof PushResponse>;

export const Change = z.object({
  seq: z.number().int().positive(), stream: z.enum(['masters', 'config', 'documents', 'control']), entityType: z.string(), entityId: z.string(),
  op: z.enum(['upsert', 'delete']), version: z.number().int().positive(), originDeviceId: z.string().nullable(), payload: z.record(z.unknown()),
});
export type Change = z.infer<typeof Change>;

export const PullResponse = z.object({ changes: z.array(Change), nextSeq: z.number().int().nonnegative(), hasMore: z.boolean(), serverTime: Iso });
export type PullResponse = z.infer<typeof PullResponse>;

export const Snapshot = z.object({
  snapshotId: Ulid, status: z.enum(['building', 'ready', 'failed']), url: z.string().url().optional(), asOfSeq: z.number().int().nonnegative().optional(),
  bytes: z.number().int().nonnegative().optional(), expiresAt: Iso.optional(),
});
export type Snapshot = z.infer<typeof Snapshot>;

// The first line of a hydration bundle; every following line is a Change (ADR-0038).
export const BundleHeader = z.object({
  format: z.literal('muneem-bundle'), version: z.literal(1), businessId: Ulid, asOfSeq: z.number().int().nonnegative(),
  counts: z.record(z.number().int().nonnegative()),
});
export type BundleHeader = z.infer<typeof BundleHeader>;
