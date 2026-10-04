import {
  PULL_MAX_LIMIT, PUSH_MAX_BYTES, PushRequest, STREAM_OF, SYNC_ERROR_CODES, payloadSchema, type Change, type OutboxEntityType, type PullResponse,
  type PushOperation, type PushResponse, type PushResult, type Snapshot, type SyncError, type SyncErrorCode, type SyncStream,
} from '@muneem/contracts';
import { payloadHash } from './canonical.js';
import { buildBundle, encodeBundle } from './bundle.js';
import { applyOperation, type NewChange, type NewConflict } from './entities.js';
import { ServerError } from './errors.js';
import { requiredRefs } from './references.js';
import { BusinessState, type ConflictLogRow, type DeadLetter, type EntityState } from './state.js';
import { verifyOperation } from './verify.js';

export interface PullQuery { businessId: string; stream: SyncStream; since: number; limit: number }

// What a device reaches over the wire; the fault injector wraps it and the transports call it.
export interface SyncServer {
  push(deviceId: string, body: unknown): Promise<PushResponse>;
  pull(deviceId: string, query: PullQuery): Promise<PullResponse>;
  bootstrap(deviceId: string, body: { businessId: string }): Promise<Snapshot>;
  snapshot(deviceId: string, snapshotId: string): Promise<Snapshot>;
}

// A bundle's object, as S3 serves it: a plain GET of its URL, from a byte offset (206) or whole (200).
export interface BundleObject { status: 200 | 206 | 404 | 416; body: Buffer; total: number }

interface StoredSnapshot { snapshotId: string; businessId: string; deviceId: string; asOfSeq: number; bytes: Buffer }

interface Device { userId: string; revoked: boolean }
export interface ReferenceServerOptions { now?: () => Date; minSchemaVersion?: number }

const error = (code: SyncErrorCode, detail: string): SyncError => ({ code, class: SYNC_ERROR_CODES[code], detail });

// ADR-0042: the protocol and conflict matrix over in-memory maps, deterministic for a given call order.
export class ReferenceServer implements SyncServer {
  private seq = 0;
  private conflictNo = 0;
  private readonly devices = new Map<string, Device>();
  private readonly memberships = new Map<string, Set<string>>();
  private readonly businesses = new Map<string, BusinessState>();
  private readonly snapshots = new Map<string, StoredSnapshot>();
  private snapshotNo = 0;

  constructor(private readonly opts: ReferenceServerOptions = {}) {}

  private now(): Date { return this.opts.now?.() ?? new Date(); }

  addMember(userId: string, organizationId: string): void {
    const orgs = this.memberships.get(userId) ?? new Set<string>();
    orgs.add(organizationId);
    this.memberships.set(userId, orgs);
  }

  registerDevice(deviceId: string, userId: string): void { this.devices.set(deviceId, { userId, revoked: false }); }

  // 7c: revoking emits a control change and the device's next push or pull is refused.
  revokeDevice(deviceId: string): void {
    const d = this.devices.get(deviceId);
    if (!d) return;
    d.revoked = true;
    for (const b of this.businesses.values()) {
      if (!this.memberships.get(d.userId)?.has(b.organizationId)) continue;
      this.append(b, { stream: 'control', entityType: 'device', entityId: deviceId, op: 'upsert', version: 1, originDeviceId: null, payload: { deviceId, status: 'revoked' } });
    }
  }

  business(id: string): BusinessState | undefined { return this.businesses.get(id); }
  entity(businessId: string, entityType: string, entityId: string): EntityState | undefined { return this.businesses.get(businessId)?.entity(entityType, entityId); }
  deadLetters(businessId: string): readonly DeadLetter[] { return this.businesses.get(businessId)?.deadLetters ?? []; }
  conflicts(businessId: string): readonly ConflictLogRow[] { return this.businesses.get(businessId)?.conflictLog ?? []; }

  async push(deviceId: string, body: unknown): Promise<PushResponse> {
    this.device(deviceId);
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > PUSH_MAX_BYTES) throw new ServerError(413, 'PAYLOAD_TOO_LARGE');
    const parsed = PushRequest.safeParse(body);
    if (!parsed.success) throw new ServerError(400, 'PAYLOAD_INVALID', parsed.error.issues[0]?.message);
    if (parsed.data.schemaVersion < (this.opts.minSchemaVersion ?? 0)) throw new ServerError(426, 'VERSION_UNSUPPORTED');
    const results = parsed.data.operations.map((op) => this.pushOne(deviceId, parsed.data.businessId, op));
    return { serverTime: this.now().toISOString(), nextPullSeq: this.seq, results };
  }

  async pull(deviceId: string, q: PullQuery): Promise<PullResponse> {
    const d = this.device(deviceId);
    const b = this.businesses.get(q.businessId);
    const serverTime = this.now().toISOString();
    if (!b) return { changes: [], nextSeq: q.since, hasMore: false, serverTime };
    if (!this.memberships.get(d.userId)?.has(b.organizationId)) throw new ServerError(403, 'PERMISSION_DENIED');
    const limit = Math.min(Math.max(1, q.limit), PULL_MAX_LIMIT);
    const after = b.changes.filter((c) => c.stream === q.stream && c.seq > q.since);
    const changes = after.slice(0, limit);
    return { changes, nextSeq: changes.at(-1)?.seq ?? q.since, hasMore: after.length > limit, serverTime };
  }

  // 7f: the bundle is built at once from the change log; it reads as building until its status is asked for.
  async bootstrap(deviceId: string, body: { businessId: string }): Promise<Snapshot> {
    const d = this.device(deviceId);
    const b = this.businesses.get(body.businessId);
    if (!b) throw new ServerError(404, 'BUSINESS_UNKNOWN');
    if (!this.memberships.get(d.userId)?.has(b.organizationId)) throw new ServerError(403, 'PERMISSION_DENIED');
    const bundle = buildBundle(b);
    const snapshotId = `01J${String(++this.snapshotNo).padStart(23, '0')}`;
    this.snapshots.set(snapshotId, { snapshotId, businessId: b.id, deviceId, asOfSeq: bundle.header.asOfSeq, bytes: encodeBundle(bundle) });
    return { snapshotId, status: 'building' };
  }

  async snapshot(deviceId: string, snapshotId: string): Promise<Snapshot> {
    this.device(deviceId);
    const s = this.snapshots.get(snapshotId);
    if (!s || s.deviceId !== deviceId) throw new ServerError(404, 'NOT_FOUND');
    return {
      snapshotId, status: 'ready', url: `${ReferenceServer.BUNDLE_HOST}${snapshotId}.ndjson.gz`, asOfSeq: s.asOfSeq, bytes: s.bytes.length,
      expiresAt: new Date(this.now().getTime() + 3_600_000).toISOString(),
    };
  }

  static readonly BUNDLE_HOST = 'https://bundles.reference.test/';

  bundleObject(url: string, from = 0): BundleObject {
    const id = url.startsWith(ReferenceServer.BUNDLE_HOST) ? url.slice(ReferenceServer.BUNDLE_HOST.length).replace(/\.ndjson\.gz$/u, '') : '';
    const s = this.snapshots.get(id);
    if (!s) return { status: 404, body: Buffer.alloc(0), total: 0 };
    const total = s.bytes.length;
    if (from >= total && from > 0) return { status: 416, body: Buffer.alloc(0), total };
    return { status: from > 0 ? 206 : 200, body: s.bytes.subarray(from), total };
  }

  private device(deviceId: string): Device {
    const d = this.devices.get(deviceId);
    if (!d) throw new ServerError(401, 'DEVICE_UNKNOWN');
    if (d.revoked) throw new ServerError(401, 'DEVICE_REVOKED');
    return d;
  }

  private pushOne(deviceId: string, businessId: string, op: PushOperation): PushResult {
    const known = this.businesses.get(businessId) ?? this.createdOffline(deviceId, businessId, op);
    if (!known) return { operationId: op.operationId, status: 'deferred', error: error('BUSINESS_UNKNOWN', `business ${businessId} is not on the cloud yet`) };
    const key = `${deviceId}:${op.operationId}`;
    const seen = known.operations.get(key);
    if (seen) return seen.payloadHash === op.payloadHash
      ? { operationId: op.operationId, status: seen.status === 'applied' ? 'duplicate' : 'rejected', ...(seen.serverSeq !== undefined && { serverSeq: seen.serverSeq }), ...(seen.error && { error: seen.error }) }
      : this.reject(known, deviceId, op, error('PAYLOAD_INVALID', 'operation id reused with a different payload'), false);
    const refused = this.refusal(known, op);
    if (refused) return refused.class === 'permanent' ? this.reject(known, deviceId, op, refused, true) : { operationId: op.operationId, status: refused.class === 'dependency' ? 'deferred' : 'rejected', error: refused };
    const at = this.now().toISOString();
    const applied = applyOperation(known, op, deviceId, at);
    const serverSeq = applied.change ? this.append(known, applied.change) : this.seq;
    for (const c of applied.conflicts) this.logConflict(known, c, at);
    known.operations.set(key, { status: 'applied', payloadHash: op.payloadHash, serverSeq });
    known.appliedOperationIds.add(op.operationId);
    return { operationId: op.operationId, status: 'applied', serverSeq };
  }

  // ADR-0039: a business made on the desktop arrives as its own create, from a user of its organization.
  private createdOffline(deviceId: string, businessId: string, op: PushOperation): BusinessState | null {
    if (op.entityType !== 'business' || op.operationType !== 'create' || op.entityId !== businessId) return null;
    const organizationId = String(op.payload.organizationId ?? '');
    if (!this.memberships.get(this.devices.get(deviceId)!.userId)?.has(organizationId)) return null;
    const b = new BusinessState(businessId, organizationId);
    this.businesses.set(businessId, b);
    return b;
  }

  private refusal(b: BusinessState, op: PushOperation): SyncError | null {
    if (!(op.entityType in STREAM_OF)) return error('UNKNOWN_ENTITY', `no stream for ${op.entityType}`);
    if (payloadHash(op.payload) !== op.payloadHash) return error('PAYLOAD_INVALID', 'payload hash does not match');
    const schema = payloadSchema(op.entityType as OutboxEntityType, op.operationType).safeParse(op.payload);
    if (!schema.success) return error('PAYLOAD_INVALID', schema.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    if (op.dependsOn && !b.appliedOperationIds.has(op.dependsOn)) return error('DEPENDENCY_MISSING', `waiting for operation ${op.dependsOn}`);
    const missing = requiredRefs(op.entityType, op.operationType, op.entityId, op.payload).find((r) => !b.live(r.entityType, r.entityId));
    if (missing) return error('DEPENDENCY_MISSING', `waiting for ${missing.entityType} ${missing.entityId}`);
    const failed = verifyOperation(op.entityType, op.operationType, op.payload);
    return failed ? error(failed, `${op.entityType} ${op.entityId} failed verification`) : null;
  }

  // Nothing is dropped and nothing is silently fixed: the full payload goes to dead-letter (ADR-0038).
  private reject(b: BusinessState, deviceId: string, op: PushOperation, err: SyncError, record: boolean): PushResult {
    b.deadLetters.push({ operationId: op.operationId, deviceId, entityType: op.entityType, entityId: op.entityId, payload: op.payload, error: err, at: this.now().toISOString() });
    if (record) b.operations.set(`${deviceId}:${op.operationId}`, { status: 'rejected', payloadHash: op.payloadHash, error: err });
    return { operationId: op.operationId, status: 'rejected', error: err };
  }

  private append(b: BusinessState, c: NewChange): number {
    const change: Change = { seq: ++this.seq, ...c };
    b.changes.push(change);
    return change.seq;
  }

  // Every non-trivial resolution is kept and pulled to devices as a review item.
  private logConflict(b: BusinessState, c: NewConflict, at: string): void {
    const row: ConflictLogRow = { id: `conflict-${String(++this.conflictNo).padStart(8, '0')}`, at, ...c };
    b.conflictLog.push(row);
    this.append(b, { stream: 'control', entityType: 'conflict_log', entityId: row.id, op: 'upsert', version: 1, originDeviceId: null, payload: { ...row } });
  }
}
