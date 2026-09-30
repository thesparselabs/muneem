import type { Db } from '../open.js';
import { stmt } from '../statements.js';

function searchKey(db: Db, productId: string): number {
  stmt(db, 'INSERT OR IGNORE INTO product_search_key (product_id) VALUES (?)').run(productId);
  return stmt(db, 'SELECT rowid FROM product_search_key WHERE product_id = ?').pluck().get(productId) as number;
}

export function indexProduct(db: Db, productId: string): void {
  const rowid = searchKey(db, productId);
  stmt(db, 'DELETE FROM product_fts WHERE rowid = ?').run(rowid);
  stmt(db, `INSERT INTO product_fts (rowid, product_id, business_id, name, sku, hsn_code, brand_name)
    SELECT ?, p.id, p.business_id, p.name, p.sku, p.hsn_code, b.name
    FROM product p LEFT JOIN brand b ON b.id = p.brand_id
    WHERE p.id = ? AND p.deleted_at IS NULL`).run(rowid, productId);
}

export function reindexBrand(db: Db, brandId: string): void {
  const ids = db.prepare('SELECT id FROM product WHERE brand_id = ? AND deleted_at IS NULL').pluck().all(brandId) as string[];
  for (const id of ids) indexProduct(db, id);
}
