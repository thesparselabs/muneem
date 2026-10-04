import { z } from 'zod';
import { SYNC_STREAMS } from '../sync/types.js';
import { Ulid } from './schemas.js';

const Int = z.number().int();
const Time = z.string();

export const SyncOverview = z.object({
  counts: z.object({ pending: Int, inFlight: Int, sent: Int, failed: Int, dead: Int, superseded: Int }),
  oldestPendingAt: Time.nullable(),
  cursors: z.array(z.object({ stream: z.enum(SYNC_STREAMS), lastSeq: Int, lastPulledAt: Time.nullable() })),
  openReviewItems: Int,
});
export type SyncOverview = z.infer<typeof SyncOverview>;

export const FailedOperation = z.object({
  operationId: z.string(), seq: Int, entityType: z.string(), entityId: z.string(), operationType: z.string(),
  status: z.enum(['failed', 'dead']), attemptCount: Int, errorCode: z.string().nullable(), errorClass: z.string().nullable(),
  errorMessage: z.string().nullable(), lastAttemptAt: Time.nullable(), createdAt: Time,
  payloadJson: z.string(), payloadBytes: Int,
});
export type FailedOperation = z.infer<typeof FailedOperation>;

export const ListFailedInput = z.object({ limit: z.number().int().min(1).max(500).default(100) });
export const ResendInput = z.object({ operationIds: z.array(Ulid).min(1).max(200) });

const ReviewItemId = z.string().min(1).max(64);
export const ReviewItem = z.object({
  id: z.string(), kind: z.string(), entityType: z.string(), entityId: z.string(), entityLabel: z.string().nullable(),
  deviceId: z.string().nullable(), rule: z.string(), winner: z.string(), field: z.string().nullable(),
  cloudValueJson: z.string().nullable(), deviceValueJson: z.string().nullable(),
  occurredAt: Time, receivedAt: Time, reviewedAt: Time.nullable(), reviewedBy: z.string().nullable(),
});
export type ReviewItem = z.infer<typeof ReviewItem>;

export const ListReviewItemsInput = z.object({ status: z.enum(['open', 'reviewed', 'all']).default('open'), limit: z.number().int().min(1).max(500).default(200) });
export const MarkReviewedInput = z.object({ ids: z.array(ReviewItemId).min(1).max(200) });

export const ReconciliationRow = z.object({
  productId: z.string(), productName: z.string(), uomCode: z.string(), warehouseId: z.string(), warehouseName: z.string(), currentQtyMilli: Int,
  movementId: z.string(), movementType: z.string(), refType: z.string(), refId: z.string(), docNumber: z.string().nullable(),
  terminalCode: z.string().nullable(), deviceId: z.string(), viaSync: z.boolean(), occurredAt: Time, qtyMilli: Int, balanceAfterMilli: Int,
});
export type ReconciliationRow = z.infer<typeof ReconciliationRow>;
export const ReconciliationInput = z.object({ limit: z.number().int().min(1).max(1000).default(500) });
