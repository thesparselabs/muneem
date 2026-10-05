import type { GstReturnSummary } from '@muneem/contracts';
import { sumAmounts, ZERO_AMOUNTS, type Gstr1, type TaxAmounts } from '@muneem/domain';
import { gstMonthReturn, setoffIdsForMonth } from '@muneem/db-sqlite';
import type { GstContext } from './gstContext.js';

type Section = GstReturnSummary['sections'][number];
const total = (section: string, title: string, rows: readonly TaxAmounts[]): Section =>
  ({ section, title, reportId: `gst.gstr1.${section}`, rows: rows.length, ...sumAmounts(rows) });

function sections(g: Gstr1): Section[] {
  const exempt = g.exemp.reduce((s, r) => s + r.nilPaise + r.exemptPaise + r.nonGstPaise, 0);
  return [
    total('b2b', 'B2B', g.b2b), total('b2cl', 'B2CL', g.b2cl), total('b2cs', 'B2CS', g.b2cs), total('cdnr', 'CDNR', g.cdnr), total('cdnur', 'CDNUR', g.cdnur),
    total('exp', 'Exports', g.exp),
    { section: 'exemp', title: 'Nil, exempt, non-GST', reportId: 'gst.gstr1.exemp', rows: g.exemp.length, ...ZERO_AMOUNTS, taxablePaise: exempt },
    total('hsn_b2b', 'HSN (B2B)', g.hsn.filter((r) => r.recipient === 'b2b')), total('hsn_b2c', 'HSN (B2C)', g.hsn.filter((r) => r.recipient === 'b2c')),
    { section: 'docs', title: 'Documents issued', reportId: 'gst.gstr1.docs', rows: g.docs.length, ...ZERO_AMOUNTS },
  ];
}

// GST → Returns: one month's sections, GSTR-3B and whether they tie to the books (ADR-0044).
export class GstReturnService {
  constructor(private readonly ctx: GstContext) {}

  summary(month: string): GstReturnSummary {
    const db = this.ctx.pos.db();
    const businessId = this.ctx.pos.businessId();
    const r = gstMonthReturn(db, businessId, month, this.ctx.regular());
    return {
      month, applicable: r.gstr1.applicable, sections: r.gstr1.applicable ? sections(r.gstr1) : [],
      gstr3b: r.gstr3b.rows.map((x) => ({ ...x })), inward: r.gstr3b.inward, tieOuts: r.tieOuts,
      missingHsn: r.gstr1.missingHsn.reduce((s, x) => s + x.count, 0), locked: this.ctx.locked(month),
      setoffId: setoffIdsForMonth(db, businessId, month)[0] ?? null,
    };
  }
}
