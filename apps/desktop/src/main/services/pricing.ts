import { AppError, type PriceList, type PriceListItem, type Product, type SetPriceItems } from '@muneem/contracts';
import {
  createPriceList, getPriceItems, getPriceList, getProduct, listPriceLists, listUoms, replacePriceItems, rupees, unitPriceProblems,
} from '@muneem/db-sqlite';
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
    const product = this.assertOwned(input.priceListId, input.productId);
    const fields = this.unitPriceErrors(product, input.items);
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Some prices cannot be saved', fields);
    const items = replacePriceItems(this.ctx.db(), this.ctx.businessId(), input.priceListId, input.productId, input.items, this.ctx.actor());
    this.onChange();
    return items;
  }

  private unitPriceErrors(product: Product, items: SetPriceItems['items']): Record<string, string> {
    const codes = new Map(listUoms(this.ctx.db(), product.businessId).map((u) => [u.id, u.code]));
    return Object.fromEntries(unitPriceProblems(product, items).map((p) => p.kind === 'no_conversion'
      ? [`items.${p.index}.uomId`, 'add a conversion for this unit on the product first']
      : [`items.${p.index}.pricePaise`, `price is above MRP (${rupees(p.ceilingPaise)} per ${codes.get(items[p.index]!.uomId) ?? 'unit'})`]));
  }

  private assertOwned(priceListId: string, productId: string): Product {
    const businessId = this.ctx.businessId();
    const list = getPriceList(this.ctx.db(), priceListId);
    const product = getProduct(this.ctx.db(), productId, this.ctx.today());
    if (list?.businessId !== businessId || !product || product.businessId !== businessId) throw new Error('NOT_FOUND');
    return product;
  }
}
