import { buildGstr1, buildGstr3b, gstTieOuts, monthEnd, type GstBooks, type Gstr1, type Gstr3b, type GstTieOut, type InwardLine } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { gstBooksForMonth, inwardLines, noteLines, outwardLines, seriesIssued, type GstRange } from './gstReturns.js';
import type { TieOut } from './tieOuts.js';

export interface GstMonthReturn { month: string; gstr1: Gstr1; gstr3b: Gstr3b; inward: InwardLine[]; books: GstBooks; tieOuts: GstTieOut[] }

export const gstRange = (businessId: string, month: string): GstRange => ({ businessId, from: month, to: monthEnd(month) });

// One month's GSTR-1, GSTR-3B and ITC lines from the documents, checked against the tax accounts (ADR-0044).
export function gstMonthReturn(db: Db, businessId: string, month: string, regular: boolean): GstMonthReturn {
  const range = gstRange(businessId, month);
  const outward = outwardLines(db, range);
  const notes = noteLines(db, range);
  const inward = inwardLines(db, range);
  const gstr1 = buildGstr1({ regular, outward, notes, series: seriesIssued(db, range) });
  const gstr3b = buildGstr3b({ regular, outward, notes, inward });
  const books = gstBooksForMonth(db, range);
  const tieOuts = gstTieOuts(regular ? gstr3b : buildGstr3b({ regular: true, outward, notes, inward }), books);
  return { month, gstr1, gstr3b, inward, books, tieOuts };
}

// Months in which a document posted tax, oldest first.
export const gstActiveMonths = (db: Db, businessId: string): string[] =>
  stmt(db, `SELECT DISTINCT substr(entry_date, 1, 7) || '-01' AS m FROM journal_entry
    WHERE business_id = ? AND source IN ('sale', 'sale_return', 'purchase', 'purchase_return', 'expense') ORDER BY m`).pluck().all(businessId) as string[];

// ADR-0034's tie-outs, monthly for GST: each month's return totals by head against that month's tax-account movements.
export function gstMonthlyTieOuts(db: Db, businessId: string): TieOut[] {
  return gstActiveMonths(db, businessId).flatMap((month) => {
    const range = gstRange(businessId, month);
    const outward = outwardLines(db, range);
    const notes = noteLines(db, range);
    const g3b = buildGstr3b({ regular: true, outward, notes, inward: inwardLines(db, range) });
    return gstTieOuts(g3b, gstBooksForMonth(db, range))
      .map((t) => ({ name: `GST ${month.slice(0, 7)} ${t.name}`, ledgerPaise: t.booksPaise, subledgerPaise: t.returnPaise }));
  });
}
