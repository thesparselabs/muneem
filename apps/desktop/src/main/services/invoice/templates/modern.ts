import type { InvoiceBranding } from '@muneem/contracts';
import type { InvoiceData } from '../invoiceData.js';
import {
  EN_LABELS, a4Document, buyerBlock, declaration, esc, footerNote, itemsTable, logo, metaBlock, sellerBlock, signatory, termsBlock, title, totalsTable, wordsLine,
} from './base.js';

const style = `
.band{background:var(--accent);color:#fff;padding:22px 24px;margin:-14mm -14mm 20px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.band .b-name{font-size:24px;font-weight:800;letter-spacing:-.01em}
.band .logo{max-height:52px;background:#fff;padding:5px 7px;border-radius:8px}
.band .doc-title{font-size:18px;text-transform:uppercase;letter-spacing:.12em;text-align:right}
.band .inv-no{text-align:right;opacity:.9;font-size:13px}
.cols{display:flex;gap:22px;margin-bottom:18px}.cols>div{flex:1}
.items thead th{background:#f3f4f6;color:#374151}
.items tbody tr:nth-child(even){background:#fafafa}
.items td,.items th{border-bottom:1px solid #eef0f2}
.sum{display:flex;justify-content:flex-end;margin-top:14px}
`;

export function render(data: InvoiceData, branding: InvoiceBranding): string {
  const L = EN_LABELS;
  const body = `
    <div class="band">
      <div class="band-l">${logo(branding)}<div class="b-name">${esc(data.seller.name)}</div></div>
      <div class="band-r"><div class="doc-title">${title(data, L)}</div><div class="inv-no">#${esc(data.invoiceNo)}</div></div>
    </div>
    <div class="cols">
      <div>${sellerBlock(data, L)}</div>
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
