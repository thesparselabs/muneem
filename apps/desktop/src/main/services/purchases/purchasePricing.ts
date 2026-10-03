import {
  AppError, type Branch, type Business, type Product, type PurchaseDraft, type PurchaseQuote, type PurchaseQuoteLine, type Supplier,
} from '@muneem/contracts';
import {
  addDays, computeInvoice, divRound, DomainError, isUtWithoutLegislature, landedValues, toBaseQty, BILL_TOLERANCE_PAISE,
  type GstInvoiceResult, type GstLineInput,
} from '@muneem/domain';
import { getBranch, getBusiness, getProduct, getSupplier, listUoms } from '@muneem/db-sqlite';
import { qtyText } from '../print/receiptDoc.js';
import type { PosContext } from '../pos/posContext.js';

export interface PricedPurchase { quote: PurchaseQuote; supplier: Supplier; business: Business; branch: Branch }

interface PricedLine { draftLineNo: number; product: Product; gst: GstLineInput; itcEligible: boolean; line: Pick<PurchaseQuoteLine, 'productId' | 'name' | 'hsnCode' | 'uomId' | 'uomCode' | 'qtyMilli' | 'baseQtyMilli' | 'unitPricePaise' | 'priceIsInclusive' | 'gstRateBp' | 'cessRateBp' | 'cessPerUnitPaise' | 'taxTreatment' | 'lineDiscount'> }

const NO_B2CL = Number.MAX_SAFE_INTEGER;
const taxOf = (l: { cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number }): number => l.cgstPaise + l.sgstPaise + l.igstPaise + l.cessPaise;

// The quote and the save share this, so the purchase form can never show different numbers from the stored bill (5c details).
export class PurchasePricing {
  constructor(private readonly ctx: PosContext) {}

  price(draft: PurchaseDraft): PricedPurchase {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const business = getBusiness(db, till.businessId)!;
    const branch = getBranch(db, till.branchId)!;
    const supplier = getSupplier(db, draft.supplierId);
    if (!supplier || supplier.businessId !== till.businessId) throw new AppError('NOT_FOUND', 'Supplier not found');
    const issues: PurchaseQuote['issues'] = [];
    const priced = this.priceLines(draft, supplier, business, issues);
    if (priced.length === 0) throw new AppError('VALIDATION_FAILED', 'No line on this bill can be recorded', { lines: issues.map((i) => i.message).join('; ') });

    const gst = this.compute(supplier, branch, draft, priced);
    const charges = draft.charges.reduce((s, c) => s + c.amountPaise, 0);
    const landed = landedValues(gst.lines.map((l, i) => ({ taxablePaise: l.taxablePaise, taxPaise: taxOf(l), itcEligible: priced[i]!.itcEligible })), charges);
    const lines = priced.map(({ line, itcEligible, draftLineNo }, i): PurchaseQuoteLine => {
      const g = gst.lines[i]!;
      return {
        ...line, lineNo: i + 1, draftLineNo, itcEligible, grossPaise: g.grossPaise, lineDiscountPaise: g.lineDiscountPaise,
        apportionedBillDiscountPaise: g.apportionedBillDiscountPaise, taxablePaise: g.taxablePaise, cgstPaise: g.cgstPaise, sgstPaise: g.sgstPaise,
        igstPaise: g.igstPaise, cessPaise: g.cessPaise, totalPaise: g.totalPaise, chargesPaise: landed[i]!.chargesPaise,
        landedValuePaise: landed[i]!.landedValuePaise, unitCostPaise: divRound(landed[i]!.landedValuePaise * 1000, line.baseQtyMilli),
      };
    });
    const computedTotalPaise = gst.totalPaise + charges;
    const difference = draft.billTotalPaise === undefined ? undefined : draft.billTotalPaise - computedTotalPaise;
    const billTotalOk = difference === undefined ? undefined : Math.abs(difference) <= BILL_TOLERANCE_PAISE;
    const roundOffPaise = billTotalOk ? difference! : 0;
    return {
      supplier, business, branch,
      quote: {
        lines, issues,
        dueDate: draft.dueDate ?? addDays(draft.supplierInvoiceDate, supplier.creditDays),
        totals: {
          docType: supplier.taxScheme === 'regular' ? 'tax_invoice' : 'bill_of_supply', supplyType: gst.supplyType, stateTaxKind: gst.stateTaxKind,
          grossPaise: gst.grossPaise, lineDiscountPaise: gst.lineDiscountPaise, billDiscountPaise: gst.billDiscountPaise, taxablePaise: gst.taxablePaise,
          cgstPaise: gst.cgstPaise, sgstPaise: gst.sgstPaise, igstPaise: gst.igstPaise, cessPaise: gst.cessPaise, chargesPaise: charges,
          itcPaise: lines.filter((l) => l.itcEligible).reduce((s, l) => s + taxOf(l), 0),
          computedTotalPaise, roundOffPaise, totalPaise: computedTotalPaise + roundOffPaise,
        },
        ...(difference !== undefined && { billDifferencePaise: difference, billTotalOk: billTotalOk! }),
      },
    };
  }

  // ITC only when both sides are on the regular scheme; a line can still be marked ineligible (s.17(5)).
  private priceLines(draft: PurchaseDraft, supplier: Supplier, business: Business, issues: PurchaseQuote['issues']): PricedLine[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const on = this.ctx.today();
    const uomCodes = new Map(listUoms(db, businessId).map((u) => [u.id, u.code]));
    const itcAllowed = supplier.taxScheme === 'regular' && business.taxScheme === 'regular';
    return draft.lines.flatMap((l, i): PricedLine[] => {
      const issue = (message: string) => { issues.push({ lineNo: i + 1, message }); return []; };
      const p = getProduct(db, l.productId, on);
      if (!p || p.businessId !== businessId) return issue('product not found');
      if (!p.isActive) return issue(`${p.name} is deactivated`);
      const factorMilli = l.uomId === p.baseUomId ? 1000 : p.conversions.find((c) => c.fromUomId === l.uomId)?.factorMilli;
      if (factorMilli === undefined) return issue(`${p.name} has no ${uomCodes.get(l.uomId) ?? 'such'} unit`);
      const baseQtyMilli = toBaseQty(l.qtyMilli, factorMilli);
      if (baseQtyMilli <= 0) return issue(`Too small: ${qtyText(l.qtyMilli, uomCodes.get(l.uomId) ?? '')} of ${p.name} is less than 0.001 ${uomCodes.get(p.baseUomId) ?? ''}`);
      const gstRateBp = l.gstRateBp ?? p.gstRateBp;
      return [{
        draftLineNo: i + 1, product: p, itcEligible: itcAllowed && (l.itcEligible ?? true),
        gst: {
          qtyMilli: l.qtyMilli, unitPricePaise: l.unitPricePaise, priceIsInclusive: l.priceIsInclusive, lineDiscount: l.lineDiscount,
          gstRateBp, cessRateBp: p.cessRateBp, cessPerUnitPaise: p.cessPerUnitPaise, taxTreatment: p.taxTreatment,
        },
        line: {
          productId: p.id, name: p.name, uomId: l.uomId, uomCode: uomCodes.get(l.uomId) ?? '?', qtyMilli: l.qtyMilli, baseQtyMilli,
          unitPricePaise: l.unitPricePaise, priceIsInclusive: l.priceIsInclusive, gstRateBp, cessRateBp: p.cessRateBp,
          cessPerUnitPaise: p.cessPerUnitPaise, taxTreatment: p.taxTreatment, lineDiscount: l.lineDiscount, ...(p.hsnCode && { hsnCode: p.hsnCode }),
        },
      }];
    });
  }

  private compute(supplier: Supplier, branch: Branch, draft: PurchaseDraft, priced: PricedLine[]): GstInvoiceResult {
    try {
      return computeInvoice({
        docType: supplier.taxScheme === 'regular' ? 'tax_invoice' : 'bill_of_supply',
        supplierStateCode: supplier.stateCode,
        placeOfSupplyStateCode: branch.stateCode,
        isUnionTerritoryWithoutLegislature: isUtWithoutLegislature(branch.stateCode),
        taxScheme: supplier.taxScheme,
        billDiscount: draft.billDiscount,
        roundToRupee: false,
        b2clThresholdPaise: NO_B2CL,
        lines: priced.map((p) => p.gst),
      });
    } catch (e) {
      if (e instanceof DomainError) throw new AppError('VALIDATION_FAILED', e.message, { discount: e.message });
      throw e;
    }
  }
}
