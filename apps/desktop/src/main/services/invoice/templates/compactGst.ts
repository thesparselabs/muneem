import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.page{font-size:10.5px}
.cg-title{text-align:center;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.08em;border:1px solid #000;border-bottom:0;padding:5px;background:#f2f2f2}
.cg-top{display:flex;border:1px solid #000}
.cg-top>div{padding:6px 8px}
.cg-top .c1{flex:1;border-right:1px solid #000}
.cg-top .c2{width:42%}
.cg-top .s-name{font-size:13px}
.cg-buyer{border:1px solid #000;border-top:0;padding:6px 8px}
.items{margin-top:0}
.items th,.items td{border:1px solid #000;padding:3px 5px;font-size:10px}
.items thead th{background:#f2f2f2}
.sum{display:flex;justify-content:flex-end}
.totals,.totals td{border:1px solid #000;padding:3px 6px}
.totals .grand td{font-size:12px}
.decl,.words{font-size:9.5px}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="cg-title">${title(data, L)}</div>
    <div class="cg-top">
      <div class="c1">${logo(branding)}${sellerBlock(data, L)}</div>
      <div class="c2">${metaBlock(data, L)}</div>
    </div>
    <div class="cg-buyer">${buyerBlock(data, L)}</div>
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
