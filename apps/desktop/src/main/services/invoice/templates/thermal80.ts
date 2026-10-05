import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import { EN_LABELS, thermalBody, thermalDocument } from './base.js';

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  return thermalDocument({ accent: branding.accentColor, style: '', widthMm: 80, body: thermalBody(data, branding, EN_LABELS) });
}
