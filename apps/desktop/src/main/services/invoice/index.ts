import type {
  InvoiceBranding, InvoiceTemplateId, InvoiceTemplateKind, InvoiceTemplateMeta, ListTemplatesResult,
  RenderInvoiceInput, RenderInvoiceResult, SaveInvoicePdfInput, SaveInvoicePdfResult,
} from '@muneem/contracts';
import type { InvoiceData } from './invoiceData.js';
import type { InvoiceBrandingStore } from './brandingStore.js';
import type { PdfSave } from './pdf.js';
import { render as minimal } from './templates/minimal.js';
import { render as classic } from './templates/classic.js';
import { render as modern } from './templates/modern.js';
import { render as compactGst } from './templates/compactGst.js';
import { render as bold } from './templates/bold.js';
import { render as elegant } from './templates/elegant.js';
import { render as creative } from './templates/creative.js';
import { render as thermal80 } from './templates/thermal80.js';
import { render as thermal58 } from './templates/thermal58.js';
import { render as bharat } from './templates/bharat.js';

type Renderer = (data: InvoiceData, branding: InvoiceBranding) => string;

const RENDERERS: Record<InvoiceTemplateId, Renderer> = {
  minimal, classic, modern, 'compact-gst': compactGst, bold, elegant, creative, 'thermal-80': thermal80, 'thermal-58': thermal58, bharat,
};

const META: readonly InvoiceTemplateMeta[] = [
  { id: 'minimal', name: 'Minimal', description: 'Whitespace and a single thin accent rule.', kind: 'a4', size: 'A4' },
  { id: 'classic', name: 'Classic', description: 'Formal ruled tax invoice with bordered boxes.', kind: 'a4', size: 'A4' },
  { id: 'modern', name: 'Modern', description: 'Full-width colour band header, clean body.', kind: 'a4', size: 'A4' },
  { id: 'compact-gst', name: 'Compact GST', description: 'Dense Indian tax invoice grid for long carts.', kind: 'a4', size: 'A4' },
  { id: 'bold', name: 'Bold', description: 'Accent blocks with an oversized grand total.', kind: 'a4', size: 'A4' },
  { id: 'elegant', name: 'Elegant', description: 'Serif type with a muted, centred header.', kind: 'a4', size: 'A4' },
  { id: 'creative', name: 'Creative', description: 'Coloured sidebar carries the seller details.', kind: 'a4', size: 'A4' },
  { id: 'thermal-80', name: 'Thermal 80mm', description: 'Receipt roll with logo and signature.', kind: 'thermal', size: '80mm' },
  { id: 'thermal-58', name: 'Thermal 58mm', description: 'Narrow receipt roll with logo and signature.', kind: 'thermal', size: '58mm' },
  { id: 'bharat', name: 'Bharat', description: 'Hindi + English bilingual labels, tricolour strip.', kind: 'a4', size: 'A4' },
];

export function listTemplates(): ListTemplatesResult {
  return { templates: META.map((m) => ({ ...m })) };
}

export function renderInvoice(templateId: InvoiceTemplateId, data: InvoiceData, branding: InvoiceBranding): string {
  return RENDERERS[templateId](data, branding);
}

export function templateKind(templateId: InvoiceTemplateId): InvoiceTemplateKind {
  return META.find((m) => m.id === templateId)?.kind ?? 'a4';
}

export interface InvoiceServiceDeps {
  branding: InvoiceBrandingStore;
  buildData: (saleId: string) => InvoiceData;
  save: PdfSave;
}

export class InvoiceService {
  constructor(private readonly d: InvoiceServiceDeps) {}

  listTemplates(): ListTemplatesResult { return listTemplates(); }
  getBranding(): InvoiceBranding { return this.d.branding.get(); }
  setBranding(input: InvoiceBranding): InvoiceBranding { return this.d.branding.set(input); }

  renderHtml(input: RenderInvoiceInput): RenderInvoiceResult {
    const branding = this.d.branding.get();
    const templateId = input.templateId ?? branding.templateId;
    return { html: renderInvoice(templateId, this.d.buildData(input.saleId), branding) };
  }

  async savePdf(input: SaveInvoicePdfInput): Promise<SaveInvoicePdfResult> {
    const branding = this.d.branding.get();
    const templateId = input.templateId ?? branding.templateId;
    const data = this.d.buildData(input.saleId);
    const html = renderInvoice(templateId, data, branding);
    const kind = templateKind(templateId);
    const PDF_PAGE = { a4: 'A4', a5: 'A5', letter: 'Letter' } as const;
    const opts = kind === 'thermal' ? { kind, widthMm: templateId === 'thermal-58' ? 58 : 80 } : { kind, pageSize: PDF_PAGE[branding.pageSize] };
    return this.d.save(html, `invoice-${data.invoiceNo}`, opts);
  }
}
