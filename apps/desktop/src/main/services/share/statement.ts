import type { PartyType } from '@muneem/domain';
import type { ReportScope } from '../../reports/definition.js';
import { customerLedgerReport, supplierLedgerReport } from '../../reports/definitions/parties.js';
import { reportHtml } from '../../reports/exports/pdf.js';

export interface StatementRange { from?: string | undefined; to?: string | undefined }
export interface Statement { html: string; closingBalancePaise: number }

// The party ledger exactly as its report exports it, under a "Statement of account" title for the party to read.
export function buildStatement(
  scope: ReportScope, business: { name: string; gstin: string | null }, partyType: PartyType, party: { id: string; name: string },
  range: StatementRange, generatedAt: string,
): Statement {
  const def = partyType === 'customer' ? customerLedgerReport : supplierLedgerReport;
  const out = def.run(scope, { partyId: party.id, ...(range.from && { from: range.from }), ...(range.to && { to: range.to }) });
  const params = [
    { label: partyType === 'customer' ? 'Customer' : 'Supplier', value: party.name },
    ...(range.from ? [{ label: 'From', value: range.from }] : []),
    { label: 'To', value: range.to ?? scope.today },
  ];
  const html = reportHtml({ title: 'Statement of account', business, params, generatedAt, columns: def.columns, rows: out.rows, totals: out.totals ?? null });
  return { html, closingBalancePaise: Number(out.totals?.balancePaise ?? 0) };
}
