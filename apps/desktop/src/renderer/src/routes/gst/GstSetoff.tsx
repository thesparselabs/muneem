import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { HEAD_LABELS, monthLabel, previousMonth, utilisationRows } from '../../lib/gst/gstForm.js';
import GstNav, { MonthPicker } from './GstNav.js';
import { ArrowLeftRight } from 'lucide-react';

// GST → Set-off: the month's output tax against input credit in the statutory order, previewed, then posted (ADR-0044).
export default function GstSetoff() {
  const qc = useQueryClient();
  const canPost = useCan('gst.create');
  const [month, setMonth] = useState(() => previousMonth(new Date().toLocaleDateString('en-CA')));
  const [commandId, setCommandId] = useState(newUlid);
  const [message, setMessage] = useState<string | null>(null);
  const preview = useQuery({ queryKey: ['gst', 'setoff', month], queryFn: () => api.gst.previewSetoff({ month }) });
  const ledger = useQuery({ queryKey: ['gst', 'ledger'], queryFn: () => api.gst.ledger({}) });
  const post = async () => {
    try {
      const s = await api.gst.postSetoff({ month, commandId });
      setMessage(`Posted ${s.docNumber}`);
      setCommandId(newUlid());
      await qc.invalidateQueries({ queryKey: ['gst'] });
    } catch (e) { setMessage(errorMessage(e)); }
  };
  const p = preview.data;
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><ArrowLeftRight size={22} className="text-primary" aria-hidden />GST set-off</h1>
      <GstNav />
      <MonthPicker value={month} onChange={setMonth} />
      {message && <p className="text-sm" role="status">{message}</p>}
      {preview.error && <p className="err" role="alert">{errorMessage(preview.error)}</p>}
      {p && (
        <div className="card space-y-3">
          <p className="text-sm text-muted-foreground">Balances on {p.docDate}. IGST credit is used first — on IGST, then on CGST and SGST; CGST and SGST credit never pay each other; cess pays only cess.</p>
          <table className="table-modern">
            <thead><tr><th>Head</th><th className="text-right">Liability</th><th className="text-right">Credit</th>
              <th className="text-right">Credit used</th><th className="text-right">Credit left</th><th className="text-right">Pay in cash</th></tr></thead>
            <tbody>{HEAD_LABELS.map(([k, label]) => (
              <tr key={k} className="tabular-nums"><td>{label}</td><td className="text-right">{formatPaise(p.liability[k])}</td>
                <td className="text-right">{formatPaise(p.credit[k])}</td><td className="text-right">{formatPaise(p.creditUsed[k])}</td>
                <td className="text-right">{formatPaise(p.creditLeft[k])}</td><td className="text-right">{formatPaise(p.cash[k])}</td></tr>
            ))}</tbody>
          </table>
          <ul className="text-sm">{utilisationRows(p.utilisation).map((u) => <li key={`${u.from}-${u.to}`}>{u.from} credit → {u.to}: {formatPaise(u.paise)}</li>)}</ul>
          <p className="font-semibold">To pay by challan: {formatPaise(p.cashTotalPaise)}</p>
          {p.blockers.length > 0 && <ul className="text-sm text-amber-700 dark:text-amber-300" role="status">{p.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          {canPost && <button type="button" className="btn-primary" disabled={p.blockers.length > 0} onClick={() => void post()}>Post set-off for {monthLabel(month)}</button>}
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 font-semibold">Set-offs posted</h2>
        {ledger.data?.setoffs.length ? (
          <table className="table-modern"><thead><tr><th>Number</th><th>Month</th><th className="text-right">Paid in cash</th></tr></thead>
            <tbody>{ledger.data.setoffs.map((s) => (
              <tr key={s.id}><td className="font-mono">{s.docNumber}</td><td>{monthLabel(s.month)}</td>
                <td className="text-right tabular-nums">{formatPaise(s.cash.igstPaise + s.cash.cgstPaise + s.cash.sgstPaise + s.cash.cessPaise)}</td></tr>
            ))}</tbody></table>
        ) : <p className="text-sm text-muted-foreground">None yet.</p>}
      </div>
    </div>
  );
}
