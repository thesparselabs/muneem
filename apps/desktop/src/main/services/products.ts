import type { Product, ProductHit, ProductInput, ProductListInput, ProductPage, ProductSearchInput, ProductUpdate } from '@muneem/contracts';
import { createProduct, getProduct, listProductHits, setProductActive, updateProduct } from '@muneem/db-sqlite';
import type { CatalogContext } from './catalogContext.js';
import type { ProductSearch } from './productSearch.js';

export class ProductService {
  constructor(private readonly ctx: CatalogContext, private readonly searcher: ProductSearch) {}

  search(input: ProductSearchInput): ProductHit[] { return this.searcher.search(input); }
  lookupBarcode(code: string): ProductHit | null { return this.searcher.lookupBarcode(code); }
  list(input: ProductListInput): ProductPage {
    const page = listProductHits(this.ctx.db(), this.ctx.businessId(), input, this.ctx.today());
    return { ...page, items: this.searcher.withStock(page.items) };
  }

  get(id: string): Product {
    const p = getProduct(this.ctx.db(), id, this.ctx.today());
    if (!p || p.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return p;
  }

  create(input: ProductInput): Product {
    return this.changed(createProduct(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor(), this.ctx.today()));
  }

  update(input: ProductUpdate): Product {
    this.get(input.id);
    return this.changed(updateProduct(this.ctx.db(), input, this.ctx.actor(), this.ctx.today()));
  }

  setActive(id: string, version: number, active: boolean): Product {
    this.get(id);
    return this.changed(setProductActive(this.ctx.db(), id, version, active, this.ctx.actor(), this.ctx.today()));
  }

  private changed(p: Product): Product {
    this.searcher.invalidate();
    return p;
  }
}
