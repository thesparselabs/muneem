import type { PriceList, PriceListItem } from '@muneem/contracts';
import { newUlid, type PriceItem } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { queueChild, recordChange, syncColumns } from './catalogWrite.js';

type PriceListRow = { id: string; business_id: string; name: string; kind: PriceList['kind']; is_default: number; version: number };
const toPriceList = (r: PriceListRow): PriceList => ({
  id: r.id, businessId: r.business_id, name: r.name, kind: r.kind, isDefault: r.is_default === 1, version: r.version,
});

type ItemRow = {
  id: string; price_list_id: string; product_id: string; uom_id: string; min_qty_milli: number; price_paise: number;
  is_inclusive: number; effective_from: string; effective_to: string | null;
};
const toItem = (r: ItemRow): PriceListItem => ({
  id: r.id, priceListId: r.price_list_id, productId: r.product_id, uomId: r.uom_id, minQtyMilli: r.min_qty_milli,
  pricePaise: r.price_paise, isInclusive: r.is_inclusive === 1, effectiveFrom: r.effective_from,
  ...(r.effective_to !== null && { effectiveTo: r.effective_to }),
});
export const toPriceItem = (i: PriceListItem): PriceItem => ({
  uomId: i.uomId, minQtyMilli: i.minQtyMilli, pricePaise: i.pricePaise, isInclusive: i.isInclusive,
  effectiveFrom: i.effectiveFrom, effectiveTo: i.effectiveTo ?? null,
});

export type PriceItemInput = Omit<PriceListItem, 'id' | 'priceListId' | 'productId'>;
const toItemInput = (i: PriceListItem): PriceItemInput => ({
  uomId: i.uomId, minQtyMilli: i.minQtyMilli, pricePaise: i.pricePaise, isInclusive: i.isInclusive, effectiveFrom: i.effectiveFrom,
  ...(i.effectiveTo !== undefined && { effectiveTo: i.effectiveTo }),
});

export function listPriceLists(db: Db, businessId: string): PriceList[] {
  return (db.prepare('SELECT * FROM price_list WHERE business_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, name')
    .all(businessId) as PriceListRow[]).map(toPriceList);
}

export function getPriceList(db: Db, id: string): PriceList | null {
  const r = db.prepare('SELECT * FROM price_list WHERE id = ? AND deleted_at IS NULL').get(id) as PriceListRow | undefined;
  return r ? toPriceList(r) : null;
}

export function getDefaultPriceList(db: Db, businessId: string): PriceList | null {
  const r = stmt(db, 'SELECT * FROM price_list WHERE business_id = ? AND is_default = 1 AND deleted_at IS NULL').get(businessId) as PriceListRow | undefined;
  return r ? toPriceList(r) : null;
}

export function createPriceList(
  db: Db, businessId: string, input: { name: string; kind: PriceList['kind']; isDefault?: boolean }, actor: Actor,
): PriceList {
  return withTransaction(db, () => {
    const id = newUlid();
    const s = syncColumns(actor);
    db.prepare(`INSERT INTO price_list (id, business_id, name, kind, is_default, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, input.name, input.kind, input.isDefault ? 1 : 0, s.t, s.t, s.created_by, s.device_id);
    const list = getPriceList(db, id)!;
    recordChange(db, businessId, actor, { action: 'price_list.create', entityType: 'price_list', entityId: id, operationType: 'create', after: list });
    return list;
  });
}

export function getPriceItems(db: Db, priceListId: string, productId: string): PriceListItem[] {
  return (stmt(db, `SELECT * FROM price_list_item WHERE price_list_id = ? AND product_id = ? AND deleted_at IS NULL
    ORDER BY uom_id, min_qty_milli, effective_from`).all(priceListId, productId) as ItemRow[]).map(toItem);
}

function insertItem(db: Db, businessId: string, priceListId: string, productId: string, item: PriceItemInput, actor: Actor): PriceListItem {
  const id = newUlid();
  const s = syncColumns(actor);
  db.prepare(`INSERT INTO price_list_item (id, business_id, price_list_id, product_id, uom_id, min_qty_milli, price_paise, is_inclusive,
      effective_from, effective_to, created_at, updated_at, created_by, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, businessId, priceListId, productId, item.uomId, item.minQtyMilli, item.pricePaise, item.isInclusive ? 1 : 0,
    item.effectiveFrom, item.effectiveTo ?? null, s.t, s.t, s.created_by, s.device_id,
  );
  return { id, priceListId, productId, ...item };
}

function retireItems(db: Db, ids: readonly string[], t: string): void {
  const retire = db.prepare("UPDATE price_list_item SET deleted_at = ?, updated_at = ?, version = version + 1, sync_state = 'pending' WHERE id = ?");
  for (const id of ids) retire.run(t, t, id);
}

// Replaces every item of one product in one list; the old rows are soft-deleted so sync sees both sides.
export function replacePriceItems(
  db: Db, businessId: string, priceListId: string, productId: string, items: readonly PriceItemInput[], actor: Actor, dependsOn?: string,
): PriceListItem[] {
  return withTransaction(db, () => {
    const before = getPriceItems(db, priceListId, productId);
    const t = syncColumns(actor).t;
    retireItems(db, before.map((i) => i.id), t);
    const after = items.map((i) => insertItem(db, businessId, priceListId, productId, i, actor));
    const payload = { priceListId, productId, items: after, retired: before.map((i) => i.id) };
    if (dependsOn) {
      queueChild(db, businessId, actor, 'price_list_item', productId, 'update', payload, dependsOn);
    } else {
      recordChange(db, businessId, actor, {
        action: 'price_list.set_items', entityType: 'price_list_item', entityId: productId, operationType: 'update', before, after: payload,
      });
    }
    return after;
  });
}

// Effective-dated change of the base-unit, no-break price: close today's predecessor and open a new row from `on`.
export function setBasePrice(
  db: Db, businessId: string, priceListId: string, productId: string,
  price: { uomId: string; pricePaise: number; isInclusive: boolean }, on: string, actor: Actor, dependsOn: string,
): void {
  const items = getPriceItems(db, priceListId, productId);
  const isBase = (i: PriceListItem) =>
    i.uomId === price.uomId && i.minQtyMilli === 0 && i.effectiveFrom <= on && (i.effectiveTo === undefined || i.effectiveTo > on);
  const current = items.filter(isBase);
  if (current.length === 1 && current[0]!.pricePaise === price.pricePaise && current[0]!.isInclusive === price.isInclusive) return;
  const kept = items.filter((i) => !isBase(i));
  const closed = current
    .filter((i) => i.effectiveFrom < on)
    .map((i) => ({ ...toItemInput(i), effectiveTo: on }));
  const opened = { uomId: price.uomId, minQtyMilli: 0, pricePaise: price.pricePaise, isInclusive: price.isInclusive, effectiveFrom: on };
  replacePriceItems(db, businessId, priceListId, productId, [...kept.map(toItemInput), ...closed, opened], actor, dependsOn);
}

export function currentBasePrice(db: Db, priceListId: string, productId: string, uomId: string, on: string): PriceListItem | null {
  const r = stmt(db, `SELECT * FROM price_list_item WHERE price_list_id = ? AND product_id = ? AND uom_id = ? AND min_qty_milli = 0
      AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) AND deleted_at IS NULL
    ORDER BY effective_from DESC LIMIT 1`).get(priceListId, productId, uomId, on, on) as ItemRow | undefined;
  return r ? toItem(r) : null;
}
