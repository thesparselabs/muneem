import type { Db } from '../open.js';
import { withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { createPriceList, getDefaultPriceList } from './priceList.js';
import { createUom, findUomByCode } from './uom.js';

export const DEFAULT_UOMS = [
  { code: 'PCS', name: 'Pieces', decimals: 0 },
  { code: 'KG', name: 'Kilogram', decimals: 3 },
  { code: 'G', name: 'Gram', decimals: 0 },
  { code: 'L', name: 'Litre', decimals: 3 },
  { code: 'ML', name: 'Millilitre', decimals: 0 },
  { code: 'M', name: 'Metre', decimals: 3 },
  { code: 'DOZ', name: 'Dozen', decimals: 0 },
  { code: 'BOX', name: 'Box', decimals: 0 },
  { code: 'CASE', name: 'Case', decimals: 0 },
] as const;

export function ensureCatalogDefaults(db: Db, businessId: string, actor: Actor): void {
  withTransaction(db, () => {
    for (const u of DEFAULT_UOMS) if (!findUomByCode(db, businessId, u.code)) createUom(db, businessId, u, actor);
    if (!getDefaultPriceList(db, businessId)) createPriceList(db, businessId, { name: 'Retail', kind: 'retail', isDefault: true }, actor);
  });
}
