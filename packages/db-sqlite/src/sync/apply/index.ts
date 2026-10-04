import type { Change, OutboxEntityType, PullResponse, SyncStream } from '@muneem/contracts';
import type { Db } from '../../open.js';
import { rewriteLevels } from '../../repositories/inventory.js';
import { withTransaction } from '../../uow.js';
import { setCursor } from '../syncState.js';
import { applyBarcode, applyConversion, applyPriceItems, BRAND, CATEGORY, PRICE_LIST, PRODUCT, UOM, WAREHOUSE } from './catalog.js';
import { ACCOUNT, applyBusiness, applySetting, BRANCH, DOC_SERIES, EXPENSE_CATEGORY, TERMINAL } from './config.js';
import { actorFor, appliedVersion, markApplied, Touched, type ApplyContext } from './context.js';
import { applyConflictLog, applyDeviceMessage, applyPeriod } from './control.js';
import { applyDocument, type DocumentApplier } from './documents.js';
import { EXPENSE } from './expenses.js';
import { applyJournalEntry } from './journals.js';
import { applyMaster, type MasterSpec } from './master.js';
import { CUSTOMER, SUPPLIER, applyCreditLimit } from './parties.js';
import { DEBIT_NOTE, PURCHASE } from './purchases.js';
import { applyCashMovement, POS_SESSION } from './register.js';
import { SALE } from './sales.js';
import { applyAllocationEntity, PARTY_OPENING, PAYMENT, WRITE_OFF } from './settlements.js';
import { applyStockDocument } from './stock.js';

type Applier = (ctx: ApplyContext) => void;
const master = (spec: MasterSpec): Applier => (ctx) => applyMaster(spec, ctx);
const document = (a: DocumentApplier): Applier => (ctx) => applyDocument(a, ctx);

// One apply function per entity type, keyed like STREAM_OF (7e); control messages have their own.
const APPLIERS: Readonly<Record<OutboxEntityType | 'conflict_log' | 'device', Applier>> = {
  business: applyBusiness, branch: master(BRANCH), terminal: master(TERMINAL), doc_series: master(DOC_SERIES), setting: applySetting, user_pin: () => undefined,
  account: master(ACCOUNT), expense_category: master(EXPENSE_CATEGORY),
  uom: master(UOM), category: master(CATEGORY), brand: master(BRAND), product: master(PRODUCT), barcode: applyBarcode, uom_conversion: applyConversion,
  price_list: master(PRICE_LIST), price_list_item: applyPriceItems, customer: master(CUSTOMER), customer_credit_limit: applyCreditLimit, supplier: master(SUPPLIER),
  warehouse: master(WAREHOUSE),
  pos_session: document(POS_SESSION), cash_movement: applyCashMovement, sale: document(SALE), stock_adjustment: applyStockDocument,
  party_opening: document(PARTY_OPENING), purchase: document(PURCHASE), debit_note: document(DEBIT_NOTE), payment: document(PAYMENT), write_off: document(WRITE_OFF),
  expense: document(EXPENSE), allocation: applyAllocationEntity, journal_entry: applyJournalEntry,
  accounting_period: applyPeriod, conflict_log: applyConflictLog, device: applyDeviceMessage,
};

export interface ApplyTarget { businessId: string; cloudDeviceId: string }
export type ApplyOutcome = 'applied' | 'own' | 'seen' | 'unknown';

// Idempotent on (entity, version); writes no outbox row and no local audit row. Runs inside the caller's transaction.
export function applyChange(db: Db, t: ApplyTarget, change: Change, touched: Touched): ApplyOutcome {
  if (change.originDeviceId !== null && change.originDeviceId === t.cloudDeviceId) {
    markApplied(db, t.businessId, change.entityType, change.entityId, change.version);
    return 'own';
  }
  if (appliedVersion(db, t.businessId, change.entityType, change.entityId) >= change.version) return 'seen';
  const apply = APPLIERS[change.entityType as keyof typeof APPLIERS];
  if (!apply) return 'unknown';
  apply({ db, businessId: t.businessId, cloudDeviceId: t.cloudDeviceId, change, actor: actorFor(change), touched });
  markApplied(db, t.businessId, change.entityType, change.entityId, change.version);
  return 'applied';
}

export interface PageResult { applied: number; own: number; seen: number; unknown: number }

// A page and its cursor advance commit together; stock levels follow the movements it inserted.
export function applyPullPage(db: Db, t: ApplyTarget, stream: SyncStream, page: PullResponse, now: string): PageResult {
  return withTransaction(db, () => {
    const touched = new Touched();
    const result: PageResult = { applied: 0, own: 0, seen: 0, unknown: 0 };
    for (const c of page.changes) {
      try {
        result[applyChange(db, t, c, touched)] += 1;
      } catch (e) {
        throw new Error(`applying ${c.entityType} ${c.entityId} v${c.version} (seq ${c.seq}): ${e instanceof Error ? e.message : String(e)}`, { cause: e });
      }
    }
    rewriteLevels(db, t.businessId, touched.list());
    setCursor(db, t.businessId, stream, page.nextSeq, now);
    return result;
  });
}

export { Touched } from './context.js';
