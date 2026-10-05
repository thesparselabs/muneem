import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { addInto, gstTieOuts, sumAmounts, ZERO_AMOUNTS, type TaxAmounts } from '../src/index.js';
import { handMismatches } from '../scripts/compliance/fixtures.js';
import { runScenario, taxBalances } from '../scripts/compliance/run.js';
import { SCENARIOS } from '../scripts/compliance/scenarios.js';
import type { ScenarioFile, ScenarioResult } from '../scripts/compliance/types.js';

// The golden tax scenario suite (Stage 9h); cloud/internal/domain/compliance runs the same file through the Go engines.
const file = JSON.parse(readFileSync(new URL('../fixtures/compliance/scenarios.json', import.meta.url), 'utf8')) as ScenarioFile;

const amounts = (a: TaxAmounts): TaxAmounts =>
  ({ taxablePaise: a.taxablePaise, igstPaise: a.igstPaise, cgstPaise: a.cgstPaise, sgstPaise: a.sgstPaise, cessPaise: a.cessPaise });

// What the documents themselves say went out, net of credit notes: sales the return covers, less their notes.
function documentTotals(r: ScenarioResult): TaxAmounts {
  const reported = new Set(r.invoices.filter((i) => i.kind === 'sale' && i.result.gstr1Bucket !== 'na').map((i) => i.ref));
  const sales = r.invoices.filter((i) => reported.has(i.ref)).flatMap((i) => i.result.lines);
  const notes = r.creditNotes.filter((n) => reported.has(n.saleRef)).flatMap((n) => n.result.lines);
  return addInto(sumAmounts(sales.map(amounts)), sumAmounts(notes.map(amounts)), -1);
}

function hsnByCode(r: ScenarioResult, s: ScenarioFile['scenarios'][number]): Map<string, TaxAmounts & { qtyMilli: number }> {
  const by = new Map<string, TaxAmounts & { qtyMilli: number }>();
  const add = (key: string, a: TaxAmounts, qtyMilli: number, sign: number) => {
    const row = by.get(key) ?? { ...ZERO_AMOUNTS, qtyMilli: 0 };
    addInto(row, a, sign);
    row.qtyMilli += sign * qtyMilli;
    by.set(key, row);
  };
  for (const sale of s.sales ?? []) {
    const inv = r.invoices.find((i) => i.ref === sale.ref)!;
    if (inv.result.gstr1Bucket === 'na') continue;
    sale.lines.forEach((l, i) => add(`${l.item.hsn}|${l.item.rateBp}`, inv.result.lines[i]!, l.qtyMilli, 1));
    for (const cn of (s.creditNotes ?? []).filter((n) => n.saleRef === sale.ref)) {
      const res = r.creditNotes.find((n) => n.ref === cn.ref)!.result;
      cn.lines.forEach((l, k) => add(`${sale.lines[l.line]!.item.hsn}|${sale.lines[l.line]!.item.rateBp}`, res.lines[k]!, l.qtyMilli, -1));
    }
  }
  return by;
}

const isLedgerOnly = (ref: string) => ref === 'SETOFF' || ref === 'CHALLAN' || ref.startsWith('CL/');

describe('golden tax scenarios (shared with Go)', () => {
  it('covers the compliance cases, every one hand-checked', () => {
    expect(file.scenarios.map((s) => s.name)).toEqual(SCENARIOS.map((s) => s.name));
    expect(file.scenarios.length).toBeGreaterThanOrEqual(12);
    for (const s of file.scenarios) {
      expect(s.name.startsWith('HAND')).toBe(true);
      expect(Object.keys(s.hand.values).length + Object.keys(s.hand.journals).length).toBeGreaterThan(5);
    }
  });

  it('reports a hand value the engines do not reproduce', () => {
    const s = file.scenarios[0]!;
    const wrong = { ...s, hand: { values: { 'invoices.S1.result.totalPaise': 1 }, journals: { S1: ['Dr 1100 1.00'] } } };
    expect(handMismatches(wrong, s.expected)).toHaveLength(2);
  });

  for (const s of file.scenarios) {
    describe(s.name, () => {
      const r = runScenario(s);

      it('reproduces the frozen results and the HAND values', () => {
        expect(r).toEqual(s.expected);
        expect(handMismatches(s, r)).toEqual([]);
      });

      it('every invoice re-sums: lines to the invoice, tax halves and round-off to the total', () => {
        for (const { result } of r.invoices) {
          for (const l of result.lines) expect(l.totalPaise).toBe(l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise + l.cessPaise);
          expect(result.totalPaise).toBe(result.lines.reduce((t, l) => t + l.totalPaise, 0) + result.roundOffPaise);
        }
      });

      it('HSN summary = Σ invoice lines, net of credit notes, for every HSN and rate', () => {
        const fromRows = new Map<string, TaxAmounts & { qtyMilli: number }>();
        for (const h of r.gstr1.hsn) {
          const row = fromRows.get(`${h.hsn}|${h.rateBp}`) ?? { ...ZERO_AMOUNTS, qtyMilli: 0 };
          addInto(row, h);
          row.qtyMilli += h.qtyMilli;
          fromRows.set(`${h.hsn}|${h.rateBp}`, row);
          expect(h.totalValuePaise).toBe(h.taxablePaise + h.igstPaise + h.cgstPaise + h.sgstPaise + h.cessPaise);
        }
        expect(fromRows).toEqual(hsnByCode(r, s));
      });

      it('GSTR-1 totals = Σ invoices less Σ credit notes, and GSTR-3B section 3.1 agrees', () => {
        const docs = documentTotals(r);
        const g = r.gstr1;
        const exempt = g.exemp.reduce((t, e) => t + e.nilPaise + e.exemptPaise + e.nonGstPaise, 0);
        const outward = sumAmounts([...g.b2b, ...g.b2cl, ...g.b2cs, ...g.exp].map(amounts));
        const notes = sumAmounts([...g.cdnr, ...g.cdnur].map(amounts));
        expect(outward.taxablePaise + exempt - notes.taxablePaise).toBe(docs.taxablePaise);
        expect(g.net).toEqual({ ...docs, taxablePaise: g.net.taxablePaise });
        const section31 = r.gstr3b.rows.filter((x) => x.code.startsWith('3.1')).reduce((t, x) => t + x.taxablePaise, 0);
        expect(section31).toBe(docs.taxablePaise);
        expect(r.gstr3b.outputTax).toEqual({ igstPaise: docs.igstPaise, cgstPaise: docs.cgstPaise, sgstPaise: docs.sgstPaise, cessPaise: docs.cessPaise });
        const invoiceValues = new Map([...g.b2b, ...g.b2cl].map((x) => [x.invoiceNumber, x.invoiceValuePaise]));
        for (const [number, value] of invoiceValues) {
          const sale = s.sales!.find((x) => x.number === number)!;
          expect(value).toBe(r.invoices.find((i) => i.ref === sale.ref)!.result.totalPaise);
        }
      });

      it('the returns tie out to the tax accounts in the books, head by head', () => {
        const books = taxBalances(r.journals.filter((j) => !isLedgerOnly(j.ref)), false);
        for (const t of gstTieOuts(r.gstr3b, books)) expect(t.returnPaise, t.name).toBe(t.booksPaise);
      });

      it('every journal balances and the trial balance nets to zero', () => {
        for (const j of r.journals) {
          const dr = j.lines.filter((l) => l.side === 'Dr').reduce((t, l) => t + l.paise, 0);
          expect(dr, j.ref).toBe(j.lines.filter((l) => l.side === 'Cr').reduce((t, l) => t + l.paise, 0));
        }
        expect(r.trialBalance.reduce((t, a) => t + a.netPaise, 0)).toBe(0);
      });

      if (s.business.scheme !== 'regular') {
        it('a composition or unregistered business issues bills of supply with no tax and files no GSTR-1', () => {
          for (const i of r.invoices.filter((x) => x.kind === 'sale')) {
            expect(i.input.docType).toBe('bill_of_supply');
            expect(i.result.cgstPaise + i.result.sgstPaise + i.result.igstPaise + i.result.cessPaise).toBe(0);
          }
          expect(r.gstr1.applicable).toBe(false);
          expect(r.journals.flatMap((j) => j.lines).filter((l) => /^(15|22)\d\d$/u.test(l.code))).toEqual([]);
        });
      }

      if (s.setoff) {
        it('the set-off clears every output head and takes only the credit used', () => {
          const after = taxBalances(r.journals.filter((j) => j.ref !== 'CHALLAN' && !j.ref.startsWith('CL/')), false);
          expect(after.output).toEqual({ igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 });
          expect(after.input).toEqual(r.setoff!.result.creditLeft);
        });
      }

      if (s.yearEnd) {
        it('the year-end close leaves no income or expense balance', () => {
          expect(r.trialBalance.filter((a) => /^[45]/u.test(a.code))).toEqual([]);
        });
      }
    });
  }
});
