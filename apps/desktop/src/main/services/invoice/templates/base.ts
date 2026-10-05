import type { InvoiceBranding } from '@muneem/contracts';
import { formatRupees } from '@muneem/domain';
import type { InvoiceData } from '../invoiceData.js';

export const money = (paise: number): string => formatRupees(paise);

export const esc = (s: string): string =>
  s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');

export function qty(qtyMilli: number, uomCode: string): string {
  const whole = Math.trunc(qtyMilli / 1000);
  const fraction = String(qtyMilli % 1000).padStart(3, '0').replace(/0+$/u, '');
  return `${fraction ? `${whole}.${fraction}` : whole} ${uomCode}`;
}

export function pct(gstRateBp: number): string {
  const r = gstRateBp / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(2)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const mi = Number(m) - 1;
  return y && d && mi >= 0 && mi < 12 ? `${d} ${MONTHS[mi]} ${y}` : iso;
}

// Only an embedded image data URL may be placed in the HTML; anything else (including one that could break the attribute) is dropped.
export function safeDataUrl(value: string | undefined): string {
  if (!value) return '';
  if (/^data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+/=]+$/u.test(value)) return value;
  // The upload stores raw base64 (no prefix); wrap it — the renderer content-sniffs the real type.
  if (/^[A-Za-z0-9+/=]+$/u.test(value) && value.length > 16) return `data:image/png;base64,${value}`;
  return '';
}

const A4_SIZE = { a4: { css: 'A4', minH: '297mm' }, a5: { css: 'A5', minH: '210mm' }, letter: { css: 'Letter', minH: '279mm' } } as const;
export type A4PageSize = keyof typeof A4_SIZE;

export interface Labels {
  taxInvoice: string; billOfSupply: string;
  invoiceNo: string; date: string; placeOfSupply: string;
  billTo: string; gstinLabel: string; panLabel: string; phoneLabel: string;
  sno: string; item: string; hsn: string; qty: string; rate: string; taxable: string;
  cgst: string; igst: string; cess: string; amount: string;
  subTotal: string; discount: string; roundOff: string; total: string; amountInWords: string;
  declarationText: string; authorisedSignatory: string; forSeller: string;
  terms: string; bank: string; paid: string;
}

export const EN_LABELS: Labels = {
  taxInvoice: 'Tax Invoice', billOfSupply: 'Bill of Supply',
  invoiceNo: 'Invoice No', date: 'Date', placeOfSupply: 'Place of Supply',
  billTo: 'Bill To', gstinLabel: 'GSTIN', panLabel: 'PAN', phoneLabel: 'Ph',
  sno: '#', item: 'Description', hsn: 'HSN', qty: 'Qty', rate: 'GST %', taxable: 'Taxable',
  cgst: 'CGST', igst: 'IGST', cess: 'Cess', amount: 'Amount',
  subTotal: 'Taxable Value', discount: 'Discount', roundOff: 'Round Off', total: 'Grand Total', amountInWords: 'Amount in words',
  declarationText: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  authorisedSignatory: 'Authorised Signatory', forSeller: 'For', terms: 'Terms & Conditions', bank: 'Bank Details', paid: 'Paid',
};

export const BILINGUAL_LABELS: Labels = {
  taxInvoice: 'कर बीजक / Tax Invoice', billOfSupply: 'आपूर्ति बिल / Bill of Supply',
  invoiceNo: 'बीजक सं. / Invoice No', date: 'दिनांक / Date', placeOfSupply: 'आपूर्ति स्थान / Place of Supply',
  billTo: 'ग्राहक / Bill To', gstinLabel: 'GSTIN', panLabel: 'PAN', phoneLabel: 'फ़ोन / Ph',
  sno: 'क्र. / #', item: 'विवरण / Description', hsn: 'HSN', qty: 'मात्रा / Qty', rate: 'GST %', taxable: 'कर योग्य / Taxable',
  cgst: 'CGST', igst: 'IGST', cess: 'उपकर / Cess', amount: 'राशि / Amount',
  subTotal: 'कर योग्य मूल्य / Taxable Value', discount: 'छूट / Discount', roundOff: 'पूर्णांकन / Round Off',
  total: 'कुल योग / Grand Total', amountInWords: 'शब्दों में / In words',
  declarationText: 'हम घोषित करते हैं कि यह बीजक वस्तुओं का वास्तविक मूल्य दर्शाता है तथा सभी विवरण सही हैं. / We declare that all particulars are true and correct.',
  authorisedSignatory: 'अधिकृत हस्ताक्षरी / Authorised Signatory', forSeller: 'कृते / For',
  terms: 'नियम व शर्तें / Terms', bank: 'बैंक विवरण / Bank Details', paid: 'भुगतान / Paid',
};

export function logo(branding: InvoiceBranding, cls = 'logo'): string {
  const url = safeDataUrl(branding.logoBase64);
  return url ? `<img class="${cls}" src="${url}" alt="logo">` : '';
}

export function sellerBlock(data: InvoiceData, labels: Labels): string {
  const s = data.seller;
  return `<div class="seller">
    <div class="s-name">${esc(s.name)}</div>
    ${s.legalName && s.legalName !== s.name ? `<div class="s-legal">${esc(s.legalName)}</div>` : ''}
    ${s.address ? `<div class="s-line">${esc(s.address)}</div>` : ''}
    ${s.phone ? `<div class="s-line">${esc(labels.phoneLabel)}: ${esc(s.phone)}</div>` : ''}
    ${s.gstin ? `<div class="s-line">${esc(labels.gstinLabel)}: <b>${esc(s.gstin)}</b></div>` : ''}
    ${s.pan ? `<div class="s-line">${esc(labels.panLabel)}: ${esc(s.pan)}</div>` : ''}
  </div>`;
}

export function buyerBlock(data: InvoiceData, labels: Labels): string {
  const b = data.buyer;
  const name = b.walkIn || !b.name ? 'Walk-in customer' : b.name;
  return `<div class="buyer">
    <div class="b-title">${esc(labels.billTo)}</div>
    <div class="b-name">${esc(name)}</div>
    ${b.address ? `<div class="b-line">${esc(b.address)}</div>` : ''}
    ${b.gstin ? `<div class="b-line">${esc(labels.gstinLabel)}: <b>${esc(b.gstin)}</b></div>` : ''}
  </div>`;
}

export function metaBlock(data: InvoiceData, labels: Labels): string {
  const row = (k: string, v: string) => `<div class="m-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  return `<div class="meta">
    ${row(labels.invoiceNo, data.invoiceNo)}
    ${row(labels.date, fmtDate(data.dateIso))}
    ${row(labels.placeOfSupply, data.placeOfSupply)}
  </div>`;
}

export function itemsTable(data: InvoiceData, labels: Labels): string {
  const inter = data.supplyType === 'inter';
  const hasCess = data.lines.some((l) => l.cessPaise > 0);
  const head = `<tr>
    <th>${esc(labels.sno)}</th><th class="l">${esc(labels.item)}</th><th>${esc(labels.hsn)}</th>
    <th class="n">${esc(labels.qty)}</th><th class="n">${esc(labels.rate)}</th><th class="n">${esc(labels.taxable)}</th>
    ${inter ? `<th class="n">${esc(labels.igst)}</th>` : `<th class="n">${esc(labels.cgst)}</th><th class="n">${esc(data.stateTaxLabel)}</th>`}
    ${hasCess ? `<th class="n">${esc(labels.cess)}</th>` : ''}
    <th class="n">${esc(labels.amount)}</th>
  </tr>`;
  const rows = data.lines.map((l, i) => `<tr>
    <td>${i + 1}</td><td class="l">${esc(l.name)}</td><td>${esc(l.hsn ?? '-')}</td>
    <td class="n">${esc(qty(l.qtyMilli, l.uomCode))}</td><td class="n">${pct(l.gstRateBp)}</td><td class="n">${money(l.taxablePaise)}</td>
    ${inter ? `<td class="n">${money(l.igstPaise)}</td>` : `<td class="n">${money(l.cgstPaise)}</td><td class="n">${money(l.sgstPaise)}</td>`}
    ${hasCess ? `<td class="n">${money(l.cessPaise)}</td>` : ''}
    <td class="n">${money(l.amountPaise)}</td>
  </tr>`).join('');
  return `<table class="items"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

export function totalsTable(data: InvoiceData, labels: Labels, opts: { grand?: boolean } = {}): string {
  const t = data.totals;
  const inter = data.supplyType === 'inter';
  const row = (k: string, v: string) => `<tr><td>${esc(k)}</td><td class="n">${v}</td></tr>`;
  const rows = [row(labels.subTotal, money(t.taxablePaise))];
  if (t.discountPaise > 0) rows.push(row(labels.discount, `-${money(t.discountPaise)}`));
  if (inter) { if (t.igstPaise > 0) rows.push(row(labels.igst, money(t.igstPaise))); }
  else {
    if (t.cgstPaise > 0) rows.push(row(labels.cgst, money(t.cgstPaise)));
    if (t.sgstPaise > 0) rows.push(row(data.stateTaxLabel, money(t.sgstPaise)));
  }
  if (t.cessPaise > 0) rows.push(row(labels.cess, money(t.cessPaise)));
  if (t.roundOffPaise !== 0) rows.push(row(labels.roundOff, money(t.roundOffPaise)));
  const grand = opts.grand === false ? '' : `<tr class="grand"><td>${esc(labels.total)}</td><td class="n">${money(t.totalPaise)}</td></tr>`;
  return `<table class="totals"><tbody>${rows.join('')}${grand}</tbody></table>`;
}

export function wordsLine(data: InvoiceData, labels: Labels): string {
  return `<div class="words"><span>${esc(labels.amountInWords)}:</span> ${esc(data.amountInWords)}</div>`;
}

export function declaration(labels: Labels): string {
  return `<div class="decl">${esc(labels.declarationText)}</div>`;
}

export function signatory(data: InvoiceData, branding: InvoiceBranding, labels: Labels): string {
  const sig = safeDataUrl(branding.signatureBase64);
  return `<div class="sign">
    <div class="sign-for">${esc(labels.forSeller)} ${esc(data.seller.legalName || data.seller.name)}</div>
    ${branding.showSignature && sig ? `<img class="sig-img" src="${sig}" alt="signature">` : '<div class="sig-gap"></div>'}
    ${branding.signatoryName ? `<div class="sign-name">${esc(branding.signatoryName)}</div>` : ''}
    <div class="sign-auth">${esc(labels.authorisedSignatory)}</div>
  </div>`;
}

export function termsBlock(branding: InvoiceBranding, labels: Labels): string {
  const parts: string[] = [];
  if (branding.terms) parts.push(`<div class="terms"><div class="t-h">${esc(labels.terms)}</div><div class="t-b">${esc(branding.terms)}</div></div>`);
  if (branding.bankDetails) parts.push(`<div class="bank"><div class="t-h">${esc(labels.bank)}</div><div class="t-b">${esc(branding.bankDetails)}</div></div>`);
  return parts.length ? `<div class="terms-wrap">${parts.join('')}</div>` : '';
}

export function footerNote(branding: InvoiceBranding): string {
  return `<div class="foot">${esc(branding.footerNote)}</div>`;
}

export const title = (data: InvoiceData, labels: Labels): string => (data.isTaxInvoice ? labels.taxInvoice : labels.billOfSupply);

const A4_RESET = `
*{box-sizing:border-box}
.page{font-size:12px;color:#1f2937;line-height:1.5}
.n{text-align:right;white-space:nowrap}
.l{text-align:left}
table{border-collapse:collapse;width:100%}
.items th,.items td{padding:6px 8px;vertical-align:top}
.items thead th{font-size:11px;text-transform:uppercase;letter-spacing:.03em;text-align:right}
.items thead th.l{text-align:left}
.s-name{font-weight:700}
.b-title,.t-h{text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#6b7280}
.m-row{display:flex;justify-content:space-between;gap:16px}
.logo{max-height:64px;max-width:200px;object-fit:contain}
.totals{width:auto;min-width:260px}
.totals td{padding:4px 8px}
.totals .grand td{font-weight:700;font-size:14px;border-top:2px solid var(--accent);color:var(--accent)}
.words{margin-top:10px;font-style:italic}
.decl{margin-top:12px;font-size:10px;color:#6b7280}
.sign{margin-top:28px;text-align:right}
.sig-img{max-height:56px;max-width:180px;display:block;margin-left:auto}
.sig-gap{height:44px}
.sign-auth{font-weight:600;border-top:1px solid #9ca3af;padding-top:4px;display:inline-block;margin-top:4px}
.foot{margin-top:12px;text-align:center;color:var(--accent);font-weight:600}
.terms-wrap{margin-top:14px;font-size:10px;color:#4b5563;display:flex;gap:24px;flex-wrap:wrap}
.terms-wrap>div{flex:1;min-width:180px}
`;

export function a4Document(o: { accent: string; style: string; body: string; lang?: string; pageSize?: A4PageSize }): string {
  const sz = A4_SIZE[o.pageSize ?? 'a4'];
  return `<!doctype html><html lang="${o.lang ?? 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice</title><style>
@page{size:${sz.css};margin:0}
html,body{margin:0;background:#fff}
:root{--accent:${o.accent}}
.page{min-height:${sz.minH};padding:14mm;background:#fff;font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','Noto Sans Devanagari',sans-serif}
${A4_RESET}
${o.style}
</style></head><body><div class="page">${o.body}</div></body></html>`;
}

export function thermalDocument(o: { accent: string; style: string; body: string; widthMm: 58 | 80 }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice</title><style>
@page{size:${o.widthMm}mm auto;margin:0}
html,body{margin:0;background:#fff}
:root{--accent:${o.accent}}
body{width:${o.widthMm}mm;padding:3mm;font-family:'DejaVu Sans Mono',Consolas,'Noto Sans Devanagari',monospace;color:#000;font-size:${o.widthMm === 58 ? '8.5px' : '10px'};line-height:1.35}
.c{text-align:center}.n{text-align:right}.l{text-align:left}
.sm{font-size:${o.widthMm === 58 ? '7.5px' : '9px'}}
.name{font-weight:700;font-size:${o.widthMm === 58 ? '11px' : '13px'}}
.title{font-weight:700;letter-spacing:.06em;margin:4px 0}
.row{display:flex;justify-content:space-between;gap:6px}
.grand{font-weight:700;font-size:${o.widthMm === 58 ? '10px' : '12px'};border-top:1px dashed #000;border-bottom:1px dashed #000;padding:2px 0;margin-top:2px}
hr{border:0;border-top:1px dashed #000;margin:4px 0}
table{border-collapse:collapse;width:100%}
.titems th{border-bottom:1px solid #000;font-size:${o.widthMm === 58 ? '7.5px' : '9px'};text-transform:uppercase}
.titems td{vertical-align:top;padding:1px 0}
.hsn{font-size:${o.widthMm === 58 ? '7px' : '8px'};color:#333}
.tlogo{max-height:40px;max-width:70%;object-fit:contain;margin:0 auto 2px;display:block}
.tsig{max-height:40px;max-width:60%;margin:2px auto;display:block}
.foot{margin-top:4px;font-weight:700}
${o.style}
</style></head><body>${o.body}</body></html>`;
}

// One compact receipt-style invoice body shared by the 80mm and 58mm rolls; carries every GST mandatory field.
export function thermalBody(data: InvoiceData, branding: InvoiceBranding, labels: Labels): string {
  const inter = data.supplyType === 'inter';
  const t = data.totals;
  const sig = safeDataUrl(branding.signatureBase64);
  const row = (k: string, v: string, cls = '') => `<div class="row ${cls}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  const taxRows = inter
    ? (t.igstPaise > 0 ? row(labels.igst, money(t.igstPaise)) : '')
    : `${t.cgstPaise > 0 ? row(labels.cgst, money(t.cgstPaise)) : ''}${t.sgstPaise > 0 ? row(data.stateTaxLabel, money(t.sgstPaise)) : ''}`;
  const lineRows = data.lines.map((l) => `<tr>
    <td class="l">${esc(l.name)}<div class="hsn">${l.hsn ? `HSN ${esc(l.hsn)} · ` : ''}GST ${pct(l.gstRateBp)}</div></td>
    <td class="n">${esc(qty(l.qtyMilli, l.uomCode))}</td><td class="n">${money(l.unitPricePaise)}</td><td class="n">${money(l.amountPaise)}</td>
  </tr>`).join('');
  const tenders = data.tenders.map((tn) => row(tn.method.toUpperCase(), money(tn.amountPaise), 'sm')).join('');
  return `
    ${logo(branding, 'tlogo')}
    <div class="c name">${esc(data.seller.name)}</div>
    ${data.seller.address ? `<div class="c sm">${esc(data.seller.address)}</div>` : ''}
    ${data.seller.gstin ? `<div class="c sm">${esc(labels.gstinLabel)}: ${esc(data.seller.gstin)}</div>` : ''}
    <div class="c title">${esc(title(data, labels))}</div>
    ${row(labels.invoiceNo, data.invoiceNo, 'sm')}
    ${row(labels.date, fmtDate(data.dateIso), 'sm')}
    ${row(labels.placeOfSupply, data.placeOfSupply, 'sm')}
    ${!data.buyer.walkIn && data.buyer.name ? row(labels.billTo, data.buyer.name, 'sm') : ''}
    ${data.buyer.gstin ? row(labels.gstinLabel, data.buyer.gstin, 'sm') : ''}
    <hr>
    <table class="titems"><thead><tr><th class="l">${esc(labels.item)}</th><th class="n">${esc(labels.qty)}</th><th class="n">${esc(labels.rate)}</th><th class="n">${esc(labels.amount)}</th></tr></thead><tbody>${lineRows}</tbody></table>
    <hr>
    ${row(labels.subTotal, money(t.taxablePaise), 'sm')}
    ${t.discountPaise > 0 ? row(labels.discount, `-${money(t.discountPaise)}`, 'sm') : ''}
    ${taxRows}
    ${t.cessPaise > 0 ? row(labels.cess, money(t.cessPaise), 'sm') : ''}
    ${t.roundOffPaise !== 0 ? row(labels.roundOff, money(t.roundOffPaise), 'sm') : ''}
    ${row(labels.total, money(t.totalPaise), 'grand')}
    <div class="sm">${esc(labels.amountInWords)}: ${esc(data.amountInWords)}</div>
    ${tenders}
    <hr>
    ${branding.showSignature && sig ? `<img class="tsig" src="${sig}" alt="signature">` : ''}
    ${branding.signatoryName ? `<div class="c sm">${esc(branding.signatoryName)}</div>` : ''}
    <div class="c sm">${esc(labels.authorisedSignatory)}</div>
    <div class="c foot">${esc(branding.footerNote)}</div>
  `;
}
