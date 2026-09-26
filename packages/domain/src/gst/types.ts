/**
 * GST engine contract. Shared, byte-for-byte, with cloud/internal/domain/gst (Go) via
 * packages/domain/fixtures/gst/*.json. Any change here MUST land in both implementations
 * and extend the fixture suite in the same PR (HLD §5.1).
 *
 * All money is integer paise, quantities integer milli-units, rates integer basis points.
 * Percent discounts are given in basis points (1250 = 12.5%) so no float ever enters.
 */

export type TaxTreatment = 'taxable' | 'nil_rated' | 'exempt' | 'non_gst' | 'zero_rated';
export type TaxScheme = 'regular' | 'composition' | 'unregistered';
export type SupplyType = 'intra' | 'inter';
export type GstDocType = 'tax_invoice' | 'bill_of_supply' | 'credit_note' | 'delivery_challan';
export type Gstr1Bucket =
  | 'b2b'
  | 'b2cl'
  | 'b2cs'
  | 'cdnr'
  | 'cdnur'
  | 'exports'
  | 'nil_rated'
  | 'exempt'
  | 'non_gst'
  | 'na';

export interface Discount {
  kind: 'amount' | 'percent';
  /** paise when kind='amount'; basis points when kind='percent' */
  value: number;
}

export interface GstLineInput {
  qtyMilli: number;
  /** per base unit; inclusive or exclusive of tax per priceIsInclusive */
  unitPricePaise: number;
  priceIsInclusive: boolean;
  lineDiscount: Discount;
  gstRateBp: number;
  cessRateBp: number;
  cessPerUnitPaise: number;
  taxTreatment: TaxTreatment;
}

export interface GstInvoiceInput {
  docType: GstDocType;
  /** 2-digit GST state code of the supplying branch's GSTIN */
  supplierStateCode: string;
  /** 2-digit GST state code (FR-093) */
  placeOfSupplyStateCode: string;
  /** UT without legislature → intra-state split is CGST + UTGST (label only; arithmetic identical) */
  isUnionTerritoryWithoutLegislature: boolean;
  taxScheme: TaxScheme;
  customerGstin?: string;
  billDiscount: Discount;
  roundToRupee: boolean;
  /** Effective-dated config synced from the cloud, never a code constant (LLD §3.1). */
  b2clThresholdPaise: number;
  lines: GstLineInput[];
}

export interface GstLineResult {
  grossPaise: number;
  grossExPaise: number;
  lineDiscountPaise: number;
  apportionedBillDiscountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalPaise: number;
}

export interface GstInvoiceResult {
  supplyType: SupplyType;
  /** 'utgst' when intra-state in a UT without legislature; the amount is still in sgstPaise */
  stateTaxKind: 'sgst' | 'utgst';
  lines: GstLineResult[];
  grossPaise: number;
  lineDiscountPaise: number;
  billDiscountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  gstr1Bucket: Gstr1Bucket;
}

export interface GstFixtureCase {
  name: string;
  input: GstInvoiceInput;
  expected: GstInvoiceResult;
}
export interface GstFixtureFile {
  version: 1;
  cases: GstFixtureCase[];
}
