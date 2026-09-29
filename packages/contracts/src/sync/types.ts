// LLD §2.6 sync_outbox + §7 protocol types. Stage 1 writes outbox rows; the worker lands in Stage 7.
export type OutboxEntityType =
  | 'business'
  | 'branch'
  | 'terminal'
  | 'doc_series'
  | 'setting'
  | 'user_pin'
  | 'uom'
  | 'category'
  | 'brand'
  | 'product'
  | 'barcode'
  | 'uom_conversion'
  | 'price_list'
  | 'price_list_item';
export type OutboxOperationType = 'create' | 'update' | 'cancel' | 'void';
export type OutboxStatus = 'pending' | 'in_flight' | 'sent' | 'failed' | 'dead' | 'superseded';
export type OutboxErrorClass = 'transient' | 'permanent' | 'dependency';

export interface OutboxRow {
  seq: number;
  operationId: string;
  businessId: string;
  deviceId: string;
  entityType: OutboxEntityType | string;
  entityId: string;
  operationType: OutboxOperationType;
  payloadJson: string;
  payloadHash: string;
  dependsOnOperationId: string | null;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorClass: OutboxErrorClass | null;
  createdAt: string;
  batchId: string | null;
}

export const SYNC_STREAMS = ['masters', 'config', 'documents', 'control'] as const;
export type SyncStream = (typeof SYNC_STREAMS)[number];

/**
 * Headers every cloud request carries (LLD §7).
 * X-Device-Timestamp is UNIX SECONDS (string). X-Device-Signature = base64(std) Ed25519 over
 * `METHOD\nPATH\nTIMESTAMP\nsha256hex(body)`; PATH includes `/v1`, excludes the query string.
 * The Go verifier (cloud/internal/device/signature.go) rebuilds exactly this string.
 */
export const DEVICE_SIGNING_STRING = (method: string, path: string, unixSeconds: string, bodySha256Hex: string): string =>
  `${method.toUpperCase()}\n${path}\n${unixSeconds}\n${bodySha256Hex}`;

export const SYNC_HEADERS = {
  deviceId: 'X-Device-Id',
  deviceSignature: 'X-Device-Signature',
  deviceTimestamp: 'X-Device-Timestamp',
  appVersion: 'X-App-Version',
  schemaVersion: 'X-Schema-Version',
  syncProtocol: 'X-Sync-Protocol',
  requestId: 'X-Request-Id',
  serverTime: 'X-Server-Time',
} as const;
