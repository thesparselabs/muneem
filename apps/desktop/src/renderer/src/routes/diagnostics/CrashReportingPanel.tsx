import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { useCan } from '../../lib/permissions.js';

// Diagnostics → Crash reporting (NFR-025, ADR-0053): off until the owner turns it on for this business.
export default function CrashReportingPanel() {
  const qc = useQueryClient();
  const canManage = useCan('settings.manage');
  const status = useQuery({ queryKey: ['crashReporting'], queryFn: () => api.diagnostics.crashReporting({}), refetchInterval: 60_000 });
  const toggle = useMutation({
    mutationFn: (value: boolean) => api.settings.set({ key: 'telemetry.crashReports', value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crashReporting'] }),
  });
  const s = status.data;
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Crash reporting</h2>
        {s && canManage && (
          <button type="button" className="btn-secondary" onClick={() => toggle.mutate(!s.enabled)} disabled={toggle.isPending}>
            {s.enabled ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
      {s && (
        <table className="text-sm"><tbody>
          <tr><td className="pr-4 py-1 text-muted-foreground">Status</td><td className="py-1" role="status">{s.enabled ? 'On' : 'Off'}{s.enabled && !s.configured ? ' (this build has no report address)' : ''}</td></tr>
          <tr><td className="pr-4 py-1 text-muted-foreground">Last report sent</td><td className="py-1 font-mono text-xs">{s.lastSentAt ?? 'never'}</td></tr>
        </tbody></table>
      )}
      <p className="text-xs text-muted-foreground">
        When on, an error or crash sends the app and schema version, the operating system, an anonymous id for this computer and where in
        the code it happened. Bills, customers, phone numbers, GSTINs and anything you typed are never sent. Crash dumps stay on this computer.
      </p>
      {toggle.isError && <p className="text-sm text-destructive" role="alert">{errorMessage(toggle.error)}</p>}
    </div>
  );
}
