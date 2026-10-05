import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, esc, footerNote, itemsTable, logo, metaBlock, money, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.bold-head{background:var(--accent);color:#fff;padding:20px 24px;margin:-14mm -14mm 18px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.bold-head .s-name{font-size:26px;font-weight:800}
.bold-head .logo{max-height:56px;background:#fff;padding:5px 7px;border-radius:8px}
.bold-head .doc-title{font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;text-align:right}
.cols{display:flex;gap:22px;margin-bottom:16px}.cols>div{flex:1}
.b-title,.s-name.col{font-weight:800;color:var(--accent)}
.items thead th{background:#111827;color:#fff}
.items tbody td{border-bottom:1px solid #eceef1}
.sum{display:flex;justify-content:flex-end;margin-top:12px}
.grand-box{margin-top:14px;background:var(--accent);color:#fff;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;font-size:22px;font-weight:800;border-radius:2px}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="bold-head">
      <div class="bold-head-l">${logo(branding)}<div class="s-name">${esc(data.seller.name)}</div></div>
      <div class="doc-title">${title(data, L)}</div>
    </div>
    <div class="cols">
      <div>${sellerBlock(data, L)}</div>
      <div>${buyerBlock(data, L)}</div>
      <div>${metaBlock(data, L)}</div>
    </div>
    ${itemsTable(data, L)}
    <div class="sum">${totalsTable(data, L, { grand: false })}</div>
    <div class="grand-box"><span>${esc(L.total)}</span><span>${money(data.totals.totalPaise)}</span></div>
    ${wordsLine(data, L)}
    ${termsBlock(branding, L)}
    ${declaration(L)}
    ${signatory(data, branding, L)}
    ${footerNote(branding)}
  `;
  return a4Document({ accent: branding.accentColor, pageSize: branding.pageSize, style, body });
}
