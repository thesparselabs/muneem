import { AppError, type PriceList, type PriceListItem, type SetPriceItems } from '@muneem/contracts';
import { exceedsMrp } from '@muneem/domain';
import { createPriceList, getPriceItems, getPriceList, getProduct, listPriceLists, replacePriceItems } from '@muneem/db-sqlite';
import type { CatalogContext } from './catalogContext.js';

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
    const mrp = this.assertOwned(input.priceListId, input.productId);
    const fields = Object.fromEntries(input.items.flatMap((item, i) =>
      exceedsMrp(item.pricePaise, item.isInclusive, mrp) ? [[`items.${i}.pricePaise`, 'price is above MRP']] : []));
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Some prices are above MRP', fields);
    const items = replacePriceItems(this.ctx.db(), this.ctx.businessId(), input.priceListId, input.productId, input.items, this.ctx.actor());
    this.onChange();
    return items;
  }

  private assertOwned(priceListId: string, productId: string): number | undefined {
    const businessId = this.ctx.businessId();
    const list = getPriceList(this.ctx.db(), priceListId);
    const product = getProduct(this.ctx.db(), productId, this.ctx.today());
    if (list?.businessId !== businessId || product?.businessId !== businessId) throw new Error('NOT_FOUND');
    return product.mrpPaise;
  }
}
