import type { ImportField, ImportMapping } from '@muneem/contracts';

const ALIASES: Record<ImportField, readonly string[]> = {
  name: ['name', 'productname', 'itemname', 'item', 'product', 'description'],
  sku: ['sku', 'itemcode', 'productcode', 'code'],
  barcodes: ['barcode', 'barcodes', 'ean', 'upc', 'gtin'],
  hsnCode: ['hsn', 'hsncode', 'hsnsac', 'sac'],
  category: ['category', 'group', 'itemgroup'],
  brand: ['brand', 'make', 'company'],
  uom: ['uom', 'unit', 'units'],
  mrp: ['mrp', 'maxretailprice'],
  sellingPrice: ['sellingprice', 'saleprice', 'price', 'rate', 'sp'],
  purchasePrice: ['purchaseprice', 'costprice', 'cost', 'pp'],
  gstRate: ['gst', 'gstrate', 'gstpercent', 'tax', 'taxrate'],
  reorderLevel: ['reorderlevel', 'reorder', 'minstock', 'minimumstock'],
};

const key = (header: string): string => header.toLowerCase().replace(/[^a-z0-9]/gu, '');

export function suggestFrom<F extends string>(columns: readonly string[], aliases: Readonly<Record<F, readonly string[]>>): Partial<Record<F, number>> {
  const mapping: Partial<Record<F, number>> = {};
  const keys = columns.map(key);
  for (const [field, names] of Object.entries(aliases) as [F, readonly string[]][]) {
    const index = names.map((a) => keys.indexOf(a)).find((i) => i >= 0);
    if (index !== undefined && !Object.values(mapping).includes(index)) mapping[field] = index;
  }
  return mapping;
}

export const suggestMapping = (columns: readonly string[]): ImportMapping => suggestFrom(columns, ALIASES);
