import type { Brand, Category, Uom } from '@muneem/contracts';
import {
  createBrand, createCategory, createUom, getBrand, getCategory, listBrands, listCategories, listUoms, updateBrand, updateCategory,
} from '@muneem/db-sqlite';
import type { CatalogContext } from './catalogContext.js';

export class CatalogService {
  constructor(private readonly ctx: CatalogContext, private readonly onChange: () => void) {}

  listUoms(): Uom[] { return listUoms(this.ctx.db(), this.ctx.businessId()); }
  createUom(input: { code: string; name: string; decimals: number }): Uom {
    return createUom(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor());
  }

  listCategories(): Category[] { return listCategories(this.ctx.db(), this.ctx.businessId()); }
  createCategory(input: { name: string; parentId: string | null }): Category {
    return createCategory(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor());
  }
  updateCategory(input: { id: string; version: number; name: string; parentId: string | null }): Category {
    this.assertOwned(getCategory(this.ctx.db(), input.id));
    const c = updateCategory(this.ctx.db(), input.id, input.version, input, this.ctx.actor());
    this.onChange();
    return c;
  }

  listBrands(): Brand[] { return listBrands(this.ctx.db(), this.ctx.businessId()); }
  createBrand(input: { name: string }): Brand {
    return createBrand(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor());
  }
  updateBrand(input: { id: string; version: number; name: string }): Brand {
    this.assertOwned(getBrand(this.ctx.db(), input.id));
    const b = updateBrand(this.ctx.db(), input.id, input.version, input, this.ctx.actor());
    this.onChange();
    return b;
  }

  private assertOwned(row: { businessId: string } | null): void {
    if (!row || row.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
  }
}
