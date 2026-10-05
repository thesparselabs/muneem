import { z } from 'zod';
import { Ulid } from './schemas.js';

export const InvoiceTemplateId = z.enum([
  'minimal', 'classic', 'modern', 'compact-gst', 'bold', 'elegant', 'creative', 'thermal-80', 'thermal-58', 'bharat',
]);
export type InvoiceTemplateId = z.infer<typeof InvoiceTemplateId>;

export const InvoiceTemplateKind = z.enum(['a4', 'thermal']);
export type InvoiceTemplateKind = z.infer<typeof InvoiceTemplateKind>;

export const InvoiceTemplateMeta = z.object({
  id: InvoiceTemplateId, name: z.string(), description: z.string(), kind: InvoiceTemplateKind, size: z.string(),
});
export type InvoiceTemplateMeta = z.infer<typeof InvoiceTemplateMeta>;

export const ListTemplatesResult = z.object({ templates: z.array(InvoiceTemplateMeta) });
export type ListTemplatesResult = z.infer<typeof ListTemplatesResult>;

// The shop's look applied to every invoice: template, accent, logo/signature and the standing notes.
export const InvoiceBranding = z.object({
  templateId: InvoiceTemplateId.default('classic'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/u).default('#0f766e'),
  logoBase64: z.string().max(2_000_000).optional(),
  signatureBase64: z.string().max(2_000_000).optional(),
  signatoryName: z.string().max(80).optional(),
  showSignature: z.boolean().default(true),
  terms: z.string().max(2000).optional(),
  bankDetails: z.string().max(500).optional(),
  footerNote: z.string().max(200).default('Thank you! Visit again.'),
  // Page size for the A4-style templates; thermal templates use their own roll width.
  pageSize: z.enum(['a4', 'a5', 'letter']).default('a4'),
});
export type InvoiceBranding = z.infer<typeof InvoiceBranding>;

export const RenderInvoiceInput = z.object({ saleId: Ulid, templateId: InvoiceTemplateId.optional() });
export type RenderInvoiceInput = z.infer<typeof RenderInvoiceInput>;
export const RenderInvoiceResult = z.object({ html: z.string() });
export type RenderInvoiceResult = z.infer<typeof RenderInvoiceResult>;

export const SaveInvoicePdfInput = z.object({ saleId: Ulid, templateId: InvoiceTemplateId.optional() });
export type SaveInvoicePdfInput = z.infer<typeof SaveInvoicePdfInput>;
export const SaveInvoicePdfResult = z.object({ saved: z.boolean(), fileName: z.string() });
export type SaveInvoicePdfResult = z.infer<typeof SaveInvoicePdfResult>;
