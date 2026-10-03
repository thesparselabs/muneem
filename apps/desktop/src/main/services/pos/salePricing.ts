import {
  AppError, type Branch, type Business, type Customer, type Product, type QuoteContext, type QuoteLine, type SaleDraft, type SaleQuote, type SaleTotals,
} from '@muneem/contracts';
import {
  computeInvoice, DomainError, effectiveDiscountBp, isUtWithoutLegislature, resolvePrice, toBaseQty, type GstInvoiceResult, type GstLineInput,
} from '@muneem/domain';
import {
  defaultWarehouseId, getBranch, getBusiness, getCustomer, getDefaultPriceList, getPriceItemsByProduct, getProduct, listUoms, stockState,
  toPriceItem,
} from '@muneem/db-sqlite';
import { qtyText } from '../print/receiptDoc.js';
import type { PosContext } from './posContext.js';
import { negativeStockRule } from '../inventory/negativeStock.js';
import { POS_SETTINGS } from './register.js';

const B2CL_THRESHOLD_PAISE = 10_000_000;

export interface PricedSale {
  quote: SaleQuote;
  business: Business;
  branch: Branch;
  customer: Customer | null;
  priceListId: string | null;
  placeOfSupplyReason: string | null;
}

interface PricedLine { draftLineNo: number; product: Product; baseUomCode: string; line: Omit<QuoteLine, keyof GstLineOutput | 'lineNo'>; gst: GstLineInput }
type GstLineOutput = Pick<QuoteLine, 'grossPaise' | 'lineDiscountPaise' | 'apportionedBillDiscountPaise' | 'taxablePaise' | 'cgstPaise' | 'sgstPaise' | 'igstPaise' | 'cessPaise' | 'totalPaise'>;

// Prices a cart from product data on the business date; the quote and the commit share this so they can never disagree.
export class SalePricing {
  constructor(private readonly ctx: PosContext) {}

  price(draft: SaleDraft): PricedSale {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const business = getBusiness(db, till.businessId)!;
    const branch = getBranch(db, till.branchId)!;
    const customer = draft.customerId ? this.customer(draft.customerId) : null;
    const placeOfSupplyState = draft.placeOfSupplyOverride?.stateCode ?? customer?.stateCode ?? branch.stateCode;
    const issues: SaleQuote['issues'] = [];
    const priced = this.priceLines(draft, issues);
    if (priced.length === 0) throw new AppError('VALIDATION_FAILED', 'Nothing in the cart can be sold', { lines: issues.map((i) => i.message).join('; ') });

    const context = {
      supplierStateCode: branch.stateCode, taxScheme: business.taxScheme,
      roundToRupee: this.ctx.setting(POS_SETTINGS.roundToRupee, true),
      b2clThresholdPaise: this.ctx.setting(POS_SETTINGS.b2clThresholdPaise, B2CL_THRESHOLD_PAISE),
    };
    const gst = this.compute(context, placeOfSupplyState, customer, draft, priced);
    const lines = priced.map(({ line }, i): QuoteLine => ({ ...line, lineNo: i + 1, ...pickLine(gst.lines[i]!) }));
    const preDiscount = gst.lines.reduce((s, l) => s + l.grossExPaise, 0);
    const totals: SaleTotals = {
      docType: business.taxScheme === 'regular' ? 'tax_invoice' : 'bill_of_supply',
      placeOfSupplyState, supplyType: gst.supplyType, stateTaxKind: gst.stateTaxKind, gstr1Bucket: gst.gstr1Bucket,
      grossPaise: gst.grossPaise, lineDiscountPaise: gst.lineDiscountPaise, billDiscountPaise: gst.billDiscountPaise,
      taxablePaise: gst.taxablePaise, cgstPaise: gst.cgstPaise, sgstPaise: gst.sgstPaise, igstPaise: gst.igstPaise, cessPaise: gst.cessPaise,
      roundOffPaise: gst.roundOffPaise, totalPaise: gst.totalPaise,
      discountBp: effectiveDiscountBp(preDiscount, gst.lineDiscountPaise + gst.billDiscountPaise),
    };
    return {
      quote: { lines, totals, issues, warnings: this.stockWarnings(priced, branch.id), context }, business, branch, customer,
      priceListId: getDefaultPriceList(db, till.businessId)?.id ?? null,
      placeOfSupplyReason: draft.placeOfSupplyOverride?.reason ?? null,
    };
  }

  // ADR-0020: running total per product across the cart, compared with the default warehouse's stock.
  private stockWarnings(priced: readonly PricedLine[], branchId: string): SaleQuote['warnings'] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const warehouseId = defaultWarehouseId(db, branchId);
    const remaining = new Map<string, number>();
    return priced.flatMap(({ draftLineNo, product, baseUomCode, line }) => {
      const stock = remaining.get(product.id) ?? (warehouseId ? stockState(db, businessId, warehouseId, product.id).qtyMilli : 0);
      remaining.set(product.id, stock - line.baseQtyMilli);
      if (stock - line.baseQtyMilli >= 0) return [];
      const rule = negativeStockRule(this.ctx, product);
      if (rule === 'allow') return [];
      const message = stock > 0 ? `${product.name}: only ${qtyText(stock, baseUomCode)} in stock` : `${product.name}: no stock recorded`;
      return [{ lineNo: draftLineNo, productId: product.id, message, stockMilli: stock, blocking: rule === 'block' }];
    });
  }

  private customer(id: string): Customer {
    const c = getCustomer(this.ctx.db(), id);
    if (!c || c.businessId !== this.ctx.businessId()) throw new AppError('NOT_FOUND', 'Customer not found');
    return c;
  }

  private priceLines(draft: SaleDraft, issues: SaleQuote['issues']): PricedLine[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const on = this.ctx.today();
    const ids = [...new Set(draft.lines.map((l) => l.productId))];
    const products = new Map(ids.map((id) => [id, getProduct(db, id, on)] as const));
    const list = getDefaultPriceList(db, businessId);
    const prices = list ? getPriceItemsByProduct(db, list.id, ids) : new Map();
    const uomCodes = new Map(listUoms(db, businessId).map((u) => [u.id, u.code]));
    return draft.lines.flatMap((l, i): PricedLine[] => {
      const issue = (message: string) => { issues.push({ lineNo: i + 1, message }); return []; };
      const p = products.get(l.productId);
      if (!p || p.businessId !== businessId) return issue('product not found');
      if (!p.isActive) return issue(`${p.name} is deactivated`);
      const factorMilli = factorFor(p, l.uomId);
      if (factorMilli === undefined) return issue(`${p.name} is not sold in ${uomCodes.get(l.uomId) ?? 'that unit'}`);
      const price = resolvePrice((prices.get(p.id) ?? []).map(toPriceItem), {
        uomId: l.uomId, qtyMilli: l.qtyMilli, on, baseUomId: p.baseUomId, ...(l.uomId !== p.baseUomId && { factorMilli }),
      });
      if (!price) return issue(`${p.name} has no selling price`);
      const baseQtyMilli = toBaseQty(l.qtyMilli, factorMilli);
      if (baseQtyMilli <= 0) return issue(`Too small: ${qtyText(l.qtyMilli, uomCodes.get(l.uomId) ?? '')} of ${p.name} is less than 0.001 ${uomCodes.get(p.baseUomId) ?? ''}`);
      const gst: GstLineInput = {
        qtyMilli: l.qtyMilli, unitPricePaise: price.pricePaise, priceIsInclusive: price.isInclusive, lineDiscount: l.lineDiscount,
        gstRateBp: p.gstRateBp, cessRateBp: p.cessRateBp, cessPerUnitPaise: p.cessPerUnitPaise, taxTreatment: p.taxTreatment,
      };
      return [{
        gst, draftLineNo: i + 1, product: p, baseUomCode: uomCodes.get(p.baseUomId) ?? '',
        line: {
          productId: p.id, name: p.name, uomId: l.uomId, uomCode: uomCodes.get(l.uomId) ?? '?', qtyMilli: l.qtyMilli,
          baseQtyMilli, unitPricePaise: price.pricePaise, priceIsInclusive: price.isInclusive,
          gstRateBp: p.gstRateBp, cessRateBp: p.cessRateBp, cessPerUnitPaise: p.cessPerUnitPaise, taxTreatment: p.taxTreatment,
          lineDiscount: l.lineDiscount,
          ...(p.hsnCode && { hsnCode: p.hsnCode }),
          ...(p.mrpPaise !== undefined && { mrpPaise: p.mrpPaise }),
        },
      }];
    });
  }

  private compute(
    context: QuoteContext, placeOfSupplyState: string, customer: Customer | null, draft: SaleDraft, priced: PricedLine[],
  ): GstInvoiceResult {
    try {
      return computeInvoice({
        docType: context.taxScheme === 'regular' ? 'tax_invoice' : 'bill_of_supply',
        supplierStateCode: context.supplierStateCode,
        placeOfSupplyStateCode: placeOfSupplyState,
        isUnionTerritoryWithoutLegislature: isUtWithoutLegislature(context.supplierStateCode),
        taxScheme: context.taxScheme,
        ...(customer?.gstin && { customerGstin: customer.gstin }),
        billDiscount: draft.billDiscount,
        roundToRupee: context.roundToRupee,
        b2clThresholdPaise: context.b2clThresholdPaise,
        lines: priced.map((p) => p.gst),
      });
    } catch (e) {
      if (e instanceof DomainError) throw new AppError('VALIDATION_FAILED', e.message, { discount: e.message });
      throw e;
    }
  }
}

function factorFor(p: Product, uomId: string): number | undefined {
  if (uomId === p.baseUomId) return 1000;
  return p.conversions.find((c) => c.fromUomId === uomId)?.factorMilli;
}

function pickLine(l: GstInvoiceResult['lines'][number]): GstLineOutput {
  return {
    grossPaise: l.grossPaise, lineDiscountPaise: l.lineDiscountPaise, apportionedBillDiscountPaise: l.apportionedBillDiscountPaise,
    taxablePaise: l.taxablePaise, cgstPaise: l.cgstPaise, sgstPaise: l.sgstPaise, igstPaise: l.igstPaise, cessPaise: l.cessPaise, totalPaise: l.totalPaise,
  };
}
