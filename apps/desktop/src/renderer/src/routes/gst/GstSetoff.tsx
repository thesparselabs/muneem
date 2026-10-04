import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { HEAD_LABELS, monthLabel, previousMonth, utilisationRows } from '../../lib/gst/gstForm.js';
import GstNav, { MonthPicker } from './GstNav.js';

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
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">GST set-off</h1>
      <GstNav />
      <MonthPicker value={month} onChange={setMonth} />
      {message && <p className="text-sm" role="status">{message}</p>}
      {preview.error && <p className="err" role="alert">{errorMessage(preview.error)}</p>}
      {p && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-600">Balances on {p.docDate}. IGST credit is used first — on IGST, then on CGST and SGST; CGST and SGST credit never pay each other; cess pays only cess.</p>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600"><tr><th className="p-1">Head</th><th className="p-1 text-right">Liability</th><th className="p-1 text-right">Credit</th>
              <th className="p-1 text-right">Credit used</th><th className="p-1 text-right">Credit left</th><th className="p-1 text-right">Pay in cash</th></tr></thead>
            <tbody>{HEAD_LABELS.map(([k, label]) => (
              <tr key={k} className="border-t tabular-nums"><td className="p-1">{label}</td><td className="p-1 text-right">{formatPaise(p.liability[k])}</td>
                <td className="p-1 text-right">{formatPaise(p.credit[k])}</td><td className="p-1 text-right">{formatPaise(p.creditUsed[k])}</td>
                <td className="p-1 text-right">{formatPaise(p.creditLeft[k])}</td><td className="p-1 text-right">{formatPaise(p.cash[k])}</td></tr>
            ))}</tbody>
          </table>
          <ul className="text-sm">{utilisationRows(p.utilisation).map((u) => <li key={`${u.from}-${u.to}`}>{u.from} credit → {u.to}: {formatPaise(u.paise)}</li>)}</ul>
          <p className="font-semibold">To pay by challan: {formatPaise(p.cashTotalPaise)}</p>
          {p.blockers.length > 0 && <ul className="text-sm text-amber-700" role="status">{p.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          {canPost && <button type="button" className="btn-primary" disabled={p.blockers.length > 0} onClick={() => void post()}>Post set-off for {monthLabel(month)}</button>}
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 font-semibold">Set-offs posted</h2>
        {ledger.data?.setoffs.length ? (
          <table className="w-full text-sm"><thead className="text-left text-slate-600"><tr><th className="p-1">Number</th><th className="p-1">Month</th><th className="p-1 text-right">Paid in cash</th></tr></thead>
            <tbody>{ledger.data.setoffs.map((s) => (
              <tr key={s.id} className="border-t"><td className="p-1 font-mono">{s.docNumber}</td><td className="p-1">{monthLabel(s.month)}</td>
                <td className="p-1 text-right tabular-nums">{formatPaise(s.cash.igstPaise + s.cash.cgstPaise + s.cash.sgstPaise + s.cash.cessPaise)}</td></tr>
            ))}</tbody></table>
        ) : <p className="text-sm text-slate-600">None yet.</p>}
      </div>
    </div>
  );
}
