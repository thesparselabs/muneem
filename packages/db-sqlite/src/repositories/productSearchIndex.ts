import type { Db } from '../open.js';
import { stmt } from '../statements.js';

export function indexProduct(db: Db, productId: string): void {
  stmt(db, 'DELETE FROM product_fts WHERE product_id = ?').run(productId);
  stmt(db, `INSERT INTO product_fts (product_id, business_id, name, sku, hsn_code, brand_name)
    SELECT p.id, p.business_id, p.name, p.sku, p.hsn_code, b.name
    FROM product p LEFT JOIN brand b ON b.id = p.brand_id
    WHERE p.id = ? AND p.deleted_at IS NULL`).run(productId);
}

export function reindexBrand(db: Db, brandId: string): void {
  const ids = db.prepare('SELECT id FROM product WHERE brand_id = ? AND deleted_at IS NULL').pluck().all(brandId) as string[];
  for (const id of ids) indexProduct(db, id);
}
