import { ProductInput, type ImportField, type ImportMapping, type Product } from '@muneem/contracts';
import { formatRupees as rupees, normalizeName } from '@muneem/domain';
import { productFieldErrors, unitPriceProblems, type LivePriceItem } from '@muneem/db-sqlite';
import { mergeForUpdate } from './productMerge.js';
import { parseRow, type RowDraft, type RowErrors } from './rowParser.js';
import type { Table } from './tableReader.js';

export interface CatalogLookup {
  uomId(code: string): string | undefined;
  categoryId(name: string): string | undefined;
  brandId(name: string): string | undefined;
  productBySku(sku: string): string | undefined;
  productByBarcode(code: string): string | undefined;
  product(id: string): Product | undefined;
  livePrices(productId: string): LivePriceItem[];
}

// For a duplicate, `errors` lists why updating the existing product with this row would be refused.
export interface PlannedRow { line: number; status: 'ok' | 'error' | 'duplicate'; draft: RowDraft; errors: RowErrors; existingProductId?: string }
export interface ImportPlan { rows: PlannedRow[]; willCreate: { categories: string[]; brands: string[]; uoms: string[] } }

export interface Refs { baseUomId: string; categoryId?: string | undefined; brandId?: string | undefined }

export function toProductInput(d: RowDraft, refs: Refs): ProductInput {
  return ProductInput.parse({
    name: d.name, sku: d.sku, hsnCode: d.hsnCode, baseUomId: refs.baseUomId, categoryId: refs.categoryId, brandId: refs.brandId,
    mrpPaise: d.mrpPaise, sellingPricePaise: d.sellingPricePaise, purchasePricePaise: d.purchasePricePaise,
    gstRateBp: d.gstRateBp, reorderLevelMilli: d.reorderLevelMilli, barcodes: d.barcodes.map((code) => ({ code })),
  });
}

const PLACEHOLDER_ID = '00000000000000000000000000';
const FIELD_OF: Record<string, ImportField> = {
  name: 'name', sku: 'sku', hsnCode: 'hsnCode', barcodes: 'barcodes', mrpPaise: 'mrp', sellingPricePaise: 'sellingPrice',
  purchasePricePaise: 'purchasePrice', gstRateBp: 'gstRate', reorderLevelMilli: 'reorderLevel',
};
const importField = (path: string): ImportField | 'row' => FIELD_OF[path.split('.')[0]!] ?? 'row';

function inputErrors(build: () => ProductInput, prefix = ''): RowErrors {
  const errors: RowErrors = {};
  try {
    for (const [path, message] of Object.entries(productFieldErrors(build()))) errors[importField(path)] ??= prefix + message;
  } catch (e) {
    for (const issue of (e as { issues?: { path: (string | number)[]; message: string }[] }).issues ?? []) {
      errors[importField(issue.path.join('.'))] ??= prefix + issue.message;
    }
  }
  return errors;
}

const ruleErrors = (draft: RowDraft): RowErrors => inputErrors(() => toProductInput(draft, { baseUomId: PLACEHOLDER_ID }));

function livePriceErrors(merged: ProductInput, prices: readonly LivePriceItem[]): RowErrors {
  const [problem] = unitPriceProblems(merged, prices);
  if (!problem) return {};
  const item = prices[problem.index]!;
  return problem.kind === 'no_conversion'
    ? { uom: `can't update: ${item.priceListName} still has a price per ${item.uomCode}` }
    : { mrp: `can't update: ${item.priceListName} has a ${item.uomCode} price of ${rupees(item.pricePaise)}, above the new MRP (${rupees(problem.ceilingPaise)} per ${item.uomCode})` };
}

// Categories or brands that do not exist yet cannot break a rule, so a placeholder id stands in for them.
function updateErrors(existing: Product, draft: RowDraft, prices: readonly LivePriceItem[]): RowErrors {
  const refs = {
    baseUomId: existing.baseUomId,
    categoryId: draft.category ? PLACEHOLDER_ID : undefined,
    brandId: draft.brand ? PLACEHOLDER_ID : undefined,
  };
  const errors = inputErrors(() => mergeForUpdate(existing, draft, refs), "can't update: ");
  if (Object.keys(errors).length > 0) return errors;
  const replacedByFile = (p: LivePriceItem) =>
    p.isDefaultList && p.uomId === existing.baseUomId && p.minQtyMilli === 0 && p.effectiveTo === undefined;
  return livePriceErrors(mergeForUpdate(existing, draft, refs), prices.filter((p) => !replacedByFile(p)));
}

class SeenInFile {
  private readonly sku = new Map<string, number>();
  private readonly barcode = new Map<string, number>();
  private readonly target = new Map<string, number>();

  // Each row is checked against the product as it was before the import, so only one row may update a product.
  claim(line: number, productId: string): number | undefined {
    const first = this.target.get(productId);
    if (first === undefined) this.target.set(productId, line);
    return first;
  }

  check(line: number, d: RowDraft, errors: RowErrors): void {
    if (d.sku) {
      const first = this.sku.get(d.sku);
      if (first !== undefined) errors.sku = `same SKU as row ${first}`;
      else this.sku.set(d.sku, line);
    }
    for (const code of d.barcodes) {
      const first = this.barcode.get(code);
      if (first !== undefined) errors.barcodes = `barcode ${code} is also on row ${first}`;
      else this.barcode.set(code, line);
    }
  }
}

function existingProduct(d: RowDraft, lookup: CatalogLookup, errors: RowErrors): string | undefined {
  const bySku = d.sku ? lookup.productBySku(d.sku) : undefined;
  let existing = bySku;
  for (const code of d.barcodes) {
    const owner = lookup.productByBarcode(code);
    if (!owner) continue;
    existing ??= owner;
    if (owner !== existing) errors.barcodes = `barcode ${code} belongs to another product`;
  }
  return existing;
}

const deletedOwnerCode = (d: RowDraft, lookup: CatalogLookup, productId: string): string =>
  d.barcodes.find((code) => lookup.productByBarcode(code) === productId) ?? d.sku ?? '';

export function planImport(table: Table, mapping: ImportMapping, lookup: CatalogLookup): ImportPlan {
  const seen = new SeenInFile();
  const create = { categories: new Map<string, string>(), brands: new Map<string, string>(), uoms: new Set<string>() };
  const rows = table.rows.map(({ line, cells }): PlannedRow => {
    const { draft, errors } = parseRow(cells, mapping);
    Object.assign(errors, { ...ruleErrors(draft), ...errors });
    seen.check(line, draft, errors);
    const existingProductId = existingProduct(draft, lookup, errors);
    if (Object.keys(errors).length > 0) return { line, status: 'error', draft, errors };
    if (!lookup.uomId(draft.uomCode)) create.uoms.add(draft.uomCode);
    if (draft.category && !lookup.categoryId(draft.category)) create.categories.set(normalizeName(draft.category), draft.category);
    if (draft.brand && !lookup.brandId(draft.brand)) create.brands.set(normalizeName(draft.brand), draft.brand);
    if (!existingProductId) return { line, status: 'ok', draft, errors };
    const existing = lookup.product(existingProductId);
    if (!existing) return { line, status: 'error', draft, errors: { barcodes: `barcode ${deletedOwnerCode(draft, lookup, existingProductId)} belongs to a deleted product` } };
    const first = seen.claim(line, existingProductId);
    const rowErrors = first !== undefined ? { row: `updates the same product as row ${first}` } : updateErrors(existing, draft, lookup.livePrices(existingProductId));
    return { line, status: 'duplicate', draft, errors: rowErrors, existingProductId };
  });
  return { rows, willCreate: { categories: [...create.categories.values()], brands: [...create.brands.values()], uoms: [...create.uoms] } };
}
