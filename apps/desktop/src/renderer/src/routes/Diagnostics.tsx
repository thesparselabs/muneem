import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api.js';
import { useCan } from '../lib/permissions.js';
import { useToasts } from '../lib/toast.js';
import AuditPanel from './diagnostics/AuditPanel.js';
import BackupsPanel from './diagnostics/BackupsPanel.js';
import CrashReportingPanel from './diagnostics/CrashReportingPanel.js';
import SyncPanel from './diagnostics/SyncPanel.js';
import { Activity } from 'lucide-react';

export default function Diagnostics() {
  const canSync = useCan('sync.view');
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.diagnostics.getHealth({}), refetchInterval: 15_000 });
  const [log, setLog] = useState<'app' | 'sync'>('app');
  const logs = useQuery({ queryKey: ['logs', log], queryFn: () => api.diagnostics.getLogsTail({ log, lines: 200 }) });
  const [msg, setMsg] = useState<string | null>(null);
  const integrity = useMutation({ mutationFn: () => api.diagnostics.integrityCheck({}), onSuccess: (r) => setMsg(`Integrity: quick_check ${r.quickCheck}, foreign keys ${r.foreignKeys}, audit chain ${r.auditChain}, stock ${r.stock}, party ledgers ${r.parties}, journals ${r.journals}, dashboard summaries ${r.summaries}${r.detail.length ? ' — ' + r.detail.join('; ') : ''}`), onError: (e) => setMsg(errorMessage(e)) });
  const bundle = useMutation({ mutationFn: () => api.diagnostics.exportSupportBundle({}), onSuccess: (r) => setMsg(`Support bundle ready. Reference: ${r.handle}`), onError: (e) => setMsg(errorMessage(e)) });
  const qc = useQueryClient();
  const push = useToasts((s) => s.push);
  const demo = useMutation({
    mutationFn: () => api.dev.seedDemo({}),
    onSuccess: (r) => {
      void qc.invalidateQueries();
      push(`Demo data loaded: ${r.products} products, ${r.parties} parties, ${r.sales} sales, ${r.purchases} purchases, ${r.payments} payments, ${r.expenses} expenses${r.errors.length ? ` (${r.errors.length} skipped)` : ''}. Refresh the screen to see it.`, 'success');
    },
    onError: (e) => push(errorMessage(e), 'error'),
  });
  const h = health.data;
  const row = (k: string, v: unknown) => <tr><td className="pr-4 py-1 text-muted-foreground">{k}</td><td className="py-1 font-mono text-xs break-all">{String(v ?? '—')}</td></tr>;
  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Activity size={22} className="text-primary" aria-hidden />Diagnostics</h1>
      {canSync && <SyncPanel />}
      <BackupsPanel />
      <AuditPanel />
      <CrashReportingPanel />
      <div className="card">
        <h2 className="font-semibold mb-3">Health</h2>
        {h && (
          <table className="text-sm"><tbody>
            {row('Database', h.dbPath)}{row('Size', `${(h.dbSizeBytes / 1024 / 1024).toFixed(2)} MB`)}{row('Schema version', h.schemaVersion)}{row('App version', h.appVersion)}
            {row('Outbox depth', h.outboxDepth)}{row('Oldest unsynced', h.oldestUnsyncedAt)}{row('Last backup', h.lastBackupAt)}{row('Clock skew (ms)', h.clockSkewMs)}
            {row('Audit chain', h.auditChainOk === null ? 'empty' : h.auditChainOk ? 'ok' : 'BROKEN')}{row('Secret store encrypted', h.secretStoreAvailable ? 'yes' : 'NO (dev fallback)')}
          </tbody></table>
        )}
        <div className="flex gap-2 mt-4">
          <button className="btn-secondary" onClick={() => integrity.mutate()} disabled={integrity.isPending}>Run integrity check</button>
          <button className="btn-secondary" onClick={() => bundle.mutate()} disabled={bundle.isPending}>Export support bundle</button>
          {import.meta.env.DEV && <button className="btn-secondary" onClick={() => demo.mutate()} disabled={demo.isPending}>{demo.isPending ? 'Loading demo data…' : 'Load demo data'}</button>}
        </div>
        {msg && <p className="text-sm mt-3" role="status">{msg}</p>}
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Logs</h2>
          <div className="flex gap-1" role="tablist">
            {(['app', 'sync'] as const).map((l) => <button key={l} role="tab" aria-selected={log === l} className={`btn-secondary py-1 ${log === l ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setLog(l)}>{l}.log</button>)}
          </div>
        </div>
        <pre className="bg-zinc-900 text-slate-100 text-xs p-3 rounded h-72 overflow-auto">{logs.data?.join('\n') || '(empty)'}</pre>
      </div>
    </div>
  );
}
