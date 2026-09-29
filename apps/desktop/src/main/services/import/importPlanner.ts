import { ProductInput, type ImportField, type ImportMapping } from '@muneem/contracts';
import { normalizeName } from '@muneem/domain';
import { productFieldErrors } from '@muneem/db-sqlite';
import { parseRow, type RowDraft, type RowErrors } from './rowParser.js';
import type { Table } from './tableReader.js';

export interface CatalogLookup {
  uomId(code: string): string | undefined;
  categoryId(name: string): string | undefined;
  brandId(name: string): string | undefined;
  productBySku(sku: string): string | undefined;
  productByBarcode(code: string): string | undefined;
}

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

function ruleErrors(draft: RowDraft): RowErrors {
  const errors: RowErrors = {};
  try {
    const input = toProductInput(draft, { baseUomId: PLACEHOLDER_ID });
    for (const [path, message] of Object.entries(productFieldErrors(input))) errors[importField(path)] ??= message;
  } catch (e) {
    for (const issue of (e as { issues?: { path: (string | number)[]; message: string }[] }).issues ?? []) {
      errors[importField(issue.path.join('.'))] ??= issue.message;
    }
  }
  return errors;
}

class SeenInFile {
  private readonly sku = new Map<string, number>();
  private readonly barcode = new Map<string, number>();

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
    return existingProductId
      ? { line, status: 'duplicate', draft, errors, existingProductId }
      : { line, status: 'ok', draft, errors };
  });
  return { rows, willCreate: { categories: [...create.categories.values()], brands: [...create.brands.values()], uoms: [...create.uoms] } };
}
