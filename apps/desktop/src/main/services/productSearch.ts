import type { ProductHit, ProductSearchInput } from '@muneem/contracts';
import { normalizeName } from '@muneem/domain';
import { hitByBarcode, hitBySku, hitsByNamePrefix, hitsByText, stockOnHand } from '@muneem/db-sqlite';
import type { CatalogContext } from './catalogContext.js';
import { Lru } from './lru.js';

const BARCODE_CACHE_SIZE = 500;
const SINGLE_TOKEN = /^\S+$/u;

// Scan path first (exact barcode, exact SKU), then what cashiers type (name prefix), then word matches to fill.
export class ProductSearch {
  private readonly barcodeCache = new Lru<string, ProductHit>(BARCODE_CACHE_SIZE);
  constructor(private readonly ctx: CatalogContext) {}

  invalidate(): void { this.barcodeCache.clear(); }

  lookupBarcode(code: string): ProductHit | null {
    const businessId = this.ctx.businessId();
    const on = this.ctx.today();
    const key = `${businessId}|${on}|${code}`;
    const cached = this.barcodeCache.get(key);
    // Stock changes with every sale, so a cached hit keeps its product and price but always reads stock afresh.
    if (cached) return { ...cached, stockMilli: stockOnHand(this.ctx.db(), businessId, cached.productId) };
    const hit = hitByBarcode(this.ctx.db(), businessId, code, on);
    if (hit) this.barcodeCache.set(key, hit);
    return hit;
  }

  search(input: ProductSearchInput): ProductHit[] {
    const query = input.query.trim();
    if (!query) return [];
    const exact = this.exactMatch(query, input.mode);
    if (exact || input.mode === 'barcode' || input.mode === 'sku') return exact ? [exact] : [];
    return this.byName(query, input.limit);
  }

  private exactMatch(query: string, mode: ProductSearchInput['mode']): ProductHit | null {
    if (mode === 'name' || !SINGLE_TOKEN.test(query)) return null;
    if (mode !== 'sku') {
      const hit = this.lookupBarcode(query);
      if (hit || mode === 'barcode') return hit;
    }
    return hitBySku(this.ctx.db(), this.ctx.businessId(), query, this.ctx.today());
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
