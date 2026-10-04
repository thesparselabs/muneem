import type { AuditVerification } from '@muneem/contracts';

type Chain = AuditVerification['chains'][number];

const REASON: Record<NonNullable<Chain['reason']>, string> = {
  seq_gap: 'a row is missing',
  prev_hash: 'a row does not link to the one before',
  hash: 'a row was changed after it was written',
};

export function breakLabel(c: Chain): string {
  return c.ok ? 'Intact' : `Broken at row ${c.brokenAtSeq}: ${c.reason ? REASON[c.reason] : 'unknown'}`;
}

export function auditSummary(r: AuditVerification): string {
  const broken = r.chains.filter((c) => !c.ok).length + r.cloudRejections.length;
  const rows = r.chains.reduce((n, c) => n + c.count, 0);
  if (broken === 0) return `All ${r.chains.length} chain${r.chains.length === 1 ? '' : 's'} intact (${rows} rows).`;
  return `${broken} break${broken === 1 ? '' : 's'} found. Sync shows "Needs attention" until this is looked into; export a support bundle for help.`;
}
