import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FailedOperation } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { useCan } from '../../lib/permissions.js';
import { errorLine, payloadPreview, STREAM_LABEL } from '../../lib/sync/outbox.js';
import { ago, age, syncBadge } from '../../lib/sync/status.js';
import { useNow } from '../../lib/useNow.js';
import { useUi } from '../../store.js';
import { Send } from 'lucide-react';

const COUNTS = [['pending', 'Waiting'], ['inFlight', 'Sending'], ['failed', 'Failed (retrying)'], ['dead', 'Gave up'], ['sent', 'Sent'], ['superseded', 'Superseded']] as const;

export default function SyncPanel() {
  const qc = useQueryClient();
  const { sync, online } = useUi();
  const now = useNow();
  const canManage = useCan('sync.manage');
  const overview = useQuery({ queryKey: ['syncOverview'], queryFn: () => api.sync.getOverview({}) });
  const failed = useQuery({ queryKey: ['syncFailed'], queryFn: () => api.sync.listFailed({ limit: 100 }) });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void qc.invalidateQueries({ queryKey: ['syncOverview'] }); void qc.invalidateQueries({ queryKey: ['syncFailed'] }); }, [sync, qc]);

  const run = async (f: () => Promise<string>) => {
    try { setMessage(await f()); } catch (e) { setMessage(errorMessage(e)); }
    await qc.invalidateQueries({ queryKey: ['syncOverview'] });
    await qc.invalidateQueries({ queryKey: ['syncFailed'] });
  };
  const resend = (operationIds: string[]) => run(async () => {
    const r = await api.sync.resend({ operationIds });
    setSelected(new Set());
    return `${r.resent} change${r.resent === 1 ? '' : 's'} queued to send again`;
  });
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const o = overview.data;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Sync</h2>
        <button type="button" className="btn-secondary" onClick={() => void run(async () => { await api.sync.retry({}); return 'Sync started'; })}>Sync now</button>
      </div>
      {sync && (
        <p className="text-sm">
          <span className="font-medium">{syncBadge(sync, online, now).label}</span>
          {sync.detail && <span className="text-muted-foreground"> — {sync.detail}</span>}
          <span className="block text-xs text-muted-foreground">
            Last sent {sync.lastPushAt ? ago(sync.lastPushAt, now) : 'never'} · last received {sync.lastPullAt ? ago(sync.lastPullAt, now) : 'never'}
          </span>
        </p>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
      {o && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="mb-1 text-muted-foreground">Outbox</h3>
            <table className="w-full"><tbody>
              {COUNTS.map(([k, label]) => <tr key={k} className="border-t border-border"><td className="py-1">{label}</td><td className="py-1 text-right tabular-nums">{o.counts[k]}</td></tr>)}
              <tr className="border-t border-border"><td className="py-1">Oldest waiting</td><td className="py-1 text-right">{o.oldestPendingAt ? age(o.oldestPendingAt, now) : '—'}</td></tr>
            </tbody></table>
          </div>
          <div>
            <h3 className="mb-1 text-muted-foreground">Received from the cloud</h3>
            {o.cursors.length ? (
              <table className="w-full"><thead className="text-left text-muted-foreground"><tr><th className="py-1 font-normal">Stream</th><th className="py-1 text-right font-normal">Position</th><th className="py-1 text-right font-normal">Last pulled</th></tr></thead>
                <tbody>{o.cursors.map((c) => (
                  <tr key={c.stream} className="border-t border-border"><td className="py-1">{STREAM_LABEL[c.stream] ?? c.stream}</td><td className="py-1 text-right tabular-nums">{c.lastSeq}</td>
                    <td className="py-1 text-right">{c.lastPulledAt ? ago(c.lastPulledAt, now) : 'never'}</td></tr>
                ))}</tbody></table>
            ) : <p className="text-muted-foreground">Nothing received yet.</p>}
            <p className="mt-2"><Link to="/settings/review" className="text-primary">{o.openReviewItems} review item{o.openReviewItems === 1 ? '' : 's'} open</Link></p>
          </div>
        </div>
      )}
      <FailedList ops={failed.data ?? []} canManage={canManage} selected={selected} onToggle={toggle} onResend={(ids) => void resend(ids)} now={now} />
    </div>
  );
}

function FailedList({ ops, canManage, selected, onToggle, onResend, now }: {
  ops: FailedOperation[]; canManage: boolean; selected: Set<string>; onToggle: (id: string) => void; onResend: (ids: string[]) => void; now: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (ops.length === 0) return <p className="text-sm text-muted-foreground">No failed changes.</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm text-muted-foreground">Changes that could not be sent</h3>
        {canManage && <button type="button" className="btn-secondary py-1" disabled={selected.size === 0} onClick={() => onResend([...selected])}>Resend selected ({selected.size})</button>}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground"><tr>{canManage && <th />}<th className="p-1 font-normal">Entity</th><th className="p-1 font-normal">Change</th><th className="p-1 font-normal">State</th>
          <th className="p-1 text-right font-normal">Tries</th><th className="p-1 font-normal">Error</th><th className="p-1 font-normal">Last try</th><th /></tr></thead>
        <tbody>
          {ops.map((op) => (
            <FailedRow key={op.operationId} op={op} canManage={canManage} checked={selected.has(op.operationId)} expanded={open === op.operationId}
              onToggle={() => onToggle(op.operationId)} onExpand={() => setOpen(open === op.operationId ? null : op.operationId)} onResend={() => onResend([op.operationId])} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FailedRow({ op, canManage, checked, expanded, onToggle, onExpand, onResend, now }: {
  op: FailedOperation; canManage: boolean; checked: boolean; expanded: boolean; onToggle: () => void; onExpand: () => void; onResend: () => void; now: number;
}) {
  const cols = canManage ? 8 : 7;
  return (
    <>
      <tr className="border-t border-border align-top">
        {canManage && <td className="p-1"><input type="checkbox" aria-label={`Select ${op.entityType} ${op.entityId}`} checked={checked} onChange={onToggle} /></td>}
        <td className="p-1">{op.entityType}<span className="block font-mono text-xs text-muted-foreground">{op.entityId}</span></td>
        <td className="p-1">{op.operationType}</td>
        <td className="p-1">{op.status === 'dead' ? <span className="text-destructive">gave up</span> : 'retrying'}</td>
        <td className="p-1 text-right tabular-nums">{op.attemptCount}</td>
        <td className="p-1 text-xs">{errorLine(op)}</td>
        <td className="p-1 text-xs">{op.lastAttemptAt ? ago(op.lastAttemptAt, now) : '—'}</td>
        <td className="whitespace-nowrap p-1">
          <button type="button" className="btn-secondary py-0" aria-expanded={expanded} onClick={onExpand}>{expanded ? 'Hide' : 'Payload'}</button>
          {canManage && <button type="button" className="btn-secondary ml-1 py-0" onClick={onResend}><Send size={16} aria-hidden />Resend</button>}
        </td>
      </tr>
      {expanded && <tr><td colSpan={cols} className="p-1"><pre className="max-h-64 overflow-auto rounded bg-zinc-900 p-3 text-xs text-slate-100">{payloadPreview(op)}</pre></td></tr>}
    </>
  );
}
