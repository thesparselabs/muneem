import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  BILINGUAL_LABELS, a4Document, buyerBlock, declaration, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.page{font-family:'Noto Sans Devanagari','Nirmala UI','Noto Sans',Arial,sans-serif}
.tiranga{height:7px;background:linear-gradient(to right,#ff9933 0 33.3%,#ffffff 33.3% 66.6%,#138808 66.6% 100%);border:1px solid #e5e7eb;margin:-14mm -14mm 0}
.title-bar{text-align:center;font-weight:700;font-size:18px;color:#fff;background:var(--accent);padding:8px;letter-spacing:.04em;margin:0 -14mm 14px}
.head-grid{display:flex;border:1px solid #334155}
.head-grid>div{flex:1;padding:10px 12px}
.head-grid .box-l{border-right:1px solid #334155}
.items,.items th,.items td{border:1px solid #334155}
.items thead th{background:var(--accent);color:#fff;font-size:10px}
.sum{display:flex;justify-content:flex-end}
.totals,.totals td{border:1px solid #334155}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = BILINGUAL_LABELS;
  const body = `
    <div class="tiranga"></div>
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
  return a4Document({ accent: branding.accentColor, pageSize: branding.pageSize, style, body, lang: 'hi' });
}
