import { AppError, type PriceList, type PriceListItem, type Product, type SetPriceItems } from '@muneem/contracts';
import { exceedsMrp, mrpForUnit } from '@muneem/domain';
import { createPriceList, getPriceItems, getPriceList, getProduct, listPriceLists, listUoms, replacePriceItems } from '@muneem/db-sqlite';
import type { CatalogContext } from './catalogContext.js';

const rupees = (paise: number): string => `₹${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;

export class PricingService {
  constructor(private readonly ctx: CatalogContext, private readonly onChange: () => void) {}

  listLists(): PriceList[] { return listPriceLists(this.ctx.db(), this.ctx.businessId()); }
  createList(input: { name: string; kind: PriceList['kind'] }): PriceList {
    return createPriceList(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor());
  }

  getItems(input: { priceListId: string; productId: string }): PriceListItem[] {
    this.assertOwned(input.priceListId, input.productId);
    return getPriceItems(this.ctx.db(), input.priceListId, input.productId);
  }

  setItems(input: SetPriceItems): PriceListItem[] {
    const product = this.assertOwned(input.priceListId, input.productId);
    const fields = this.unitPriceErrors(product, input.items);
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Some prices cannot be saved', fields);
    const items = replacePriceItems(this.ctx.db(), this.ctx.businessId(), input.priceListId, input.productId, input.items, this.ctx.actor());
    this.onChange();
    return items;
  }

  // A pack's ceiling is the base-unit MRP times the pack size; a unit without a conversion cannot be priced at all.
  private unitPriceErrors(product: Product, items: SetPriceItems['items']): Record<string, string> {
    const codes = new Map(listUoms(this.ctx.db(), product.businessId).map((u) => [u.id, u.code]));
    const factors = new Map([[product.baseUomId, 1000], ...product.conversions.map((c) => [c.fromUomId, c.factorMilli] as const)]);
    const errors: Record<string, string> = {};
    items.forEach((item, i) => {
      const factor = factors.get(item.uomId);
      if (factor === undefined) {
        errors[`items.${i}.uomId`] = 'add a conversion for this unit on the product first';
        return;
      }
      if (product.mrpPaise === undefined) return;
      const ceiling = mrpForUnit(product.mrpPaise, factor);
      if (exceedsMrp(item.pricePaise, item.isInclusive, ceiling)) {
        errors[`items.${i}.pricePaise`] = `price is above MRP (${rupees(ceiling)} per ${codes.get(item.uomId) ?? 'unit'})`;
      }
    });
    return errors;
  }

  private assertOwned(priceListId: string, productId: string): Product {
    const businessId = this.ctx.businessId();
    const list = getPriceList(this.ctx.db(), priceListId);
    const product = getProduct(this.ctx.db(), productId, this.ctx.today());
    if (list?.businessId !== businessId || !product || product.businessId !== businessId) throw new Error('NOT_FOUND');
    return product;
  }
}
