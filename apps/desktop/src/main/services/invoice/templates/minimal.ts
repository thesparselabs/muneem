import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid var(--accent);padding-bottom:16px;margin-bottom:22px}
.hd-l .s-name{font-size:22px;font-weight:600;letter-spacing:-.01em}
.hd-l .s-line,.hd-l .s-legal{color:#6b7280;font-size:11px}
.doc-title{font-size:24px;font-weight:300;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);text-align:right}
.hd-r .meta{margin-top:12px;min-width:220px}
.hd-r .m-row span{color:#9ca3af}
.buyer{margin-bottom:22px}.b-name{font-size:15px;font-weight:600}
.items thead th{border-bottom:2px solid #e5e7eb;color:#9ca3af;padding-bottom:8px}
.items tbody td{border-bottom:1px solid #f3f4f6;padding-top:10px;padding-bottom:10px}
.sum{display:flex;justify-content:flex-end;margin-top:16px}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="hd">
      <div class="hd-l">${logo(branding)}${sellerBlock(data, L)}</div>
      <div class="hd-r"><div class="doc-title">${title(data, L)}</div>${metaBlock(data, L)}</div>
    </div>
    ${buyerBlock(data, L)}
    ${itemsTable(data, L)}
    <div class="sum">${totalsTable(data, L)}</div>
    ${wordsLine(data, L)}
    ${termsBlock(branding, L)}
    ${declaration(L)}
    ${signatory(data, branding, L)}
    ${footerNote(branding)}
  `;
  return a4Document({ accent: branding.accentColor, pageSize: branding.pageSize, style, body });
}
