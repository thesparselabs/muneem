import type { OutboxEntityType, OutboxOperationType } from '@muneem/contracts';
import { appendAudit } from '../audit.js';
import type { Db } from '../open.js';
import { appendOutbox } from '../outbox.js';
import { nextLocalSeq } from '../sequence.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';

export interface Change {
  action: string;
  entityType: OutboxEntityType;
  entityId: string;
  operationType: OutboxOperationType;
  before?: unknown;
  after: unknown;
}

// One semantic audit row plus the aggregate root's outbox row; returns the operation id children depend on.
export function recordChange(db: Db, businessId: string, actor: Actor, c: Change): string {
  nextLocalSeq(db);
  appendAudit(db, {
    businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId,
    action: c.action, entityType: c.entityType, entityId: c.entityId, before: c.before, after: c.after,
  });
  return appendOutbox(db, {
    businessId, deviceId: actor.deviceId, entityType: c.entityType, entityId: c.entityId,
    operationType: c.operationType, payload: c.after,
  }).operationId;
}

export function queueChild(
  db: Db, businessId: string, actor: Actor,
  entityType: OutboxEntityType, entityId: string, operationType: OutboxOperationType, payload: unknown, dependsOn: string,
): void {
  appendOutbox(db, { businessId, deviceId: actor.deviceId, entityType, entityId, operationType, payload, dependsOnOperationId: dependsOn });
}

export function syncColumns(actor: Actor): { t: string; created_by: string; device_id: string } {
  return { t: nowIso(), created_by: actor.userId, device_id: actor.deviceId };
}
