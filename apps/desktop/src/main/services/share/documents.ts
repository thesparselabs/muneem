import type { CreditNote, Customer, Estimate, Permission, ReceiptDoc, Sale, ShareDocType, ShareTarget, Supplier } from '@muneem/contracts';
import { formatRupees as rupees, type PartyType } from '@muneem/domain';
import type { InvoiceDocument } from '../invoice/index.js';
import { pdfFileName, type PdfRender } from '../invoice/pdf.js';
import { fmtDate } from '../invoice/templates/base.js';
import { layoutReceipt } from '../print/layout.js';
import { receiptHtml } from '../print/receiptHtml.js';
import type { Statement, StatementRange } from './statement.js';

// One document ready to leave the shop: what it is called, the standard message, who it is for, and its PDF.
export interface SharedDocument {
  label: string;
  fileName: string;
  subject: string;
  message: string;
  contact: { phone?: string | undefined; email?: string | undefined };
  pdf(): Promise<Buffer>;
}

export interface ShareSources {
  shopName(): string;
  sale(id: string): Sale;
  invoice(saleId: string): InvoiceDocument;
  creditNote(id: string): CreditNote;
  creditNoteReceipt(id: string): ReceiptDoc;
  customer(id: string): Customer;
  supplier(id: string): Supplier;
  statement(partyType: PartyType, party: { id: string; name: string }, range: StatementRange): Statement;
  estimate(id: string): Estimate;
  estimateDocument(e: Estimate): InvoiceDocument;
  renderPdf: PdfRender;
}

export const SHARE_PERMISSION: Readonly<Record<ShareDocType, Permission>> = {
  invoice: 'sales.view', credit_note: 'sales.view', customer_statement: 'customers.view', supplier_statement: 'suppliers.view', estimate: 'sales.view',
};

const RECEIPT_COLUMNS = 42;
const greeting = (name: string | undefined): string => `Dear ${name?.trim() || 'Customer'}`;

export class ShareDocuments {
  constructor(private readonly s: ShareSources) {}

  resolve(t: ShareTarget): SharedDocument {
    switch (t.docType) {
      case 'invoice': return this.invoice(t.id);
      case 'credit_note': return this.creditNote(t.id);
      case 'customer_statement': return this.statement('customer', t);
      case 'supplier_statement': return this.statement('supplier', t);
      case 'estimate': return this.estimate(t.id);
    }
  }

  private invoice(saleId: string): SharedDocument {
    const sale = this.s.sale(saleId);
    const doc = this.s.invoice(saleId);
    const customer = sale.customerId ? this.s.customer(sale.customerId) : null;
    const title = sale.totals.docType === 'tax_invoice' ? 'Tax invoice' : 'Bill of supply';
    const shop = this.s.shopName();
    return {
      label: `${title} ${sale.docNumber}`,
      fileName: pdfFileName(doc.fileName),
      subject: `${title} ${sale.docNumber} from ${shop}`,
      message: `${greeting(sale.customer.name ?? customer?.name)}, thank you for shopping at ${shop}. Your ${title.toLowerCase()} ${sale.docNumber} `
        + `dated ${fmtDate(sale.docDate)} for ${rupees(sale.totals.totalPaise)} is attached.`,
      contact: { phone: sale.customer.phone ?? customer?.phone, email: customer?.email },
      pdf: () => this.s.renderPdf(doc.html, doc.pdf),
    };
  }

  private creditNote(id: string): SharedDocument {
    const note = this.s.creditNote(id);
    const receipt = this.s.creditNoteReceipt(id);
    const customer = note.customerId ? this.s.customer(note.customerId) : null;
    const page = receiptHtml(layoutReceipt(receipt, RECEIPT_COLUMNS, 'symbol'), RECEIPT_COLUMNS);
    const shop = this.s.shopName();
    return {
      label: `Credit note ${note.docNumber}`,
      fileName: pdfFileName(`credit-note-${note.docNumber}`),
      subject: `Credit note ${note.docNumber} from ${shop}`,
      message: `${greeting(note.customerName ?? customer?.name)}, your credit note ${note.docNumber} dated ${fmtDate(note.docDate)} for `
        + `${rupees(note.totalPaise)} against invoice ${note.saleDocNumber} from ${shop} is attached.`,
      contact: { phone: customer?.phone, email: customer?.email },
      pdf: () => this.s.renderPdf(page.html, { kind: 'thermal', widthMm: 80 }),
    };
  }

  private estimate(id: string): SharedDocument {
    const e = this.s.estimate(id);
    const doc = this.s.estimateDocument(e);
    const customer = e.customerId ? this.s.customer(e.customerId) : null;
    const shop = this.s.shopName();
    return {
      label: `Quotation ${e.docNumber}`,
      fileName: pdfFileName(doc.fileName),
      subject: `Quotation ${e.docNumber} from ${shop}`,
      message: `${greeting(e.customer.name)}, thank you for your enquiry. Our quotation ${e.docNumber} for ${rupees(e.totals.totalPaise)} is attached; `
        + `it is valid until ${fmtDate(e.validUntil)}. — ${shop}`,
      contact: { phone: customer?.phone, email: customer?.email },
      pdf: () => this.s.renderPdf(doc.html, doc.pdf),
    };
  }

  private statement(partyType: PartyType, t: ShareTarget): SharedDocument {
    const party = partyType === 'customer' ? this.s.customer(t.id) : this.s.supplier(t.id);
    const range = { from: t.period?.from, to: t.period?.to };
    const st = this.s.statement(partyType, party, range);
    const shop = this.s.shopName();
    return {
      label: `Statement of account for ${party.name}`,
      fileName: pdfFileName(`statement-${party.name}-${range.to ?? 'to-date'}`),
      subject: `Statement of account from ${shop}`,
      message: `${greeting(party.name)}, your statement of account with ${shop}${range.from ? ` from ${fmtDate(range.from)}` : ''}`
        + `${range.to ? ` to ${fmtDate(range.to)}` : ''} is attached. ${balanceLine(partyType, st.closingBalancePaise)}`,
      contact: { phone: party.phone, email: party.email },
      pdf: () => this.s.renderPdf(st.html, { kind: 'a4', pageSize: 'A4' }),
    };
  }
}

// Positive means the party owes the shop (ADR-0022), for customers and suppliers alike.
function balanceLine(partyType: PartyType, balancePaise: number): string {
  if (balancePaise === 0) return 'The account is settled.';
  if (balancePaise > 0) return `${partyType === 'customer' ? 'Balance due' : 'Balance due to us'}: ${rupees(balancePaise)}.`;
  return `${partyType === 'customer' ? 'Advance with us' : 'Balance we owe you'}: ${rupees(-balancePaise)}.`;
}
