import type { Gstr1, TaxAmounts } from '../../src/index.js';
import { cell, qty, rate, rupees } from './format.js';
import type { PostedJournal, ScenarioFile } from './types.js';

type FileScenario = ScenarioFile['scenarios'][number];

const NUMERIC = new Set(['Qty', 'Price', 'Line disc.', 'Bill disc. share', 'Taxable', 'CGST', 'SGST', 'SGST/UTGST', 'IGST', 'Cess', 'Line total', 'Round-off',
  'Value', 'To account', 'Refunded', 'ITC claimed', 'Total', 'Total value', 'Rate', 'Nil-rated', 'Exempt', 'Non-GST', 'Inter-state', 'Intra-state', 'Dr', 'Cr', 'Cancelled']);
const table = (head: string[], rows: string[][]): string[] =>
  rows.length === 0 ? [] : [`| ${head.join(' | ')} |`, `|${head.map((h) => (NUMERIC.has(h) ? '---:' : '---')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
const heads = (a: TaxAmounts): string[] => [cell(a.taxablePaise), cell(a.cgstPaise), cell(a.sgstPaise), cell(a.igstPaise), cell(a.cessPaise)];
const AMOUNT_HEAD = ['Taxable', 'CGST', 'SGST/UTGST', 'IGST', 'Cess'];
const discount = (d: { kind: string; value: number } | undefined): string => (!d || d.value === 0 ? '' : d.kind === 'percent' ? rate(d.value) : `₹${rupees(d.value)}`);

function sales(s: FileScenario): string[] {
  const out: string[] = [];
  for (const sale of s.sales ?? []) {
    const inv = s.expected.invoices.find((i) => i.ref === sale.ref)!;
    const r = inv.result;
    const who = sale.customer ? `${sale.customer.name}${sale.customer.gstin ? `, GSTIN ${sale.customer.gstin}` : ''}` : 'walk-in';
    out.push('', `**${sale.ref} — ${inv.input.docType === 'tax_invoice' ? 'tax invoice' : 'bill of supply'} ${sale.number}** of ${sale.date}, ${who}; `
      + `place of supply ${inv.input.placeOfSupplyStateCode} (${r.supplyType}-state); GSTR-1 bucket \`${r.gstr1Bucket}\`.`
      + (sale.billDiscount ? ` Bill discount ${discount(sale.billDiscount)}.` : ''), '');
    out.push(...table(['Item', 'HSN', 'Qty', 'Price', 'Line disc.', 'Bill disc. share', ...AMOUNT_HEAD, 'Line total'], sale.lines.map((l, i) => {
      const x = r.lines[i]!;
      const treatment = l.item.treatment && l.item.treatment !== 'taxable' ? ` (${l.item.treatment.replace('_', '-')})` : ` @ ${rate(l.item.rateBp)}`;
      return [`${l.item.name}${treatment}`, l.item.hsn, `${qty(l.qtyMilli)} ${l.item.uom}`, `${rupees(l.unitPricePaise)}${l.inclusive ? ' incl.' : ''}`,
        cell(x.lineDiscountPaise), cell(x.apportionedBillDiscountPaise), ...heads(x), rupees(x.totalPaise)];
    })));
    out.push('', `Round-off ${rupees(r.roundOffPaise)}; **invoice value ₹${rupees(r.totalPaise)}**.`);
  }
  return out;
}

function creditNotes(s: FileScenario): string[] {
  return table(['Note', 'Against', 'Returned', ...AMOUNT_HEAD, 'Round-off', 'Value', 'To account', 'Refunded'], (s.creditNotes ?? []).map((cn) => {
    const r = s.expected.creditNotes.find((x) => x.ref === cn.ref)!;
    const sale = s.sales!.find((x) => x.ref === cn.saleRef)!;
    return [`${cn.ref} ${cn.number}`, sale.number, cn.lines.map((l) => `${qty(l.qtyMilli)} × ${sale.lines[l.line]!.item.name}`).join('; '), ...heads(r.result),
      cell(r.result.roundOffPaise), rupees(r.result.totalPaise), cell(r.toAccountPaise), r.refundPaise ? `${rupees(r.refundPaise)} ${cn.refundBy}` : ''];
  }));
}

function inward(s: FileScenario): string[] {
  const rows: string[][] = [];
  for (const p of s.purchases ?? []) {
    const r = s.expected.invoices.find((i) => i.ref === p.ref)!.result;
    const pr = s.expected.purchases.find((x) => x.ref === p.ref)!;
    rows.push([`${p.ref} purchase ${p.supplierInvoiceNo}`, `${p.supplier.name} (${p.supplier.scheme ?? 'regular'}, ${p.supplier.stateCode})`, ...heads(r),
      `${rupees(pr.itc.cgstPaise + pr.itc.sgstPaise + pr.itc.igstPaise + pr.itc.cessPaise)}`, rupees(pr.totalPaise)]);
  }
  for (const d of s.expected.debitNotes) {
    rows.push([`${d.ref} debit note`, `against ${d.purchaseRef}`, ...heads(d), rupees(-(d.itcReversed.cgstPaise + d.itcReversed.sgstPaise + d.itcReversed.igstPaise + d.itcReversed.cessPaise)), rupees(d.totalPaise)]);
  }
  for (const e of s.expenses ?? []) {
    const inv = s.expected.invoices.find((i) => i.ref === e.ref)?.result;
    const amounts = inv ?? { taxablePaise: e.amountPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0, totalPaise: e.amountPaise };
    const claimed = s.expected.itcRegister.find((x) => x.docNumber === e.number)!.eligible;
    rows.push([`${e.ref} expense ${e.accountCode}`, `${e.vendor.name}${e.vendor.gstin ? '' : ' (no GSTIN)'}`, ...heads(amounts),
      rupees(claimed.cgstPaise + claimed.sgstPaise + claimed.igstPaise + claimed.cessPaise), rupees(amounts.totalPaise)]);
  }
  return table(['Document', 'Supplier', ...AMOUNT_HEAD, 'ITC claimed', 'Total'], rows);
}

function gstr1(g: Gstr1): string[] {
  if (!g.applicable) return ['', 'GSTR-1: not applicable (not a regular-scheme business).'];
  const out: string[] = [];
  const section = (title: string, lines: string[]) => { if (lines.length > 0) out.push('', `*${title}*`, '', ...lines); };
  section('B2B (4A)', table(['GSTIN', 'Invoice', 'Value', 'POS', 'Rate', ...AMOUNT_HEAD], g.b2b.map((r) =>
    [r.gstin, r.invoiceNumber, rupees(r.invoiceValuePaise), r.placeOfSupply, rate(r.rateBp), ...heads(r)])));
  section('B2CL (5)', table(['Invoice', 'Value', 'POS', 'Rate', ...AMOUNT_HEAD], g.b2cl.map((r) => [r.invoiceNumber, rupees(r.invoiceValuePaise), r.placeOfSupply, rate(r.rateBp), ...heads(r)])));
  section('B2CS (7)', table(['POS', 'Rate', ...AMOUNT_HEAD], g.b2cs.map((r) => [r.placeOfSupply, rate(r.rateBp), ...heads(r)])));
  section('CDNR (9B, registered)', table(['GSTIN', 'Note', 'Value', 'Rate', ...AMOUNT_HEAD], g.cdnr.map((r) => [r.gstin, r.noteNumber, rupees(r.noteValuePaise), rate(r.rateBp), ...heads(r)])));
  section('CDNUR (9B, unregistered)', table(['Type', 'Note', 'Value', 'POS', 'Rate', ...AMOUNT_HEAD], g.cdnur.map((r) => [r.urType, r.noteNumber, rupees(r.noteValuePaise), r.placeOfSupply, rate(r.rateBp), ...heads(r)])));
  section('Nil, exempt and non-GST (8)', table(['Kind', 'Nil-rated', 'Exempt', 'Non-GST'], g.exemp.filter((r) => r.nilPaise || r.exemptPaise || r.nonGstPaise)
    .map((r) => [r.kind.replace('_', '-state, '), cell(r.nilPaise), cell(r.exemptPaise), cell(r.nonGstPaise)])));
  section('HSN summary (12)', table(['Recipient', 'HSN', 'UQC', 'Qty', 'Rate', 'Total value', ...AMOUNT_HEAD], g.hsn.map((r) =>
    [r.recipient.toUpperCase(), r.hsn, r.uqc, qty(r.qtyMilli), rate(r.rateBp), rupees(r.totalValuePaise), ...heads(r)])));
  section('Documents issued (13)', table(['Nature', 'From', 'To', 'Total', 'Cancelled'], g.docs.map((r) => [r.nature.replace('_', ' '), r.from, r.to, String(r.total), String(r.cancelled)])));
  return out;
}

function gstr3b(s: FileScenario): string[] {
  const g = s.expected.gstr3b;
  if (!g.applicable) return [];
  const rows = g.rows.filter((r) => r.taxablePaise || r.igstPaise || r.cgstPaise || r.sgstPaise || r.cessPaise);
  const inward = g.inward.filter((r) => r.interPaise || r.intraPaise);
  return ['', '*GSTR-3B*', '', ...table(['Table', 'Description', ...AMOUNT_HEAD], rows.map((r) => [r.code, r.description, ...heads(r)])),
    ...(inward.length ? ['', ...table(['Table 5', 'Inter-state', 'Intra-state'], inward.map((r) => [r.description, cell(r.interPaise), cell(r.intraPaise)]))] : [])];
}

function setoff(s: FileScenario): string[] {
  const so = s.expected.setoff;
  if (!so) return [];
  const u = so.result.utilisation;
  const moves = ([['IGST → IGST', u.igstToIgstPaise], ['IGST → CGST', u.igstToCgstPaise], ['IGST → SGST', u.igstToSgstPaise], ['CGST → CGST', u.cgstToCgstPaise],
    ['CGST → IGST', u.cgstToIgstPaise], ['SGST → SGST', u.sgstToSgstPaise], ['SGST → IGST', u.sgstToIgstPaise], ['Cess → cess', u.cessToCessPaise]] as const)
    .filter(([, v]) => v > 0).map(([k, v]) => `${k} ${rupees(v)}`);
  const h = (x: typeof so.liability) => [cell(x.igstPaise), cell(x.cgstPaise), cell(x.sgstPaise), cell(x.cessPaise)];
  return ['', '*Set-off*', '', ...table(['', 'IGST', 'CGST', 'SGST', 'Cess'], [
    ['Liability (output)', ...h(so.liability)], ['Credit (input)', ...h(so.credit)], ['Paid in cash', ...h(so.result.cash)], ['Credit carried forward', ...h(so.result.creditLeft)],
  ]), '', `Credit used, in order: ${moves.join('; ') || 'none'}.`];
}

function journals(js: readonly PostedJournal[]): string[] {
  return table(['Document', 'Date', 'Dr', 'Cr', 'Account'], js.flatMap((j) => j.lines.map((l, i) =>
    [i === 0 ? j.ref : '', i === 0 ? j.date : '', l.side === 'Dr' ? rupees(l.paise) : '', l.side === 'Cr' ? rupees(l.paise) : '', `${l.code} ${l.account}${l.party ? ` (${l.party})` : ''}`])));
}

export function scenarioWorkbookMarkdown(file: ScenarioFile): string {
  const out = [
    '# Golden tax scenarios — workbook (generated)',
    '',
    'Generated from `packages/domain/fixtures/compliance/scenarios.json` by `pnpm --filter @muneem/domain gen:compliance`. Do not edit',
    'by hand: `packages/domain/test/complianceDocs.test.ts` fails when this file and the fixtures differ. Every scenario\'s key',
    'numbers were worked out by hand and are asserted against the engines (TypeScript on the shop\'s computer, Go on the server)',
    'before the file is written; the tables below are what the engines compute. Amounts are rupees; a blank cell is zero.',
  ];
  for (const s of file.scenarios) {
    const title = s.name.replace(/^HAND /u, '');
    out.push('', `## ${title}`, '', s.story, '', `*Business:* ${s.business.name}, state ${s.business.stateCode}, ${s.business.scheme} scheme`
      + `${s.business.roundToRupee ? ', bills rounded to the rupee' : ''}.`);
    out.push(...sales(s));
    const notes = creditNotes(s);
    if (notes.length) out.push('', '*Credit notes*', '', ...notes);
    const inw = inward(s);
    if (inw.length) out.push('', '*Purchases, debit notes and expenses*', '', ...inw);
    if (s.sales?.length || s.creditNotes?.length) out.push(...gstr1(s.expected.gstr1));
    out.push(...gstr3b(s), ...setoff(s), '', '*Journals*', '', ...journals(s.expected.journals));
  }
  return out.join('\n') + '\n';
}
