import { AppError, type OpeningImportField, type OpeningImportMapping, type OpeningImportPreview } from '@muneem/contracts';
import { parseScaled } from '@muneem/domain';
import { findProductIdByBarcode, findProductIdBySku, getMeta, getProduct, setMeta, withTransaction } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import { suggestFrom } from '../import/columnMapping.js';
import type { PreviewSession, PreviewStore } from '../import/previewStore.js';
import { readTable, type Table } from '../import/tableReader.js';
import type { InventoryService } from './inventoryService.js';

const ALIASES: Record<OpeningImportField, readonly string[]> = {
  sku: ['sku', 'itemcode', 'productcode', 'code'],
  barcode: ['barcode', 'ean', 'upc', 'gtin'],
  qty: ['qty', 'quantity', 'stock', 'openingstock', 'openingqty', 'closingstock', 'onhand'],
  unitCost: ['unitcost', 'cost', 'costprice', 'purchaseprice', 'rate'],
};

interface PlannedOpening { line: number; name?: string; productId?: string; qtyMilli?: number; unitCostPaise?: number; errors: Record<string, string> }

export class OpeningImportService {
  constructor(private readonly ctx: PosContext, private readonly inventory: InventoryService, private readonly previews: PreviewStore<OpeningImportMapping>) {}

  async preview(input: { fileName?: string | undefined; contentBase64?: string | undefined; importId?: string | undefined; mapping?: OpeningImportMapping | undefined }): Promise<OpeningImportPreview> {
    const businessId = this.ctx.businessId();
    const session = input.importId ? this.previews.get(input.importId, businessId) : await this.load(businessId, input.fileName!, input.contentBase64!);
    if (input.mapping) this.previews.update(Object.assign(session, { mapping: input.mapping }));
    const rows = this.plan(session);
    const ok = rows.filter((r) => Object.keys(r.errors).length === 0).length;
    return {
      importId: session.id, fileName: session.fileName, columns: session.table.columns, mapping: session.mapping,
      counts: { total: rows.length, ok, errors: rows.length - ok },
      rows: [...rows.filter((r) => Object.keys(r.errors).length > 0).slice(0, 500), ...rows.filter((r) => Object.keys(r.errors).length === 0).slice(0, 20)]
        .map((r) => ({ line: r.line, status: Object.keys(r.errors).length > 0 ? 'error' as const : 'ok' as const, errors: r.errors, ...(r.name && { name: r.name }) })),
    };
  }

  commit(importId: string, commandId: string) {
    const db = this.ctx.db();
    const doneKey = `opening-import:${commandId}`;
    const done = getMeta(db, doneKey);
    if (done) return JSON.parse(done) as ReturnType<InventoryService['setOpeningStock']>;
    const session = this.previews.get(importId, this.ctx.businessId());
    const result = withTransaction(db, () => {
      const lines = this.plan(session).filter((r) => Object.keys(r.errors).length === 0)
        .map((r) => ({ productId: r.productId!, qtyMilli: r.qtyMilli!, unitCostPaise: r.unitCostPaise! }));
      if (lines.length === 0) throw new AppError('VALIDATION_FAILED', 'No row in the file can be imported', { file: 'every row has an error' });
      const r = this.inventory.setOpeningStock({ lines, note: `Imported from ${session.fileName}` });
      setMeta(db, doneKey, JSON.stringify(r));
      return r;
    });
    this.previews.delete(session.id);
    return result;
  }

  private async load(businessId: string, fileName: string, contentBase64: string): Promise<PreviewSession<OpeningImportMapping>> {
    const table: Table = await readTable(fileName, Buffer.from(contentBase64, 'base64'));
    return this.previews.put({ businessId, fileName, table, mapping: suggestFrom(table.columns, ALIASES) });
  }

  private plan(session: PreviewSession<OpeningImportMapping>): PlannedOpening[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const warehouseId = this.inventory.warehouseId();
    const firstLine = new Map<string, number>();
    const cell = (cells: readonly string[], f: OpeningImportField) => {
      const i = session.mapping[f];
      return i === undefined ? '' : (cells[i] ?? '').trim();
    };
    return session.table.rows.map(({ line, cells }) => {
      const errors: Record<string, string> = {};
      const sku = cell(cells, 'sku');
      const barcode = cell(cells, 'barcode');
      const productId = (sku && findProductIdBySku(db, businessId, sku)) || (barcode && findProductIdByBarcode(db, businessId, barcode)) || undefined;
      const product = productId ? getProduct(db, productId, this.ctx.today()) : null;
      if (!product) errors.product = sku || barcode ? `no product with SKU or barcode ${sku || barcode}` : 'enter a SKU or barcode';
      const qty = parseScaled(cell(cells, 'qty'), 3);
      if (qty === null || qty <= 0) errors.qty = `"${cell(cells, 'qty')}" is not a quantity above zero`;
      const costText = cell(cells, 'unitCost');
      const cost = costText ? parseScaled(costText, 2) : product?.purchasePricePaise ?? null;
      if (cost === null || cost < 0) errors.unitCost = costText ? `"${costText}" is not a valid cost` : 'enter a unit cost (the product has no purchase price)';
      if (product) {
        const first = firstLine.get(product.id);
        if (first !== undefined) errors.product = `same product as row ${first}`;
        else firstLine.set(product.id, line);
        const problem = qty !== null && qty > 0 ? this.inventory.openingProblem(warehouseId, product.id, qty) : null;
        if (problem) errors[problem.field === 'qtyMilli' ? 'qty' : 'product'] = problem.message;
      }
      return {
        line, errors, ...(product && { name: product.name, productId: product.id }),
        ...(qty !== null && { qtyMilli: qty }), ...(cost !== null && cost !== undefined && { unitCostPaise: cost }),
      };
    });
  }
}
