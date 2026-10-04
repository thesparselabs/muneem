import type { TaxTreatment } from '../types.js';
import { addInto, headsOf, ZERO_AMOUNTS } from './amounts.js';
import type { Gstr3b, Gstr3bCode, Gstr3bInwardRow, Gstr3bRow, InwardLine, NoteLine, OutwardLine, TaxAmounts } from './types.js';

export interface Gstr3bInput { regular: boolean; outward: readonly OutwardLine[]; notes: readonly NoteLine[]; inward: readonly InwardLine[] }

const DESCRIPTIONS: Readonly<Record<Gstr3bCode, string>> = {
  '3.1a': 'Outward taxable supplies (other than zero rated, nil rated and exempted)',
  '3.1b': 'Outward taxable supplies (zero rated)',
  '3.1c': 'Other outward supplies (nil rated, exempted)',
  '3.1d': 'Inward supplies (liable to reverse charge)',
  '3.1e': 'Non-GST outward supplies',
  '4A5': 'ITC available — all other ITC',
  '4B2': 'ITC reversed — others',
  '4C': 'Net ITC available (A) − (B)',
  '4D2': 'Ineligible ITC — others',
};

const OUTWARD_CODE: Readonly<Record<TaxTreatment, Gstr3bCode>> = { taxable: '3.1a', zero_rated: '3.1b', nil_rated: '3.1c', exempt: '3.1c', non_gst: '3.1e' };
const REVERSALS: ReadonlySet<InwardLine['kind']> = new Set(['debit_note', 'purchase_cancel', 'expense_cancel']);
const taxOnly = (a: TaxAmounts): TaxAmounts => ({ ...a, taxablePaise: 0 });

function outwardRows(outward: readonly OutwardLine[], notes: readonly NoteLine[]): Map<Gstr3bCode, TaxAmounts> {
  const rows = new Map<Gstr3bCode, TaxAmounts>((['3.1a', '3.1b', '3.1c', '3.1d', '3.1e'] as const).map((c) => [c, { ...ZERO_AMOUNTS }]));
  for (const l of outward) if (l.docBucket !== 'na') addInto(rows.get(OUTWARD_CODE[l.taxTreatment])!, l);
  for (const l of notes) if (l.saleBucket !== 'na') addInto(rows.get(OUTWARD_CODE[l.taxTreatment])!, l, -1);
  return rows;
}

// ITC: eligible tax claimed (4A), eligible tax reversed by debit notes and cancels (4B), and tax that was never claimable (4D).
function itcRows(inward: readonly InwardLine[]): Map<Gstr3bCode, TaxAmounts> {
  const a = { ...ZERO_AMOUNTS };
  const b = { ...ZERO_AMOUNTS };
  const d = { ...ZERO_AMOUNTS };
  for (const l of inward) {
    const reversal = REVERSALS.has(l.kind);
    if (l.itcEligible) addInto(reversal ? b : a, taxOnly(l));
    else addInto(d, taxOnly(l), reversal ? -1 : 1);
  }
  return new Map<Gstr3bCode, TaxAmounts>([['4A5', a], ['4B2', b], ['4C', addInto({ ...a }, b, -1)], ['4D2', d]]);
}

// Table 5: inward supplies that carry no tax, from purchases only (an expense does not say why it was untaxed).
function inwardRows(inward: readonly InwardLine[]): Gstr3bInwardRow[] {
  const exempt = { description: 'From a supplier under composition scheme, exempt and nil rated supply', interPaise: 0, intraPaise: 0 };
  const nonGst = { description: 'Non-GST supply', interPaise: 0, intraPaise: 0 };
  for (const l of inward) {
    if (l.kind === 'expense' || l.kind === 'expense_cancel') continue;
    const row = l.taxTreatment === 'non_gst' ? nonGst
      : l.supplierScheme === 'composition' || l.taxTreatment === 'nil_rated' || l.taxTreatment === 'exempt' ? exempt : null;
    if (!row) continue;
    const signed = (REVERSALS.has(l.kind) ? -1 : 1) * l.taxablePaise;
    if (l.supplyType === 'inter') row.interPaise += signed;
    else row.intraPaise += signed;
  }
  return [exempt, nonGst];
}

export function buildGstr3b(input: Gstr3bInput): Gstr3b {
  const outward = outwardRows(input.regular ? input.outward : [], input.regular ? input.notes : []);
  const itc = itcRows(input.regular ? input.inward : []);
  const rows: Gstr3bRow[] = [...outward, ...itc].map(([code, a]) => ({ code, description: DESCRIPTIONS[code], ...a }));
  const output = addInto({ ...outward.get('3.1a')! }, outward.get('3.1b')!);
  return {
    applicable: input.regular, rows, inward: inwardRows(input.regular ? input.inward : []), outputTax: headsOf(output), netItc: headsOf(itc.get('4C')!),
  };
}
