import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api.js';
import { useCan } from '../lib/permissions.js';
import BackupsPanel from './diagnostics/BackupsPanel.js';
import SyncPanel from './diagnostics/SyncPanel.js';

export default function Diagnostics() {
  const canSync = useCan('sync.view');
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.diagnostics.getHealth({}), refetchInterval: 15_000 });
  const [log, setLog] = useState<'app' | 'sync'>('app');
  const logs = useQuery({ queryKey: ['logs', log], queryFn: () => api.diagnostics.getLogsTail({ log, lines: 200 }) });
  const [msg, setMsg] = useState<string | null>(null);
  const integrity = useMutation({ mutationFn: () => api.diagnostics.integrityCheck({}), onSuccess: (r) => setMsg(`Integrity: quick_check ${r.quickCheck}, foreign keys ${r.foreignKeys}, audit chain ${r.auditChain}, stock ${r.stock}, party ledgers ${r.parties}, journals ${r.journals}${r.detail.length ? ' — ' + r.detail.join('; ') : ''}`), onError: (e) => setMsg(errorMessage(e)) });
  const bundle = useMutation({ mutationFn: () => api.diagnostics.exportSupportBundle({}), onSuccess: (r) => setMsg(`Support bundle ready. Reference: ${r.handle}`), onError: (e) => setMsg(errorMessage(e)) });
  const h = health.data;
  const row = (k: string, v: unknown) => <tr><td className="pr-4 py-1 text-slate-500">{k}</td><td className="py-1 font-mono text-xs break-all">{String(v ?? '—')}</td></tr>;
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Diagnostics</h1>
      {canSync && <SyncPanel />}
      <BackupsPanel />
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
        </div>
        {msg && <p className="text-sm mt-3" role="status">{msg}</p>}
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Logs</h2>
          <div className="flex gap-1" role="tablist">
            {(['app', 'sync'] as const).map((l) => <button key={l} role="tab" aria-selected={log === l} className={`btn-secondary py-1 ${log === l ? 'bg-slate-200' : ''}`} onClick={() => setLog(l)}>{l}.log</button>)}
          </div>
        </div>
        <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded h-72 overflow-auto">{logs.data?.join('\n') || '(empty)'}</pre>
      </div>
    </div>
  );
}
