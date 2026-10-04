import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import AccountsNav from './AccountsNav.js';

const thisMonth = () => `${new Date().toLocaleDateString('en-CA').slice(0, 7)}-01`;

export default function Periods() {
  const qc = useQueryClient();
  const canManage = useCan('accounting.manage');
  const [message, setMessage] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api.accounting.getPeriods({}) });
  const late = useQuery({ queryKey: ['latePostings'], queryFn: () => api.accounting.listLatePostings({}) });
  const run = async (f: () => Promise<string>) => {
    try { setMessage(await f()); await qc.invalidateQueries(); } catch (e) { setMessage(errorMessage(e)); }
  };
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">Periods</h1>
      <AccountsNav />
      {canManage && (
        <div className="card flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => void run(async () => { const r = await api.accounting.postBacklog({}); return `Posted ${r.posted} journals; ${r.remaining} documents still without one`; })}>Post journals for older documents</button>
          <button type="button" className="btn-secondary" onClick={() => void run(async () => `Rebuilt ${(await api.accounting.rebuildBalances({})).rebuilt} balance rows`)}>Rebuild balances</button>
        </div>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Month</th><th className="p-2">FY</th><th className="p-2">Status</th><th className="p-2 text-right">Journals</th><th className="p-2 text-right">Late postings</th><th /></tr></thead>
        <tbody>
          {periods.data?.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.periodStart.slice(0, 7)}</td><td className="p-2">{p.fy}</td>
              <td className="p-2">{p.status === 'locked' ? 'Locked' : 'Open'}{p.unlockReason && p.status === 'open' && <span className="text-xs text-slate-500"> (reopened: {p.unlockReason})</span>}</td>
              <td className="p-2 text-right">{p.journals}</td><td className="p-2 text-right">{p.latePostings}</td>
              <td className="p-2">{canManage && (p.status === 'locked'
                ? <button type="button" className="btn-secondary py-0" onClick={() => setUnlocking(p.periodStart)}>Unlock</button>
                : p.periodStart < thisMonth() && <button type="button" className="btn-secondary py-0" onClick={() => void run(async () => { await api.accounting.lockPeriod({ periodStart: p.periodStart }); return `Locked ${p.periodStart.slice(0, 7)}`; })}>Lock</button>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card">
        <h2 className="mb-2 font-semibold">Late postings</h2>
        {late.data?.length ? (
          <table className="w-full text-sm"><thead className="text-left text-slate-600"><tr><th className="p-1">Entry</th><th className="p-1">Source</th><th className="p-1">Document date</th><th className="p-1">Posted on</th><th className="p-1 text-right">Amount</th></tr></thead>
            <tbody>{late.data.map((l) => <tr key={l.id} className="border-t"><td className="p-1 font-mono">{l.entryNo}</td><td className="p-1">{l.source}</td><td className="p-1">{l.docDate}</td><td className="p-1">{l.entryDate}</td><td className="p-1 text-right tabular-nums">{formatPaise(l.totalPaise)}</td></tr>)}</tbody></table>
        ) : <p className="text-sm text-slate-600">None. A document dated into a locked month would appear here.</p>}
      </div>
      {unlocking && <UnlockDialog periodStart={unlocking} onClose={() => setUnlocking(null)} onDone={() => { setUnlocking(null); void qc.invalidateQueries(); }} />}
    </div>
  );
}

function UnlockDialog({ periodStart, onClose, onDone }: { periodStart: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.accounting.unlockPeriod({ periodStart, reason }); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title={`Unlock ${periodStart.slice(0, 7)}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">Reopening a month lets documents post into it again. Say why — it is kept on the period.</p>
        <div><label className="label" htmlFor="ul-reason">Reason</label><input id="ul-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary">Unlock</button>
      </form>
    </Dialog>
  );
}
