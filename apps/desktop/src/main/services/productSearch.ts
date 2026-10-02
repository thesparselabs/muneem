import type { ProductHit, ProductSearchInput } from '@muneem/contracts';
import { normalizeName } from '@muneem/domain';
import { defaultWarehouseId, hitByBarcode, hitBySku, hitsByNamePrefix, hitsByText, stockOnHand } from '@muneem/db-sqlite';
import type { CatalogContext } from './catalogContext.js';
import { Lru } from './lru.js';

const BARCODE_CACHE_SIZE = 500;
const SINGLE_TOKEN = /^\S+$/u;

// Scan path first (exact barcode, exact SKU), then what cashiers type (name prefix), then word matches to fill.
export class ProductSearch {
  private readonly barcodeCache = new Lru<string, ProductHit>(BARCODE_CACHE_SIZE);
  constructor(private readonly ctx: CatalogContext) {}

  invalidate(): void { this.barcodeCache.clear(); }

  // On hand in this branch's warehouse, the same stock sale warnings use; read fresh, never cached.
  withStock<T extends ProductHit>(hits: T[]): T[] {
    const branchId = this.ctx.branchId();
    const warehouseId = branchId ? defaultWarehouseId(this.ctx.db(), branchId) : null;
    return hits.map((h) => ({ ...h, stockMilli: stockOnHand(this.ctx.db(), this.ctx.businessId(), warehouseId, h.productId) }));
  }

  lookupBarcode(code: string): ProductHit | null {
    const businessId = this.ctx.businessId();
    const on = this.ctx.today();
    const key = `${businessId}|${on}|${code}`;
    const cached = this.barcodeCache.get(key);
    if (cached) return this.withStock([cached])[0]!;
    const hit = hitByBarcode(this.ctx.db(), businessId, code, on);
    if (!hit) return null;
    this.barcodeCache.set(key, hit);
    return this.withStock([hit])[0]!;
  }

  search(input: ProductSearchInput): ProductHit[] {
    const query = input.query.trim();
    if (!query) return [];
    const exact = this.exactMatch(query, input.mode);
    if (exact || input.mode === 'barcode' || input.mode === 'sku') return exact ? [exact] : [];
    return this.withStock(this.byName(query, input.limit));
  }

  private exactMatch(query: string, mode: ProductSearchInput['mode']): ProductHit | null {
    if (mode === 'name' || !SINGLE_TOKEN.test(query)) return null;
    if (mode !== 'sku') {
      const hit = this.lookupBarcode(query);
      if (hit || mode === 'barcode') return hit;
    }
    const bySku = hitBySku(this.ctx.db(), this.ctx.businessId(), query, this.ctx.today());
    return bySku ? this.withStock([bySku])[0]! : null;
  }

  private byName(query: string, limit: number): ProductHit[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const on = this.ctx.today();
    const hits = hitsByNamePrefix(db, businessId, normalizeName(query), limit, on);
    if (hits.length >= limit) return hits;
    const seen = new Set(hits.map((h) => h.productId));
    for (const h of hitsByText(db, businessId, query, limit, on)) {
      if (hits.length >= limit) break;
      if (!seen.has(h.productId)) hits.push(h);
    }
    return hits;
  }
}
