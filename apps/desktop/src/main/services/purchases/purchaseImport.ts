import type { PurchaseImportField, PurchaseImportMapping, PurchaseImportPreview, PurchaseLineInput } from '@muneem/contracts';
import { parseScaled } from '@muneem/domain';
import { findProductIdByBarcode, findProductIdBySku, getProduct, listUoms } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import { suggestFrom } from '../import/columnMapping.js';
import type { PreviewSession, PreviewStore } from '../import/previewStore.js';
import { readTable } from '../import/tableReader.js';

const ALIASES: Record<PurchaseImportField, readonly string[]> = {
  sku: ['sku', 'itemcode', 'productcode', 'code'],
  barcode: ['barcode', 'ean', 'upc', 'gtin'],
  qty: ['qty', 'quantity', 'units'],
  unit: ['unit', 'uom', 'unitcode'],
  rate: ['rate', 'price', 'unitprice', 'purchaseprice', 'cost'],
  gstRate: ['gst', 'gstrate', 'gstpercent', 'taxrate', 'tax'],
  discount: ['discount', 'disc', 'discountpercent'],
};

type Planned = { line: number; errors: Record<string, string>; input?: PurchaseLineInput };

// Fills the purchase form from a supplier's file; nothing is saved here — the bill is always saved by purchases.create (5c details).
export class PurchaseImportService {
  constructor(private readonly ctx: PosContext, private readonly previews: PreviewStore<PurchaseImportMapping>) {}

  async preview(input: { fileName?: string | undefined; contentBase64?: string | undefined; importId?: string | undefined; mapping?: PurchaseImportMapping | undefined }): Promise<PurchaseImportPreview> {
    const businessId = this.ctx.businessId();
    const session = input.importId ? this.previews.get(input.importId, businessId) : await this.load(businessId, input.fileName!, input.contentBase64!);
    if (input.mapping) this.previews.update(Object.assign(session, { mapping: input.mapping }));
    const rows = this.plan(session);
    const bad = rows.filter((r) => Object.keys(r.errors).length > 0);
    const lines = rows.flatMap((r) => (r.input && Object.keys(r.errors).length === 0 ? [r.input] : []));
    const products = [...new Set(lines.map((l) => l.productId))].map((id) => getProduct(this.ctx.db(), id, this.ctx.today())!);
    return {
      importId: session.id, fileName: session.fileName, columns: session.table.columns, mapping: session.mapping,
      counts: { total: rows.length, ok: rows.length - bad.length, errors: bad.length },
      errors: bad.slice(0, 500).map((r) => ({ line: r.line, errors: r.errors })),
      lines, products,
    };
  }

  private async load(businessId: string, fileName: string, contentBase64: string): Promise<PreviewSession<PurchaseImportMapping>> {
    const table = await readTable(fileName, Buffer.from(contentBase64, 'base64'));
    return this.previews.put({ businessId, fileName, table, mapping: suggestFrom(table.columns, ALIASES) });
  }

  private plan(session: PreviewSession<PurchaseImportMapping>): Planned[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const uoms = new Map(listUoms(db, businessId).map((u) => [u.code.toUpperCase(), u.id]));
    const cell = (cells: readonly string[], f: PurchaseImportField) => {
      const i = session.mapping[f];
      return i === undefined ? '' : (cells[i] ?? '').trim();
    };
    return session.table.rows.map(({ line, cells }): Planned => {
      const errors: Record<string, string> = {};
      const sku = cell(cells, 'sku');
      const barcode = cell(cells, 'barcode');
      const productId = (sku && findProductIdBySku(db, businessId, sku)) || (barcode && findProductIdByBarcode(db, businessId, barcode)) || undefined;
      const product = productId ? getProduct(db, productId, this.ctx.today()) : null;
      if (!product) errors.product = sku || barcode ? `no product with SKU or barcode ${sku || barcode}` : 'enter a SKU or barcode';
      const qty = parseScaled(cell(cells, 'qty'), 3);
      if (qty === null || qty <= 0) errors.qty = `"${cell(cells, 'qty')}" is not a quantity above zero`;
      const rate = parseScaled(cell(cells, 'rate'), 2);
      if (rate === null || rate < 0) errors.rate = `"${cell(cells, 'rate')}" is not a rate`;
      const unitText = cell(cells, 'unit').toUpperCase();
      const uomId = unitText ? uoms.get(unitText) : product?.baseUomId;
      if (unitText && !uomId) errors.unit = `no unit with code ${unitText}`;
      else if (product && uomId && uomId !== product.baseUomId && !product.conversions.some((c) => c.fromUomId === uomId)) {
        errors.unit = `${product.name} has no ${unitText} unit`;
      }
      const gstText = cell(cells, 'gstRate').replace(/%$/u, '');
      const gstRateBp = gstText ? parseScaled(gstText, 2) : undefined;
      if (gstRateBp === null || (gstRateBp !== undefined && (gstRateBp < 0 || gstRateBp > 10_000))) errors.gstRate = `"${gstText}" is not a GST rate`;
      const discText = cell(cells, 'discount').replace(/%$/u, '');
      const discountBp = discText ? parseScaled(discText, 2) : 0;
      if (discountBp === null || discountBp < 0 || discountBp > 10_000) errors.discount = `"${discText}" is not a discount percent`;
      if (Object.keys(errors).length > 0) return { line, errors };
      return {
        line, errors,
        input: {
          productId: product!.id, uomId: uomId!, qtyMilli: qty!, unitPricePaise: rate!, priceIsInclusive: false,
          lineDiscount: { kind: 'percent', value: discountBp! }, ...(gstRateBp !== undefined && gstRateBp !== null && { gstRateBp }),
        },
      };
    });
  }
}
