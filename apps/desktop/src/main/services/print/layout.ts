import type { ReceiptDoc } from '@muneem/contracts';

export type Align = 'left' | 'center' | 'right';
export interface PrintLine { text: string; align: Align; bold?: boolean; double?: boolean }

const grouping = new Intl.NumberFormat('en-IN');
export const amount = (paise: number): string =>
  `${paise < 0 ? '-' : ''}${grouping.format(Math.trunc(Math.abs(paise) / 100))}.${String(Math.abs(paise) % 100).padStart(2, '0')}`;
const rate = (bp: number): string => `${Math.trunc(bp / 100)}${bp % 100 ? `.${String(bp % 100).padStart(2, '0').replace(/0$/u, '')}` : ''}%`;

const chunks = (word: string, width: number): string[] =>
  Array.from({ length: Math.ceil(word.length / width) }, (_, i) => word.slice(i * width, (i + 1) * width));

export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    for (const piece of word.length > width ? chunks(word, width) : [word]) {
      if (!line) line = piece;
      else if (line.length + 1 + piece.length <= width) line = `${line} ${piece}`;
      else { out.push(line); line = piece; }
    }
  }
  if (line) out.push(line);
  return out.length > 0 ? out : [''];
}

// Left text and right text on one row; the left side is cut short rather than pushing the amount off the paper.
export function columns(left: string, right: string, width: number): string {
  const room = Math.max(0, width - right.length - 1);
  const l = left.length > room ? left.slice(0, room) : left;
  return `${l}${' '.repeat(Math.max(1, width - l.length - right.length))}${right}`;
}

export function layoutReceipt(doc: ReceiptDoc, width: number): PrintLine[] {
  const out: PrintLine[] = [];
  const left = (text: string, bold = false) => out.push({ text, align: 'left', ...(bold && { bold }) });
  const center = (text: string, bold = false) => wrap(text, width).forEach((t) => out.push({ text: t, align: 'center', ...(bold && { bold }) }));
  const pair = (l: string, r: string, bold = false) => left(columns(l, r, width), bold);
  const rule = () => left('-'.repeat(width));

  wrap(doc.header.businessName, Math.floor(width / 2)).forEach((t) => out.push({ text: t, align: 'center', bold: true, double: true }));
  doc.header.lines.forEach((l) => center(l));
  if (doc.header.gstin) center(`GSTIN: ${doc.header.gstin}`);
  center(doc.title, true);
  if (doc.duplicate) center(`*** DUPLICATE (copy ${doc.copyNo}) ***`, true);
  left(`No: ${doc.docNumber}`);
  pair(`Date: ${doc.docDate}`, `Time: ${doc.time}`);
  pair(`Till: ${doc.terminalCode}`, `Cashier: ${doc.cashier}`);
  if (doc.customer) {
    wrap(`Customer: ${doc.customer.name}`, width).forEach((t) => left(t));
    if (doc.customer.gstin) left(`GSTIN: ${doc.customer.gstin}`);
    if (doc.customer.phone) left(`Ph: ${doc.customer.phone}`);
  }
  left(`Place of supply: ${doc.placeOfSupply}`);
  if (doc.against) left(`Against: ${doc.against.docNumber} of ${doc.against.docDate}`);
  if (doc.reason) wrap(`Reason: ${doc.reason}`, width).forEach((t) => left(t));
  rule();
  pair('Item', 'Amount', true);
  for (const l of doc.lines) {
    wrap(l.hsnCode ? `${l.name} (${l.hsnCode})` : l.name, width).forEach((t) => left(t));
    pair(`  ${l.qty} x ${amount(l.unitPricePaise)}`, amount(l.amountPaise));
    if (l.discountPaise > 0) pair('  Discount', `-${amount(l.discountPaise)}`);
  }
  rule();
  const t = doc.totals;
  pair('Gross', amount(t.grossPaise));
  if (t.discountPaise > 0) pair('Discount', `-${amount(t.discountPaise)}`);
  pair('Taxable value', amount(t.taxablePaise));
  if (t.cgstPaise) pair('CGST', amount(t.cgstPaise));
  if (t.sgstPaise) pair(t.stateTaxLabel, amount(t.sgstPaise));
  if (t.igstPaise) pair('IGST', amount(t.igstPaise));
  if (t.cessPaise) pair('Cess', amount(t.cessPaise));
  if (t.roundOffPaise) pair('Round off', amount(t.roundOffPaise));
  pair('TOTAL', `Rs ${amount(t.totalPaise)}`, true);
  rule();
  if (doc.taxSummary.length > 0) {
    pair('GST rate  Taxable', 'Tax', true);
    for (const r of doc.taxSummary) pair(`${rate(r.rateBp).padEnd(9)} ${amount(r.taxablePaise)}`, amount(r.cgstPaise + r.sgstPaise + r.igstPaise));
    rule();
  }
  for (const tn of doc.tenders) {
    pair(tn.method, amount(tn.amountPaise));
    if (tn.reference) left(`  Ref: ${tn.reference}`);
  }
  if (doc.changePaise > 0) pair('Change', amount(doc.changePaise), true);
  if (doc.credit) {
    pair('On credit', amount(doc.credit.amountPaise), true);
    left(`  Due: ${doc.credit.dueDate}`);
    pair('Balance now', amount(doc.credit.balancePaise));
  }
  if (doc.declaration) center(doc.declaration);
  doc.footer.forEach((f) => center(f));
  return out;
}

// The text copy cannot show double width, so a double line is simply centred like any other.
export function renderText(lines: readonly PrintLine[], width: number): string {
  return lines.map((l) => {
    const pad = Math.max(0, width - l.text.length);
    const text = l.align === 'center' ? `${' '.repeat(Math.floor(pad / 2))}${l.text}` : l.align === 'right' ? `${' '.repeat(pad)}${l.text}` : l.text;
    return text.trimEnd();
  }).join('\n') + '\n';
}
