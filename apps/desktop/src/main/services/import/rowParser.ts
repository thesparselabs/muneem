import type { ImportField, ImportMapping } from '@muneem/contracts';
import { parseScaled } from '@muneem/domain';

export interface RowDraft {
  name: string;
  sku?: string;
  barcodes: string[];
  hsnCode?: string;
  category?: string;
  brand?: string;
  uomCode: string;
  mrpPaise?: number;
  sellingPricePaise?: number;
  purchasePricePaise?: number;
  gstRateBp?: number;
  reorderLevelMilli?: number;
}

export type RowErrors = Partial<Record<ImportField | 'row', string>>;

const DEFAULT_UOM = 'PCS';
const UOM_CODE = /^[A-Z0-9]{1,8}$/;
const SCALE: Record<'mrp' | 'sellingPrice' | 'purchasePrice' | 'gstRate' | 'reorderLevel', number> = {
  mrp: 2, sellingPrice: 2, purchasePrice: 2, gstRate: 2, reorderLevel: 3,
};

export function parseRow(cells: readonly string[], mapping: ImportMapping): { draft: RowDraft; errors: RowErrors } {
  const errors: RowErrors = {};
  const text = (field: ImportField): string | undefined => {
    const index = mapping[field];
    const value = index === undefined ? undefined : cells[index]?.trim();
    return value ? value : undefined;
  };
  const scaled = (field: keyof typeof SCALE): number | undefined => {
    const raw = text(field);
    if (raw === undefined) return undefined;
    const value = parseScaled(raw, SCALE[field]);
    if (value === null || value < 0) errors[field] = `"${raw}" is not a valid amount`;
    return value ?? undefined;
  };

  const uomCode = (text('uom') ?? DEFAULT_UOM).toUpperCase();
  if (!UOM_CODE.test(uomCode)) errors.uom = `"${uomCode}" is not a valid unit code`;
  const draft: RowDraft = {
    name: text('name') ?? '',
    barcodes: (text('barcodes') ?? '').split(/[;|]/u).map((b) => b.trim()).filter(Boolean),
    uomCode,
  };
  if (!draft.name) errors.name = 'name is required';
  const optional = { sku: text('sku'), hsnCode: text('hsnCode'), category: text('category'), brand: text('brand') };
  const amounts = {
    mrpPaise: scaled('mrp'), sellingPricePaise: scaled('sellingPrice'), purchasePricePaise: scaled('purchasePrice'),
    gstRateBp: scaled('gstRate'), reorderLevelMilli: scaled('reorderLevel'),
  };
  for (const [k, v] of Object.entries({ ...optional, ...amounts })) if (v !== undefined) Object.assign(draft, { [k]: v });
  return { draft, errors };
}
