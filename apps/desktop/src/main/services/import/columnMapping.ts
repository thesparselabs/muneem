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

export function suggestMapping(columns: readonly string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const keys = columns.map(key);
  for (const [field, aliases] of Object.entries(ALIASES) as [ImportField, readonly string[]][]) {
    const index = aliases.map((a) => keys.indexOf(a)).find((i) => i >= 0);
    if (index !== undefined && !Object.values(mapping).includes(index)) mapping[field] = index;
  }
  return mapping;
}
