import type { Product } from '@muneem/contracts';
import { normalizeName } from '@muneem/domain';
import {
  createBrand, createCategory, createUom, findProductIdByBarcode, findProductIdBySku, getProduct, listBrands, listCategories, listUoms,
  type Actor, type Db,
} from '@muneem/db-sqlite';
import type { CatalogLookup } from './importPlanner.js';

export class DbCatalogLookup implements CatalogLookup {
  private readonly uoms: Map<string, string>;
  private readonly categories: Map<string, string>;
  private readonly brands: Map<string, string>;
  readonly created = { categories: 0, brands: 0, uoms: 0 };

  constructor(private readonly db: Db, private readonly businessId: string, private readonly on: string) {
    this.uoms = new Map(listUoms(db, businessId).map((u) => [u.code, u.id]));
    this.categories = new Map(listCategories(db, businessId).filter((c) => c.parentId === null).map((c) => [normalizeName(c.name), c.id]));
    this.brands = new Map(listBrands(db, businessId).map((b) => [normalizeName(b.name), b.id]));
  }

  uomId(code: string) { return this.uoms.get(code); }
  categoryId(name: string) { return this.categories.get(normalizeName(name)); }
  brandId(name: string) { return this.brands.get(normalizeName(name)); }
  productBySku(sku: string) { return findProductIdBySku(this.db, this.businessId, sku) ?? undefined; }
  productByBarcode(code: string) { return findProductIdByBarcode(this.db, this.businessId, code) ?? undefined; }
  product(id: string): Product | undefined { return getProduct(this.db, id, this.on) ?? undefined; }

  ensureUom(code: string, actor: Actor): string {
    return this.uomId(code) ?? this.remember(this.uoms, code, createUom(this.db, this.businessId, { code, name: code, decimals: 0 }, actor).id, 'uoms');
  }

  ensureCategory(name: string | undefined, actor: Actor): string | undefined {
    if (!name) return undefined;
    return this.categoryId(name)
      ?? this.remember(this.categories, normalizeName(name), createCategory(this.db, this.businessId, { name, parentId: null }, actor).id, 'categories');
  }

  ensureBrand(name: string | undefined, actor: Actor): string | undefined {
    if (!name) return undefined;
    return this.brandId(name) ?? this.remember(this.brands, normalizeName(name), createBrand(this.db, this.businessId, { name }, actor).id, 'brands');
  }

  private remember(map: Map<string, string>, key: string, id: string, counter: keyof DbCatalogLookup['created']): string {
    map.set(key, id);
    this.created[counter]++;
    return id;
  }
}
