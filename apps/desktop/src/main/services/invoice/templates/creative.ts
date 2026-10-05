import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.page{padding:0}
.layout{display:flex;min-height:297mm}
.side{width:64mm;background:var(--accent);color:#fff;padding:16mm 10mm}
.side .logo{filter:brightness(0) invert(1);margin-bottom:14px}
.side .s-name{font-size:19px;font-weight:700;margin-bottom:10px}
.side .s-line,.side .s-legal{color:rgba(255,255,255,.82);font-size:11px;margin-bottom:2px}
.side .meta{margin-top:20px}
.side .m-row{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.25)}
.side .m-row span{color:rgba(255,255,255,.7)}
.main{flex:1;padding:16mm 12mm}
.main .doc-title{font-size:26px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin-bottom:16px}
.main .buyer{margin-bottom:18px}
.items thead th{color:var(--accent);border-bottom:2px solid var(--accent)}
.items tbody td{border-bottom:1px solid #eee}
.sum{display:flex;justify-content:flex-end;margin-top:14px}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="layout">
      <aside class="side">
        ${logo(branding)}
        ${sellerBlock(data, L)}
        ${metaBlock(data, L)}
      </aside>
      <main class="main">
        <div class="doc-title">${title(data, L)}</div>
        ${buyerBlock(data, L)}
        ${itemsTable(data, L)}
        <div class="sum">${totalsTable(data, L)}</div>
        ${wordsLine(data, L)}
        ${termsBlock(branding, L)}
        ${declaration(L)}
        ${signatory(data, branding, L)}
        ${footerNote(branding)}
      </main>
    </div>
  `;
  return a4Document({ accent: branding.accentColor, pageSize: branding.pageSize, style, body });
}
