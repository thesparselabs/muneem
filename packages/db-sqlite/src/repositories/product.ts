import { AppError, type Barcode, type Product, type ProductInput, type ProductUpdate, type UomConversion } from '@muneem/contracts';
import { newUlid, normalizeName } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { queueChild, recordChange, syncColumns } from './catalogWrite.js';
import { currentBasePrice, getDefaultPriceList, setBasePrice } from './priceList.js';
import { indexProduct } from './productSearchIndex.js';
import { productFieldErrors, resolvedSymbology } from './productRules.js';

type ProductRow = {
  id: string; business_id: string; name: string; sku: string | null; hsn_code: string | null; category_id: string | null;
  brand_id: string | null; base_uom_id: string; tax_treatment: Product['taxTreatment']; gst_rate_bp: number; cess_rate_bp: number;
  cess_per_unit_paise: number; price_is_inclusive: number; mrp_paise: number | null; purchase_price_paise: number | null;
  allow_negative_stock: number | null; reorder_level_milli: number | null; is_active: number;
  created_at: string; updated_at: string; version: number;
};
type BarcodeRow = { id: string; code: string; symbology: Barcode['symbology']; uom_id: string | null; pack_qty_milli: number; is_primary: number };
type ConversionRow = { id: string; from_uom_id: string; to_uom_id: string; factor_milli: number };

const toBarcode = (r: BarcodeRow): Barcode => ({
  id: r.id, code: r.code, symbology: r.symbology, uomId: r.uom_id, packQtyMilli: r.pack_qty_milli, isPrimary: r.is_primary === 1,
});
const toConversion = (r: ConversionRow): UomConversion => ({ id: r.id, fromUomId: r.from_uom_id, toUomId: r.to_uom_id, factorMilli: r.factor_milli });

function listBarcodes(db: Db, productId: string): Barcode[] {
  return (stmt(db, 'SELECT * FROM barcode WHERE product_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, code').all(productId) as BarcodeRow[]).map(toBarcode);
}

export function listConversions(db: Db, productId: string): UomConversion[] {
  return (stmt(db, 'SELECT * FROM uom_conversion WHERE product_id = ? AND deleted_at IS NULL ORDER BY from_uom_id').all(productId) as ConversionRow[]).map(toConversion);
}

export function getProduct(db: Db, id: string, on: string): Product | null {
  const r = stmt(db, 'SELECT * FROM product WHERE id = ? AND deleted_at IS NULL').get(id) as ProductRow | undefined;
  if (!r) return null;
  const list = getDefaultPriceList(db, r.business_id);
  const price = list ? currentBasePrice(db, list.id, r.id, r.base_uom_id, on) : null;
  return {
    id: r.id, businessId: r.business_id, name: r.name, baseUomId: r.base_uom_id, taxTreatment: r.tax_treatment,
    gstRateBp: r.gst_rate_bp, cessRateBp: r.cess_rate_bp, cessPerUnitPaise: r.cess_per_unit_paise,
    priceIsInclusive: r.price_is_inclusive === 1, isActive: r.is_active === 1,
    barcodes: listBarcodes(db, r.id), conversions: listConversions(db, r.id),
    createdAt: r.created_at, updatedAt: r.updated_at, version: r.version,
    ...(r.sku !== null && { sku: r.sku }),
    ...(r.hsn_code !== null && { hsnCode: r.hsn_code }),
    ...(r.category_id !== null && { categoryId: r.category_id }),
    ...(r.brand_id !== null && { brandId: r.brand_id }),
    ...(r.mrp_paise !== null && { mrpPaise: r.mrp_paise }),
    ...(r.purchase_price_paise !== null && { purchasePricePaise: r.purchase_price_paise }),
    ...(price && { sellingPricePaise: price.pricePaise }),
    ...(r.reorder_level_milli !== null && { reorderLevelMilli: r.reorder_level_milli }),
    ...(r.allow_negative_stock !== null && { allowNegativeStock: r.allow_negative_stock === 1 }),
  };
}

export function findProductIdBySku(db: Db, businessId: string, sku: string): string | null {
  return (stmt(db, 'SELECT id FROM product WHERE business_id = ? AND sku = ? AND deleted_at IS NULL').pluck().get(businessId, sku) as string | undefined) ?? null;
}

export function findProductIdByBarcode(db: Db, businessId: string, code: string): string | null {
  return (stmt(db, 'SELECT product_id FROM barcode WHERE business_id = ? AND code = ? AND deleted_at IS NULL').pluck().get(businessId, code) as string | undefined) ?? null;
}

function assertValid(input: ProductInput): void {
  const fields = productFieldErrors(input);
  if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Product has invalid fields', fields);
}

function assertBarcodesFree(db: Db, businessId: string, input: ProductInput, productId: string | null): void {
  for (const [i, b] of input.barcodes.entries()) {
    const owner = findProductIdByBarcode(db, businessId, b.code);
    if (owner && owner !== productId) {
      throw new AppError('ALREADY_EXISTS', `Barcode ${b.code} belongs to another product`, { [`barcodes.${i}.code`]: 'already used' });
    }
  }
}

const productColumns = (input: ProductInput) => ({
  name: input.name, name_norm: normalizeName(input.name), sku: input.sku ?? null, hsn_code: input.hsnCode ?? null,
  category_id: input.categoryId ?? null, brand_id: input.brandId ?? null, base_uom_id: input.baseUomId,
  tax_treatment: input.taxTreatment, gst_rate_bp: input.gstRateBp, cess_rate_bp: input.cessRateBp,
  cess_per_unit_paise: input.cessPerUnitPaise, price_is_inclusive: input.priceIsInclusive ? 1 : 0,
  mrp_paise: input.mrpPaise ?? null, purchase_price_paise: input.purchasePricePaise ?? null,
  allow_negative_stock: input.allowNegativeStock === undefined ? null : input.allowNegativeStock ? 1 : 0,
  reorder_level_milli: input.reorderLevelMilli ?? null,
});

function insertBarcode(db: Db, businessId: string, productId: string, b: ProductInput['barcodes'][number], isPrimary: boolean, actor: Actor): Barcode {
  const id = newUlid();
  const s = syncColumns(actor);
  const symbology = resolvedSymbology(b);
  stmt(db, `INSERT INTO barcode (id, business_id, product_id, code, symbology, uom_id, pack_qty_milli, is_primary, created_at, updated_at, created_by, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, productId, b.code, symbology, b.uomId, b.packQtyMilli, isPrimary ? 1 : 0, s.t, s.t, s.created_by, s.device_id);
  return { id, code: b.code, symbology, uomId: b.uomId, packQtyMilli: b.packQtyMilli, isPrimary };
}

function insertConversion(db: Db, businessId: string, productId: string, baseUomId: string, c: ProductInput['conversions'][number], actor: Actor): UomConversion {
  const id = newUlid();
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO uom_conversion (id, business_id, product_id, from_uom_id, to_uom_id, factor_milli, created_at, updated_at, created_by, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, productId, c.fromUomId, baseUomId, c.factorMilli, s.t, s.t, s.created_by, s.device_id);
  return { id, fromUomId: c.fromUomId, toUomId: baseUomId, factorMilli: c.factorMilli };
}

const primaryIndex = (barcodes: ProductInput['barcodes']): number => Math.max(0, barcodes.findIndex((b) => b.isPrimary));

function applySellingPrice(db: Db, businessId: string, productId: string, input: ProductInput, on: string, actor: Actor, dependsOn: string): void {
  if (input.sellingPricePaise === undefined) return;
  const list = getDefaultPriceList(db, businessId);
  if (!list) throw new AppError('INVALID_STATE', 'The business has no default price list');
  setBasePrice(db, businessId, list.id, productId,
    { uomId: input.baseUomId, pricePaise: input.sellingPricePaise, isInclusive: input.priceIsInclusive }, on, actor, dependsOn);
}

export function createProduct(db: Db, businessId: string, input: ProductInput, actor: Actor, on: string): Product {
  assertValid(input);
  return withTransaction(db, () => {
    assertBarcodesFree(db, businessId, input, null);
    const id = newUlid();
    const s = syncColumns(actor);
    stmt(db, `INSERT INTO product (id, business_id, name, name_norm, sku, hsn_code, category_id, brand_id, base_uom_id, tax_treatment,
        gst_rate_bp, cess_rate_bp, cess_per_unit_paise, price_is_inclusive, mrp_paise, purchase_price_paise, allow_negative_stock,
        reorder_level_milli, created_at, updated_at, created_by, device_id)
      VALUES (@id, @business_id, @name, @name_norm, @sku, @hsn_code, @category_id, @brand_id, @base_uom_id, @tax_treatment,
        @gst_rate_bp, @cess_rate_bp, @cess_per_unit_paise, @price_is_inclusive, @mrp_paise, @purchase_price_paise, @allow_negative_stock,
        @reorder_level_milli, @t, @t, @created_by, @device_id)`).run({ id, business_id: businessId, ...productColumns(input), ...s });
    const primary = primaryIndex(input.barcodes);
    const barcodes = input.barcodes.map((b, i) => insertBarcode(db, businessId, id, b, i === primary, actor));
    const conversions = input.conversions.map((c) => insertConversion(db, businessId, id, input.baseUomId, c, actor));
    const root = recordChange(db, businessId, actor, {
      action: 'product.create', entityType: 'product', entityId: id, operationType: 'create',
      after: { ...productColumns(input), id, barcodes, conversions, sellingPricePaise: input.sellingPricePaise ?? null },
    });
    for (const b of barcodes) queueChild(db, businessId, actor, 'barcode', b.id, 'create', { productId: id, ...b }, root);
    for (const c of conversions) queueChild(db, businessId, actor, 'uom_conversion', c.id, 'create', { productId: id, ...c }, root);
    applySellingPrice(db, businessId, id, input, on, actor, root);
    indexProduct(db, id);
    return getProduct(db, id, on)!;
  });
}

function retire(db: Db, table: 'barcode' | 'uom_conversion', id: string, t: string): void {
  stmt(db, `UPDATE ${table} SET deleted_at = ?, updated_at = ?, version = version + 1, sync_state = 'pending' WHERE id = ?`).run(t, t, id);
}

function syncBarcodes(db: Db, before: Product, input: ProductInput, actor: Actor, root: string): void {
  const t = nowIso();
  const wanted = new Map(input.barcodes.map((b, i) => [b.code, { b, isPrimary: i === primaryIndex(input.barcodes) }]));
  for (const old of before.barcodes) {
    const next = wanted.get(old.code);
    const unchanged = next && next.b.uomId === old.uomId && next.b.packQtyMilli === old.packQtyMilli && next.isPrimary === old.isPrimary
      && resolvedSymbology(next.b) === old.symbology;
    if (unchanged) {
      wanted.delete(old.code);
      continue;
    }
    retire(db, 'barcode', old.id, t);
    queueChild(db, before.businessId, actor, 'barcode', old.id, 'void', { productId: before.id, id: old.id }, root);
  }
  for (const { b, isPrimary } of wanted.values()) {
    const created = insertBarcode(db, before.businessId, before.id, b, isPrimary, actor);
    queueChild(db, before.businessId, actor, 'barcode', created.id, 'create', { productId: before.id, ...created }, root);
  }
}

function syncConversions(db: Db, before: Product, input: ProductInput, actor: Actor, root: string): void {
  const t = nowIso();
  const wanted = new Map(input.conversions.map((c) => [c.fromUomId, c]));
  for (const old of before.conversions) {
    const next = wanted.get(old.fromUomId);
    if (next && next.factorMilli === old.factorMilli && old.toUomId === input.baseUomId) {
      wanted.delete(old.fromUomId);
      continue;
    }
    retire(db, 'uom_conversion', old.id, t);
    queueChild(db, before.businessId, actor, 'uom_conversion', old.id, 'void', { productId: before.id, id: old.id }, root);
  }
  for (const c of wanted.values()) {
    const created = insertConversion(db, before.businessId, before.id, input.baseUomId, c, actor);
    queueChild(db, before.businessId, actor, 'uom_conversion', created.id, 'create', { productId: before.id, ...created }, root);
  }
}

export function updateProduct(db: Db, input: ProductUpdate, actor: Actor, on: string): Product {
  assertValid(input);
  return withTransaction(db, () => {
    const before = getProduct(db, input.id, on);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== input.version) throw new Error('VERSION_CONFLICT');
    assertBarcodesFree(db, before.businessId, input, before.id);
    stmt(db, `UPDATE product SET name=@name, name_norm=@name_norm, sku=@sku, hsn_code=@hsn_code, category_id=@category_id, brand_id=@brand_id,
        base_uom_id=@base_uom_id, tax_treatment=@tax_treatment, gst_rate_bp=@gst_rate_bp, cess_rate_bp=@cess_rate_bp,
        cess_per_unit_paise=@cess_per_unit_paise, price_is_inclusive=@price_is_inclusive, mrp_paise=@mrp_paise,
        purchase_price_paise=@purchase_price_paise, allow_negative_stock=@allow_negative_stock, reorder_level_milli=@reorder_level_milli,
        updated_at=@t, version=version+1, sync_state='pending'
      WHERE id=@id AND version=@v`).run({ id: input.id, v: input.version, t: nowIso(), ...productColumns(input) });
    const root = recordChange(db, before.businessId, actor, {
      action: 'product.update', entityType: 'product', entityId: before.id, operationType: 'update', before,
      after: { ...productColumns(input), id: before.id, barcodes: input.barcodes, conversions: input.conversions, sellingPricePaise: input.sellingPricePaise ?? null },
    });
    syncBarcodes(db, before, input, actor, root);
    syncConversions(db, before, input, actor, root);
    applySellingPrice(db, before.businessId, before.id, input, on, actor, root);
    indexProduct(db, before.id);
    return getProduct(db, before.id, on)!;
  });
}

export function setProductActive(db: Db, id: string, expectedVersion: number, active: boolean, actor: Actor, on: string): Product {
  return withTransaction(db, () => {
    const before = getProduct(db, id, on);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    stmt(db, "UPDATE product SET is_active = ?, updated_at = ?, version = version + 1, sync_state = 'pending' WHERE id = ? AND version = ?")
      .run(active ? 1 : 0, nowIso(), id, expectedVersion);
    const after = getProduct(db, id, on)!;
    recordChange(db, before.businessId, actor, {
      action: active ? 'product.reactivate' : 'product.deactivate', entityType: 'product', entityId: id, operationType: 'update',
      before: { isActive: before.isActive }, after: { id, isActive: active },
    });
    return after;
  });
}
