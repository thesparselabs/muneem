import type { Change, SyncError } from '@muneem/contracts';

export type Payload = Record<string, unknown>;

export interface EntityState {
  entityType: string; entityId: string; version: number; payload: Payload; originDeviceId: string; updatedAt: string | null;
  deletedAt: string | null; history: Map<number, Payload>;
}

export interface OperationRecord { status: 'applied' | 'rejected'; payloadHash: string; serverSeq?: number; error?: SyncError }

export interface DeadLetter { operationId: string; deviceId: string; entityType: string; entityId: string; payload: Payload; error: SyncError; at: string }

export interface ConflictLogRow {
  id: string; kind: 'conflict' | 'duplicate_barcode' | 'late_arrival' | 'tombstone'; entityType: string; entityId: string; deviceId: string;
  rule: string; winner: 'cloud' | 'device'; field?: string; cloudValue?: unknown; deviceValue?: unknown; at: string;
}

// One business's slice of the cloud: entity_state, change_log, sync_operation, dead_letter and conflict_log (ADR-0038).
export class BusinessState {
  readonly entities = new Map<string, EntityState>();
  readonly changes: Change[] = [];
  readonly operations = new Map<string, OperationRecord>();
  readonly appliedOperationIds = new Set<string>();
  readonly deadLetters: DeadLetter[] = [];
  readonly conflictLog: ConflictLogRow[] = [];
  readonly lockedMonths = new Set<string>();

  constructor(readonly id: string, readonly organizationId: string) {}

  entity(entityType: string, entityId: string): EntityState | undefined {
    return this.entities.get(`${entityType}:${entityId}`);
  }

  put(e: EntityState): void {
    this.entities.set(`${e.entityType}:${e.entityId}`, e);
  }

  live(entityType: string, entityId: string): boolean {
    const e = this.entity(entityType, entityId);
    return !!e && e.deletedAt === null;
  }
}
