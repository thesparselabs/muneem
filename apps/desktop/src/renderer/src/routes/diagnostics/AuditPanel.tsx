import { useMutation } from '@tanstack/react-query';
import type { AuditVerification } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { auditSummary, breakLabel } from '../../lib/audit.js';

// Diagnostics → Audit trail (8g, ADR-0048): verify every hash chain on demand; the cloud's refusals are listed too.
export default function AuditPanel() {
  const verify = useMutation({ mutationFn: () => api.diagnostics.verifyAudit({}) });
  const r: AuditVerification | undefined = verify.data;
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Audit trail</h2>
        <button type="button" className="btn-secondary" onClick={() => verify.mutate()} disabled={verify.isPending}>Verify audit trail</button>
      </div>
      {verify.isError && <p className="text-sm text-red-700" role="alert">{errorMessage(verify.error)}</p>}
      {r && (
        <>
          <p className={`text-sm ${r.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{auditSummary(r)}</p>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-1 font-normal">Chain</th><th className="py-1 text-right font-normal">Rows</th><th className="py-1 font-normal pl-4">Result</th></tr></thead>
            <tbody>{r.chains.map((c) => (
              <tr key={`${c.businessId}/${c.deviceId}`} className="border-t">
                <td className="py-1 font-mono text-xs">{c.businessId} / {c.deviceId}</td>
                <td className="py-1 text-right tabular-nums">{c.count}</td>
                <td className={`py-1 pl-4 ${c.ok ? '' : 'text-red-700'}`}>{breakLabel(c)}</td>
              </tr>
            ))}</tbody>
          </table>
          {r.cloudRejections.length > 0 && (
            <ul className="text-sm text-red-700 list-disc pl-5">
              {r.cloudRejections.map((x) => <li key={x.operationId}>The cloud refused audit row {x.seq ?? '?'}: {x.detail ?? 'AUDIT_CHAIN_BROKEN'}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
