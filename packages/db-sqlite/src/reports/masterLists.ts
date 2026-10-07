import type { ProductHit } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { listProductHits } from '../repositories/productQuery.js';
import { inRange, rangeParams, type ReportRange } from './range.js';

export interface ProductMasterRow extends ProductHit { purchasePricePaise: number | null; reorderLevelMilli: number | null; barcodes: string | null }

// The whole catalogue with the default-list price, shaped like the product import so an export can be edited and re-imported.
export function productMaster(db: Db, businessId: string, on: string, limit: number): ProductMasterRow[] {
  const extras = new Map((stmt(db, `SELECT p.id, p.purchase_price_paise AS purchasePricePaise, p.reorder_level_milli AS reorderLevelMilli,
      (SELECT group_concat(code, ';') FROM barcode WHERE product_id = p.id AND deleted_at IS NULL) AS barcodes
    FROM product p WHERE p.business_id = ? AND p.deleted_at IS NULL`).all(businessId) as { id: string; purchasePricePaise: number | null; reorderLevelMilli: number | null; barcodes: string | null }[])
    .map((r) => [r.id, r]));
  return listProductHits(db, businessId, { limit, includeInactive: true }, on).items.map((h) => {
    const x = extras.get(h.productId);
    return { ...h, purchasePricePaise: x?.purchasePricePaise ?? null, reorderLevelMilli: x?.reorderLevelMilli ?? null, barcodes: x?.barcodes ?? null };
  });
}

export interface PartyMasterRow {
  name: string; phone: string | null; email: string | null; gstin: string | null; stateCode: string | null; addressLine1: string | null;
  city: string | null; pinCode: string | null; creditDays: number; creditLimitPaise: number | null; taxScheme: string | null;
}

const PARTY_COLUMNS = `name, phone, email, gstin, state_code AS stateCode, address_line1 AS addressLine1, city, pin_code AS pinCode, credit_days AS creditDays`;

export function customerMaster(db: Db, businessId: string): PartyMasterRow[] {
  return stmt(db, `SELECT ${PARTY_COLUMNS}, credit_limit_paise AS creditLimitPaise, NULL AS taxScheme FROM customer
    WHERE business_id = ? AND deleted_at IS NULL AND erased_at IS NULL ORDER BY name_norm, id`).all(businessId) as PartyMasterRow[];
}

export function supplierMaster(db: Db, businessId: string): PartyMasterRow[] {
  return stmt(db, `SELECT ${PARTY_COLUMNS}, NULL AS creditLimitPaise, tax_scheme AS taxScheme FROM supplier
    WHERE business_id = ? AND deleted_at IS NULL ORDER BY name_norm, id`).all(businessId) as PartyMasterRow[];
}

export interface SalesRegisterRow {
  docDate: string; docNumber: string; customerName: string | null; customerGstin: string | null; status: string;
  taxablePaise: number; taxPaise: number; totalPaise: number; paidPaise: number; creditPaise: number;
}

// One row per invoice; a cancelled invoice is listed but adds nothing to the totals.
export function salesRegister(db: Db, r: ReportRange): SalesRegisterRow[] {
  return stmt(db, `SELECT x.doc_date AS docDate, x.doc_number AS docNumber, json_extract(x.customer_snapshot_json, '$.name') AS customerName,
      json_extract(x.customer_snapshot_json, '$.gstin') AS customerGstin, x.status,
      CASE x.status WHEN 'posted' THEN x.taxable_paise ELSE 0 END AS taxablePaise,
      CASE x.status WHEN 'posted' THEN x.cgst_paise + x.sgst_paise + x.igst_paise + x.cess_paise ELSE 0 END AS taxPaise,
      CASE x.status WHEN 'posted' THEN x.total_paise ELSE 0 END AS totalPaise,
      CASE x.status WHEN 'posted' THEN x.paid_paise - x.change_paise ELSE 0 END AS paidPaise,
      CASE x.status WHEN 'posted' THEN x.credit_paise ELSE 0 END AS creditPaise
    FROM sale x WHERE ${inRange('x')} ORDER BY x.doc_date, x.doc_number`).all(rangeParams(r)) as SalesRegisterRow[];
}
