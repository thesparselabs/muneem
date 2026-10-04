import type { Gstr1Bucket, TaxTreatment } from '../types.js';
import { addInto, groupBy, sumAmounts, ZERO_AMOUNTS } from './amounts.js';
import { uqcOf } from './codes.js';
import type {
  B2bRow, B2clRow, B2csRow, CdnrRow, CdnurRow, DocsRow, ExempKind, ExempRow, ExpRow, Gstr1, HsnRow, NoteLine, OutwardLine, SeriesIssued,
} from './types.js';

export interface Gstr1Input { regular: boolean; outward: readonly OutwardLine[]; notes: readonly NoteLine[]; series: readonly SeriesIssued[] }

const NON_TAXABLE: ReadonlySet<TaxTreatment> = new Set<TaxTreatment>(['nil_rated', 'exempt', 'non_gst']);
type OutwardSection = 'b2b' | 'b2cl' | 'b2cs' | 'exp' | 'exemp' | 'none';
type NoteSection = 'cdnr' | 'cdnur' | 'b2cs' | 'exemp' | 'none';

// ADR-0044: each line goes by its own treatment, so nil, exempt and non-GST lines leave a mixed invoice for the exempt table.
export function outwardSection(bucket: Gstr1Bucket, treatment: TaxTreatment): OutwardSection {
  if (bucket === 'na') return 'none';
  if (NON_TAXABLE.has(treatment)) return 'exemp';
  if (bucket === 'b2b' || bucket === 'b2cl') return bucket;
  return bucket === 'exports' ? 'exp' : 'b2cs';
}

// A note follows the invoice it reverses: B2B → CDNR, B2CL and exports → CDNUR, B2CS → B2CS as a negative (ADR-0044 as built).
export function noteSection(saleBucket: Gstr1Bucket, treatment: TaxTreatment): NoteSection {
  if (saleBucket === 'na') return 'none';
  if (NON_TAXABLE.has(treatment)) return 'exemp';
  if (saleBucket === 'b2b') return 'cdnr';
  return saleBucket === 'b2cl' || saleBucket === 'exports' ? 'cdnur' : 'b2cs';
}

const rateKey = (bp: number): string => String(bp).padStart(5, '0');
const blank = <T extends object>(o: T) => ({ ...o, ...ZERO_AMOUNTS });

function b2b(lines: readonly OutwardLine[]): B2bRow[] {
  return groupBy(lines, (l) => `${l.customerGstin}|${l.docDate}|${l.docNumber}|${l.docId}|${rateKey(l.gstRateBp)}`, (l) => blank({
    gstin: l.customerGstin ?? '', name: l.customerName ?? '', invoiceNumber: l.docNumber, invoiceDate: l.docDate, invoiceValuePaise: l.docValuePaise,
    placeOfSupply: l.placeOfSupply, rateBp: l.gstRateBp,
  }), (r, l) => addInto(r, l));
}

function b2cl(lines: readonly OutwardLine[]): B2clRow[] {
  return groupBy(lines, (l) => `${l.docDate}|${l.docNumber}|${l.docId}|${rateKey(l.gstRateBp)}`, (l) => blank({
    invoiceNumber: l.docNumber, invoiceDate: l.docDate, invoiceValuePaise: l.docValuePaise, placeOfSupply: l.placeOfSupply, rateBp: l.gstRateBp,
  }), (r, l) => addInto(r, l));
}

function b2cs(lines: readonly OutwardLine[], notes: readonly NoteLine[]): B2csRow[] {
  const signed = [...lines.map((l) => ({ l, sign: 1 })), ...notes.map((l) => ({ l, sign: -1 }))];
  return groupBy(signed, ({ l }) => `${l.placeOfSupply}|${rateKey(l.gstRateBp)}`, ({ l }) => blank({ placeOfSupply: l.placeOfSupply, rateBp: l.gstRateBp }),
    (r, { l, sign }) => addInto(r, l, sign));
}

function exp(lines: readonly OutwardLine[]): ExpRow[] {
  return groupBy(lines, (l) => `${l.docDate}|${l.docNumber}|${l.docId}|${rateKey(l.gstRateBp)}`, (l) => blank({
    exportType: 'WOPAY' as ExpRow['exportType'], invoiceNumber: l.docNumber, invoiceDate: l.docDate, invoiceValuePaise: l.docValuePaise, rateBp: l.gstRateBp,
  }), (r, l) => {
    addInto(r, l);
    if (r.igstPaise > 0) r.exportType = 'WPAY';
  });
}

function cdnr(notes: readonly NoteLine[]): CdnrRow[] {
  return groupBy(notes, (l) => `${l.customerGstin}|${l.docDate}|${l.docNumber}|${l.docId}|${rateKey(l.gstRateBp)}`, (l) => blank({
    gstin: l.customerGstin ?? '', name: l.customerName ?? '', noteNumber: l.docNumber, noteDate: l.docDate, placeOfSupply: l.placeOfSupply,
    noteValuePaise: l.docValuePaise, rateBp: l.gstRateBp,
  }), (r, l) => addInto(r, l));
}

function cdnur(notes: readonly NoteLine[]): CdnurRow[] {
  return groupBy(notes, (l) => `${l.docDate}|${l.docNumber}|${l.docId}|${rateKey(l.gstRateBp)}`, (l) => blank({
    urType: (l.saleBucket === 'exports' ? 'EXPWOP' : 'B2CL') as CdnurRow['urType'], noteNumber: l.docNumber, noteDate: l.docDate,
    placeOfSupply: l.placeOfSupply, noteValuePaise: l.docValuePaise, rateBp: l.gstRateBp,
  }), (r, l) => {
    addInto(r, l);
    if (r.urType !== 'B2CL' && r.igstPaise > 0) r.urType = 'EXPWP';
  });
}

const EXEMP_KINDS: readonly ExempKind[] = ['inter_registered', 'intra_registered', 'inter_unregistered', 'intra_unregistered'];
const exempKind = (l: OutwardLine): ExempKind => `${l.supplyType}_${l.customerGstin ? 'registered' : 'unregistered'}`;

function exemp(lines: readonly OutwardLine[], notes: readonly NoteLine[]): ExempRow[] {
  const rows = new Map(EXEMP_KINDS.map((kind): [ExempKind, ExempRow] => [kind, { kind, nilPaise: 0, exemptPaise: 0, nonGstPaise: 0 }]));
  const add = (l: OutwardLine, sign: number) => {
    const r = rows.get(exempKind(l))!;
    if (l.taxTreatment === 'nil_rated') r.nilPaise += sign * l.taxablePaise;
    else if (l.taxTreatment === 'exempt') r.exemptPaise += sign * l.taxablePaise;
    else r.nonGstPaise += sign * l.taxablePaise;
  };
  lines.forEach((l) => add(l, 1));
  notes.forEach((l) => add(l, -1));
  return [...rows.values()];
}

// HSN summary net of credit notes, split by recipient (registered or not), with each unit's UQC.
function hsn(lines: readonly OutwardLine[], notes: readonly NoteLine[]): HsnRow[] {
  const signed = [...lines.map((l) => ({ l, sign: 1 })), ...notes.map((l) => ({ l, sign: -1 }))];
  const recipient = (l: OutwardLine): HsnRow['recipient'] => (l.customerGstin ? 'b2b' : 'b2c');
  return groupBy(signed, ({ l }) => `${recipient(l)}|${l.hsnCode ?? ''}|${uqcOf(l.uomCode)}|${rateKey(l.gstRateBp)}`, ({ l }) => blank({
    recipient: recipient(l), hsn: l.hsnCode ?? '', uqc: uqcOf(l.uomCode), qtyMilli: 0, totalValuePaise: 0, rateBp: l.gstRateBp,
  }), (r, { l, sign }) => {
    addInto(r, l, sign);
    r.qtyMilli += sign * l.qtyMilli;
    r.totalValuePaise += sign * (l.taxablePaise + l.igstPaise + l.cgstPaise + l.sgstPaise + l.cessPaise);
  });
}

// Documents issued by series; a number missing from a series' range counts as cancelled.
function docs(series: readonly SeriesIssued[]): DocsRow[] {
  return [...series].sort((a, b) => (a.nature === b.nature ? (a.firstNumber < b.firstNumber ? -1 : 1) : a.nature === 'invoice' ? -1 : 1)).map((s) => {
    const total = s.lastSeq - s.firstSeq + 1;
    return { nature: s.nature, from: s.firstNumber, to: s.lastNumber, total, cancelled: total - (s.issued - s.cancelled) };
  });
}

function missingHsn(lines: readonly OutwardLine[]): Gstr1['missingHsn'] {
  return groupBy(lines.filter((l) => !l.hsnCode), (l) => l.docNumber, (l) => ({ docNumber: l.docNumber, count: 0 }), (r) => { r.count += 1; });
}

const EMPTY: Gstr1 = { applicable: false, b2b: [], b2cl: [], b2cs: [], cdnr: [], cdnur: [], exp: [], exemp: [], hsn: [], docs: [], net: { ...ZERO_AMOUNTS }, missingHsn: [] };

export function buildGstr1(input: Gstr1Input): Gstr1 {
  if (!input.regular) return { ...EMPTY };
  const out = (s: OutwardSection) => input.outward.filter((l) => outwardSection(l.docBucket, l.taxTreatment) === s);
  const note = (s: NoteSection) => input.notes.filter((l) => noteSection(l.saleBucket, l.taxTreatment) === s);
  const reported = input.outward.filter((l) => l.docBucket !== 'na');
  const reportedNotes = input.notes.filter((l) => l.saleBucket !== 'na');
  const result: Gstr1 = {
    applicable: true,
    b2b: b2b(out('b2b')), b2cl: b2cl(out('b2cl')), b2cs: b2cs(out('b2cs'), note('b2cs')), cdnr: cdnr(note('cdnr')), cdnur: cdnur(note('cdnur')),
    exp: exp(out('exp')), exemp: exemp(out('exemp'), note('exemp')), hsn: hsn(reported, reportedNotes), docs: docs(input.series),
    net: { ...ZERO_AMOUNTS }, missingHsn: missingHsn([...reported, ...reportedNotes]),
  };
  result.net = addInto(sumAmounts([...result.b2b, ...result.b2cl, ...result.b2cs, ...result.exp]), sumAmounts([...result.cdnr, ...result.cdnur]), -1);
  return result;
}
