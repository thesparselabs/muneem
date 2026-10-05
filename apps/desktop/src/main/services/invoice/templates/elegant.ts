import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.page{font-family:Georgia,'Times New Roman','Noto Serif',serif;color:#2b2b2b}
.el-head{text-align:center;border-bottom:1px solid var(--accent);padding-bottom:16px;margin-bottom:20px}
.el-head .logo{margin:0 auto 8px}
.el-head .s-name{font-size:22px;font-weight:600;letter-spacing:.02em}
.el-head .s-line,.el-head .s-legal{color:#6b6b6b;font-size:11px}
.doc-title{font-size:26px;font-weight:400;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.parties{display:flex;justify-content:space-between;gap:24px;margin-bottom:18px}
.parties>div{flex:1}
.items thead th{background:transparent;border-bottom:2px solid var(--accent);color:var(--accent)}
.items tbody td{border-bottom:1px solid #ededed}
.sum{display:flex;justify-content:flex-end;margin-top:16px}
.totals .grand td{font-style:italic}
.words{font-style:italic;color:#555}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="el-head">
      <div class="doc-title">${title(data, L)}</div>
      ${logo(branding)}
      ${sellerBlock(data, L)}
    </div>
    <div class="parties">
      <div>${buyerBlock(data, L)}</div>
      <div>${metaBlock(data, L)}</div>
    </div>
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
