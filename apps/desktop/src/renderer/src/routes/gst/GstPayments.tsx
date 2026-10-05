import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { EMPTY_CHALLAN, HEAD_LABELS, monthLabel, parseChallan, previousMonth, recentMonths, type ChallanText } from '../../lib/gst/gstForm.js';
import GstNav from './GstNav.js';

// GST → Payments: a challan paid from the bank clears GST Payable (ADR-0044).
export default function GstPayments() {
  const qc = useQueryClient();
  const canRecord = useCan('gst.create');
  const today = new Date().toLocaleDateString('en-CA');
  const ledger = useQuery({ queryKey: ['gst', 'ledger'], queryFn: () => api.gst.ledger({}) });
  const [date, setDate] = useState(today);
  const [challanRef, setChallanRef] = useState('');
  const [month, setMonth] = useState(previousMonth(today));
  const [amounts, setAmounts] = useState<ChallanText>(EMPTY_CHALLAN);
  const [commandId, setCommandId] = useState(newUlid);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseChallan(amounts);
    if ('error' in parsed) { setMessage(parsed.error); return; }
    try {
      const p = await api.gst.recordPayment({ commandId, paymentDate: date, challanRef, month, ...parsed.heads });
      setMessage(`Recorded ${p.docNumber}`);
      setCommandId(newUlid());
      setAmounts(EMPTY_CHALLAN);
      setChallanRef('');
      await qc.invalidateQueries({ queryKey: ['gst'] });
    } catch (err) { setMessage(errorMessage(err)); }
  }
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">GST payments</h1>
      <GstNav />
      <p className="text-sm">GST payable (2300): <span className="font-semibold tabular-nums">{formatPaise(ledger.data?.payablePaise)}</span></p>
      {canRecord && (
        <form className="card grid grid-cols-4 gap-3" onSubmit={submit}>
          <div><label className="label" htmlFor="gp-date">Paid on</label><input id="gp-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label className="label" htmlFor="gp-ref">Challan (CPIN/CIN)</label><input id="gp-ref" className="input" value={challanRef} maxLength={40} onChange={(e) => setChallanRef(e.target.value)} required /></div>
          <div><label className="label" htmlFor="gp-month">For the return of</label>
            <select id="gp-month" className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              {recentMonths(today, 24).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select></div>
          <div />
          {HEAD_LABELS.map(([k, label]) => (
            <div key={k}><label className="label" htmlFor={`gp-${k}`}>{label} (₹)</label>
              <input id={`gp-${k}`} className="input" inputMode="decimal" value={amounts[k]} onChange={(e) => setAmounts({ ...amounts, [k]: e.target.value })} /></div>
          ))}
          <div className="col-span-4"><button type="submit" className="btn-primary">Record payment</button></div>
        </form>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Number</th><th className="p-2">Date</th><th className="p-2">Challan</th><th className="p-2">Return</th>
          <th className="p-2 text-right">Total</th></tr></thead>
        <tbody>{ledger.data?.payments.map((p) => (
          <tr key={p.id} className="border-t"><td className="p-2 font-mono">{p.docNumber}</td><td className="p-2">{p.docDate}</td><td className="p-2">{p.challanRef}</td>
            <td className="p-2">{p.month ? monthLabel(p.month) : '—'}</td><td className="p-2 text-right tabular-nums">{formatPaise(p.totalPaise)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
