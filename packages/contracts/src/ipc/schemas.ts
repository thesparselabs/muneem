import { z } from 'zod';

export const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, 'ULID expected');
export const IsoDateTime = z.string().datetime({ offset: true });
export const BusinessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const StateCode = z.string().regex(/^\d{2}$/);
export const Gstin = z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'invalid GSTIN');
export const Pan = z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'invalid PAN');
export const Pin = z.string().regex(/^\d{4,6}$/);
export const Identifier = z.string().min(3).max(120); // mobile or email

export const SessionUser = z.object({
  id: Ulid, name: z.string(), identifier: z.string(), roles: z.array(z.string()),
});
export const Session = z.object({
  user: SessionUser,
  organizationId: Ulid.nullable(),
  businessId: Ulid.nullable(),
  branchId: Ulid.nullable(),
  terminalId: Ulid.nullable(),
  deviceId: z.string(),
  mode: z.enum(['online', 'offline']),
  permVer: z.number().int(),
  offlineDaysRemaining: z.number().int().nullable(),
});
export type Session = z.infer<typeof Session>;

export const BusinessType = z.enum(['retail', 'wholesale', 'distribution', 'service', 'restaurant', 'trading', 'other']);
export const TaxScheme = z.enum(['regular', 'composition', 'unregistered']);

export const BusinessInput = z.object({
  name: z.string().min(1).max(120),
  legalName: z.string().max(200).optional(),
  businessType: BusinessType,
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  stateCode: StateCode,
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  gstin: Gstin.optional(),
  pan: Pan.optional(),
  taxScheme: TaxScheme,
  fyStartMonth: z.literal(4).default(4),
});
export const Business = BusinessInput.extend({
  id: Ulid, organizationId: Ulid, createdAt: IsoDateTime, updatedAt: IsoDateTime, version: z.number().int(),
});
export type Business = z.infer<typeof Business>;

export const BranchInput = z.object({
  code: z.string().regex(/^[A-Z0-9]{2,8}$/),
  name: z.string().min(1).max(120),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  stateCode: StateCode,
  gstin: Gstin.optional(),
  isDefault: z.boolean().default(false),
});
export const Branch = BranchInput.extend({ id: Ulid, businessId: Ulid, createdAt: IsoDateTime, version: z.number().int() });
export type Branch = z.infer<typeof Branch>;

export const TerminalInput = z.object({
  branchId: Ulid,
  code: z.string().regex(/^[A-Z0-9]{1,6}$/),
  name: z.string().min(1).max(80),
});
export const Terminal = TerminalInput.extend({
  id: Ulid, businessId: Ulid, deviceId: z.string().nullable(), createdAt: IsoDateTime, version: z.number().int(),
});
export type Terminal = z.infer<typeof Terminal>;

export const DocSeries = z.object({
  id: Ulid, businessId: Ulid, branchId: Ulid.nullable(), terminalId: Ulid.nullable(),
  docType: z.enum(['tax_invoice', 'bill_of_supply', 'credit_note', 'delivery_challan', 'receipt', 'payment', 'purchase', 'debit_note']),
  fy: z.string().regex(/^\d{4}-\d{2}$/), prefix: z.string().max(40), padWidth: z.number().int().min(3).max(10), nextSeq: z.number().int(),
});

export const SyncStatus = z.object({
  state: z.enum(['synced', 'syncing', 'queued', 'degraded', 'blocked', 'never']),
  pending: z.number().int(), inFlight: z.number().int(), failed: z.number().int(), dead: z.number().int(),
  lastPushAt: IsoDateTime.nullable(), lastPullAt: IsoDateTime.nullable(),
  online: z.boolean(), serverSkewMs: z.number().int().nullable(), detail: z.string().nullable(),
});
export type SyncStatus = z.infer<typeof SyncStatus>;

export const Health = z.object({
  dbPath: z.string(), dbSizeBytes: z.number().int(), schemaVersion: z.number().int(), appVersion: z.string(),
  quickCheck: z.enum(['ok', 'failed', 'not_run']), outboxDepth: z.number().int(), oldestUnsyncedAt: IsoDateTime.nullable(),
  lastBackupAt: IsoDateTime.nullable(), clockSkewMs: z.number().int().nullable(), auditChainOk: z.boolean().nullable(),
  secretStoreAvailable: z.boolean(),
});
export type Health = z.infer<typeof Health>;

export const DeviceInfo = z.object({
  deviceId: z.string().nullable(), installationId: z.string(), registered: z.boolean(),
  appVersion: z.string(), schemaVersion: z.number().int(), platform: z.string(),
});
