import { STREAM_OF, type Change, type OutboxEntityType, type PullResponse, type SyncStream } from '@muneem/contracts';
import type { Db } from '../../open.js';
import { rewriteLevels } from '../../repositories/inventory.js';
import { withTransaction } from '../../uow.js';
import { setCursor } from '../syncState.js';
import { applyBarcode, applyConversion, applyPriceItems, BRAND, CATEGORY, PRICE_LIST, PRODUCT, UOM, WAREHOUSE } from './catalog.js';
import { ACCOUNT, applyBusiness, applySetting, BRANCH, DOC_SERIES, EXPENSE_CATEGORY, TERMINAL } from './config.js';
import { actorFor, appliedVersion, markApplied, Touched, type ApplyContext } from './context.js';
import { applyConflictLog, applyDeviceMessage, applyPeriod, applyReviewItem } from './control.js';
import { applyDocument, type DocumentApplier } from './documents.js';
import { EXPENSE } from './expenses.js';
import { applyJournalEntry } from './journals.js';
import { applyMaster, type MasterSpec } from './master.js';
import { CUSTOMER, SUPPLIER, applyCreditLimit } from './parties.js';
import { DEBIT_NOTE, PURCHASE } from './purchases.js';
import { applyCashMovement, POS_SESSION } from './register.js';
import { recordLocalReview } from './review.js';
import { SALE } from './sales.js';
import { applyAllocationEntity, PARTY_OPENING, PAYMENT, WRITE_OFF } from './settlements.js';
import { applyStockDocument } from './stock.js';

type Applier = (ctx: ApplyContext) => void;
const master = (spec: MasterSpec): Applier => (ctx) => applyMaster(spec, ctx);
const document = (a: DocumentApplier): Applier => (ctx) => applyDocument(a, ctx);

// One apply function per entity type, keyed like STREAM_OF (7e); control messages have their own (the Go cloud says review_item, the reference server conflict_log).
const APPLIERS: Readonly<Record<OutboxEntityType | 'conflict_log' | 'review_item' | 'device', Applier>> = {
  business: applyBusiness, branch: master(BRANCH), terminal: master(TERMINAL), doc_series: master(DOC_SERIES), setting: applySetting, user_pin: () => undefined,
  account: master(ACCOUNT), expense_category: master(EXPENSE_CATEGORY),
  uom: master(UOM), category: master(CATEGORY), brand: master(BRAND), product: master(PRODUCT), barcode: applyBarcode, uom_conversion: applyConversion,
  price_list: master(PRICE_LIST), price_list_item: applyPriceItems, customer: master(CUSTOMER), customer_credit_limit: applyCreditLimit, supplier: master(SUPPLIER),
  warehouse: master(WAREHOUSE),
  pos_session: document(POS_SESSION), cash_movement: applyCashMovement, sale: document(SALE), stock_adjustment: applyStockDocument,
  party_opening: document(PARTY_OPENING), purchase: document(PURCHASE), debit_note: document(DEBIT_NOTE), payment: document(PAYMENT), write_off: document(WRITE_OFF),
  expense: document(EXPENSE), allocation: applyAllocationEntity, journal_entry: applyJournalEntry,
  accounting_period: applyPeriod, conflict_log: applyConflictLog, review_item: applyReviewItem, device: applyDeviceMessage,
};

// includeOwn: a hydrating device takes every change, its own included, since nothing it once sent is in this database.
export interface ApplyTarget { businessId: string; cloudDeviceId: string; includeOwn?: boolean }
export type ApplyOutcome = 'applied' | 'own' | 'seen' | 'unknown';

const isDocument = (entityType: string): boolean => STREAM_OF[entityType as OutboxEntityType] === 'documents';

// Idempotent on (entity, version); writes no outbox row and no local audit row. Runs inside the caller's transaction.
// A document's own echo is skipped; a master's or config's is applied, so this device adopts the cloud's version and
// any older merged version applied in between is overwritten by what it sent last.
export function applyChange(db: Db, t: ApplyTarget, change: Change, touched: Touched): ApplyOutcome {
  const own = !t.includeOwn && change.originDeviceId !== null && change.originDeviceId === t.cloudDeviceId;
  if (own && isDocument(change.entityType)) {
    markApplied(db, t.businessId, change.entityType, change.entityId, change.version);
    return 'own';
  }
  if (appliedVersion(db, t.businessId, change.entityType, change.entityId) >= change.version) return 'seen';
  const apply = APPLIERS[change.entityType as keyof typeof APPLIERS];
  if (!apply) return 'unknown';
  apply({ db, businessId: t.businessId, cloudDeviceId: t.cloudDeviceId, change, actor: actorFor(change), touched });
  markApplied(db, t.businessId, change.entityType, change.entityId, change.version);
  return own ? 'own' : 'applied';
}

export interface PageResult { applied: number; own: number; seen: number; unknown: number; failed: number }
export const emptyPageResult = (): PageResult => ({ applied: 0, own: 0, seen: 0, unknown: 0, failed: 0 });

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// A change that cannot be applied never stops its stream: its savepoint rolls back, it becomes a review item, and the page goes on.
function applyOrRecord(db: Db, t: ApplyTarget, c: Change, touched: Touched): ApplyOutcome | 'failed' {
  try {
    return db.transaction(() => applyChange(db, t, c, touched))();
  } catch (e) {
    recordLocalReview(db, {
      id: `apply-failed:${c.entityType}:${c.entityId}:${c.version}`, businessId: t.businessId, kind: 'apply_failed', entityType: c.entityType, entityId: c.entityId,
      rule: 'skipped', winner: 'cloud', cloudValue: { seq: c.seq, version: c.version, error: reason(e) },
    });
    return 'failed';
  }
}

// Applies changes inside the caller's transaction; stock levels follow the movements they inserted.
export function applyChanges(db: Db, t: ApplyTarget, changes: readonly Change[]): PageResult {
  const touched = new Touched();
  const result = emptyPageResult();
  for (const c of changes) result[applyOrRecord(db, t, c, touched)] += 1;
  rewriteLevels(db, t.businessId, touched.list());
  return result;
}

// A page and its cursor advance commit together.
export function applyPullPage(db: Db, t: ApplyTarget, stream: SyncStream, page: PullResponse, now: string): PageResult {
  return withTransaction(db, () => {
    const result = applyChanges(db, t, page.changes);
    setCursor(db, t.businessId, stream, page.nextSeq, now);
    return result;
  });
}

export { Touched } from './context.js';
