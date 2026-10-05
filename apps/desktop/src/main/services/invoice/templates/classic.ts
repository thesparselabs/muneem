import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.title-bar{text-align:center;font-size:20px;font-weight:700;letter-spacing:.12em;color:#fff;background:var(--accent);padding:10px;text-transform:uppercase}
.head-grid{display:flex;border:1px solid #1f2937;border-top:0}
.head-grid>div{flex:1;padding:10px 12px}
.head-grid .box-l{border-right:1px solid #1f2937}
.head-grid .logo{margin-bottom:6px}
.s-name{font-size:16px}
.meta{margin-bottom:8px}.m-row{padding:1px 0}
.items{margin-top:14px}
.items,.items th,.items td{border:1px solid #1f2937}
.items thead th{background:var(--accent);color:#fff}
.sum{display:flex;justify-content:flex-end;margin-top:0}
.totals,.totals td{border:1px solid #1f2937}
.totals .grand td{color:#111827}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="title-bar">${title(data, L)}</div>
    <div class="head-grid">
      <div class="box-l">${logo(branding)}${sellerBlock(data, L)}</div>
      <div class="box-r">${metaBlock(data, L)}${buyerBlock(data, L)}</div>
    </div>
    ${itemsTable(data, L)}
    <div class="sum">${totalsTable(data, L)}</div>
    ${wordsLine(data, L)}
    ${declaration(L)}
    ${termsBlock(branding, L)}
    ${signatory(data, branding, L)}
    ${footerNote(branding)}
  `;
  return a4Document({ accent: branding.accentColor, pageSize: branding.pageSize, style, body });
}
