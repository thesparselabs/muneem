import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FinancialYear } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import { canClose, checklist, statusLabel } from '../../lib/accounting/yearEnd.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import AccountsNav from './AccountsNav.js';

export default function YearEnd() {
  const qc = useQueryClient();
  const mayClose = useCan('accounting.close');
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<FinancialYear | null>(null);
  const years = useQuery({ queryKey: ['yearEnd'], queryFn: () => api.accounting.getYearEnd({}) });
  const reclose = async (fy: string) => {
    try { await api.accounting.recloseYear({ fy }); setMessage(`Posted an adjusting closing journal for ${fy}`); await qc.invalidateQueries(); } catch (e) { setMessage(errorMessage(e)); }
  };
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">Year end</h1>
      <AccountsNav />
      <p className="text-sm text-slate-600">
        Closing a year moves its income and expenses to Retained Earnings on 31 March. Its reports stay as they were, and its months stay locked.
      </p>
      {message && <p className="text-sm" role="status">{message}</p>}
      {years.data?.map((y) => (
        <section key={y.fy} className="card space-y-3" aria-label={`Financial year ${y.fy}`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">FY {y.fy} <span className="text-sm font-normal text-slate-500">{y.start} – {y.end}</span></h2>
            <span className="text-sm">{statusLabel(y)}</span>
          </div>
          <p className="text-sm">Profit for the year: <span className="tabular-nums">{formatPaise(y.profitPaise)}</span></p>
          {y.status === 'open' && (
            <ul className="space-y-1 text-sm">
              {checklist(y).map((c) => (
                <li key={c.label}><span aria-hidden>{c.done ? '✓' : '○'}</span> {c.label}{c.detail && <span className="text-slate-500"> ({c.detail})</span>}</li>
              ))}
              <li className="text-slate-500"><Link className="underline" to="/accounts/periods">Lock months</Link> · <Link className="underline" to="/gst/setoff">Set off GST</Link></li>
            </ul>
          )}
          {mayClose && canClose(y) && <button type="button" className="btn-primary" onClick={() => setConfirming(y)}>Close FY {y.fy}</button>}
          {y.pending && <p className="text-sm text-amber-700">Sent to the cloud; the closing journal posts once it is accepted.{y.syncError && ` The cloud said: ${y.syncError}`}</p>}
          {y.needsReclose && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm">
              Documents dated in this year reached the books after it was closed ({formatPaise(y.residuePaise)} of profit not yet in Retained Earnings).
              {mayClose && <button type="button" className="btn-secondary ml-2 py-0" onClick={() => void reclose(y.fy)}>Post adjusting closing journal</button>}
            </div>
          )}
          {y.closings.length > 0 && <Closings year={y} />}
        </section>
      ))}
      {confirming && <ConfirmClose year={confirming} onClose={() => setConfirming(null)} onDone={(m) => { setConfirming(null); setMessage(m); void qc.invalidateQueries(); }} />}
    </div>
  );
}

function Closings({ year }: { year: FinancialYear }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-slate-600"><tr><th className="p-1">Entry</th><th className="p-1">Date</th><th className="p-1">Account</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Credit</th></tr></thead>
      <tbody>
        {year.closings.flatMap((c) => c.lines.map((l, i) => (
          <tr key={`${c.version}-${i}`} className={i === 0 ? 'border-t' : ''}>
            <td className="p-1 font-mono">{i === 0 ? c.entryNo : ''}</td><td className="p-1">{i === 0 ? c.entryDate : ''}</td>
            <td className="p-1">{l.code} {l.name}</td>
            <td className="p-1 text-right tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise) : ''}</td>
            <td className="p-1 text-right tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise) : ''}</td>
          </tr>
        )))}
      </tbody>
    </table>
  );
}

function ConfirmClose({ year, onClose, onDone }: { year: FinancialYear; onClose: () => void; onDone: (message: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  async function close() {
    try {
      const r = await api.accounting.closeYear({ fy: year.fy });
      onDone(r.status === 'closed' ? `FY ${year.fy} is closed` : `The close of FY ${year.fy} is sent; it posts once the cloud accepts it`);
    } catch (e) { setError(errorMessage(e)); }
  }
  return (
    <Dialog title={`Close FY ${year.fy}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>A closing journal dated {year.end} moves the year&apos;s profit of <strong className="tabular-nums">{formatPaise(year.profitPaise)}</strong> to Retained Earnings.</p>
        <p>Its months cannot be unlocked afterwards. A document that reaches the year later is closed by an adjusting journal.</p>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="button" className="btn-primary" onClick={() => void close()}>Close the year</button>
      </div>
    </Dialog>
  );
}
