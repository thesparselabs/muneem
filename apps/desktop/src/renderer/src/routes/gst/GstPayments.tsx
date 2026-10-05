import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { EMPTY_CHALLAN, HEAD_LABELS, monthLabel, parseChallan, previousMonth, recentMonths, type ChallanText } from '../../lib/gst/gstForm.js';
import GstNav from './GstNav.js';
import DatePicker from '../../components/DatePicker.js';
import { Landmark, Check } from 'lucide-react';

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
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Landmark size={22} className="text-primary" aria-hidden />GST payments</h1>
      <GstNav />
      <p className="text-sm">GST payable (2300): <span className="font-semibold tabular-nums">{formatPaise(ledger.data?.payablePaise)}</span></p>
      {canRecord && (
        <form className="card grid grid-cols-4 gap-3" onSubmit={submit}>
          <div><label className="label" htmlFor="gp-date">Paid on</label><DatePicker id="gp-date" value={date} max={today} onChange={(v) => setDate(v)} required /></div>
          <div><label className="label" htmlFor="gp-ref">Challan (CPIN/CIN)</label><input id="gp-ref" className="input" value={challanRef} maxLength={40} onChange={(e) => setChallanRef(e.target.value)} required /></div>
          <div><label className="label" htmlFor="gp-month">For the return of</label>
            <select id="gp-month" className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
              {recentMonths(today, 24).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select></div>
          <div />
          {HEAD_LABELS.map(([k, label]) => (
            <div key={k}><label className="label" htmlFor={`gp-${k}`}>{label} (₹)</label>
              <input id={`gp-${k}`} className="input" inputMode="decimal" value={amounts[k]} onChange={(e) => setAmounts({ ...amounts, [k]: e.target.value })} /></div>
          ))}
          <div className="col-span-4"><button type="submit" className="btn-primary"><Check size={16} aria-hidden />Record payment</button></div>
        </form>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Number</th><th>Date</th><th>Challan</th><th>Return</th>
          <th className="text-right">Total</th></tr></thead>
        <tbody>{ledger.data?.payments.map((p) => (
          <tr key={p.id}><td className="font-mono">{p.docNumber}</td><td>{p.docDate}</td><td>{p.challanRef}</td>
            <td>{p.month ? monthLabel(p.month) : '—'}</td><td className="text-right tabular-nums">{formatPaise(p.totalPaise)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
