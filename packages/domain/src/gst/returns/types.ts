import type { Gstr1Bucket, SupplyType, TaxTreatment } from '../types.js';

export interface GstHeads { igstPaise: number; cgstPaise: number; sgstPaise: number; cessPaise: number }
export interface TaxAmounts extends GstHeads { taxablePaise: number }

// One outward line as stored, with what its document says about the supply.
export interface OutwardLine extends TaxAmounts {
  docId: string; docNumber: string; docDate: string; docValuePaise: number; docBucket: Gstr1Bucket;
  customerGstin: string | null; customerName: string | null; placeOfSupply: string; supplyType: SupplyType;
  hsnCode: string | null; uomCode: string; qtyMilli: number; taxTreatment: TaxTreatment; gstRateBp: number;
}

// A credit-note line: `doc*` is the note; the sale it reverses decides its section.
export interface NoteLine extends OutwardLine { saleBucket: Gstr1Bucket; saleNumber: string; saleDate: string }

// One series' documents in the month, by number.
export interface SeriesIssued {
  nature: 'invoice' | 'credit_note'; firstNumber: string; lastNumber: string; firstSeq: number; lastSeq: number; issued: number; cancelled: number;
}

export type InwardKind = 'purchase' | 'expense' | 'debit_note' | 'purchase_cancel' | 'expense_cancel';
// An inward line; reversals (debit notes, cancels) carry positive amounts and are told apart by kind.
export interface InwardLine extends TaxAmounts {
  kind: InwardKind; docId: string; docNumber: string; docDate: string; supplierName: string | null; supplierGstin: string | null;
  supplierInvoiceNo: string | null; supplierInvoiceDate: string | null; supplyType: SupplyType | null; taxTreatment: TaxTreatment;
  supplierScheme: 'regular' | 'composition' | 'unregistered'; itcEligible: boolean;
}

export interface B2bRow extends TaxAmounts {
  gstin: string; name: string; invoiceNumber: string; invoiceDate: string; invoiceValuePaise: number; placeOfSupply: string; rateBp: number;
}
export interface B2clRow extends TaxAmounts { invoiceNumber: string; invoiceDate: string; invoiceValuePaise: number; placeOfSupply: string; rateBp: number }
export interface B2csRow extends TaxAmounts { placeOfSupply: string; rateBp: number }
export interface CdnrRow extends TaxAmounts {
  gstin: string; name: string; noteNumber: string; noteDate: string; placeOfSupply: string; noteValuePaise: number; rateBp: number;
}
export interface CdnurRow extends TaxAmounts {
  urType: 'B2CL' | 'EXPWOP' | 'EXPWP'; noteNumber: string; noteDate: string; placeOfSupply: string; noteValuePaise: number; rateBp: number;
}
export interface ExpRow extends TaxAmounts { exportType: 'WOPAY' | 'WPAY'; invoiceNumber: string; invoiceDate: string; invoiceValuePaise: number; rateBp: number }
export type ExempKind = 'inter_registered' | 'intra_registered' | 'inter_unregistered' | 'intra_unregistered';
export interface ExempRow { kind: ExempKind; nilPaise: number; exemptPaise: number; nonGstPaise: number }
export interface HsnRow extends TaxAmounts {
  recipient: 'b2b' | 'b2c'; hsn: string; uqc: string; qtyMilli: number; totalValuePaise: number; rateBp: number;
}
export interface DocsRow { nature: 'invoice' | 'credit_note'; from: string; to: string; total: number; cancelled: number }

export interface Gstr1 {
  applicable: boolean;
  b2b: B2bRow[]; b2cl: B2clRow[]; b2cs: B2csRow[]; cdnr: CdnrRow[]; cdnur: CdnurRow[]; exp: ExpRow[]; exemp: ExempRow[]; hsn: HsnRow[]; docs: DocsRow[];
  // Output tax by head, net of credit notes: what the return declares.
  net: TaxAmounts;
  missingHsn: { docNumber: string; count: number }[];
}

export type Gstr3bCode = '3.1a' | '3.1b' | '3.1c' | '3.1d' | '3.1e' | '4A5' | '4B2' | '4C' | '4D2';
export interface Gstr3bRow extends TaxAmounts { code: Gstr3bCode; description: string }
export interface Gstr3bInwardRow { description: string; interPaise: number; intraPaise: number }
export interface Gstr3b {
  applicable: boolean;
  rows: Gstr3bRow[];
  inward: Gstr3bInwardRow[];
  outputTax: GstHeads;
  netItc: GstHeads;
}

export interface ItcRegisterRow extends TaxAmounts {
  kind: InwardKind; docNumber: string; docDate: string; supplierName: string; supplierGstin: string; supplierInvoiceNo: string;
  supplierInvoiceDate: string; eligible: GstHeads; ineligiblePaise: number;
}
