import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const canCancel = useCan('payments.cancel');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const payment = useQuery({ queryKey: ['payment', id], queryFn: () => api.payments.get({ id: id! }) });
  const p = payment.data;
  if (payment.error) return <p className="err" role="alert">{errorMessage(payment.error)}</p>;
  if (!p) return <p>Loading…</p>;
  async function cancel() {
    try { await api.payments.cancel({ id: id!, reason }); await qc.invalidateQueries(); } catch (e) { setError(errorMessage(e)); }
  }
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{p.direction === 'in' ? 'Receipt' : 'Payment'} {p.docNumber}{p.status === 'cancelled' && <span className="text-amber-700"> (cancelled)</span>}</h1>
        <Link to="/payments" className="btn-secondary">Payments</Link>
      </div>
      <div className="card grid grid-cols-2 gap-2 text-sm">
        <p>{p.direction === 'in' ? 'From' : 'To'}: <Link to={`/parties/${p.partyType}/${p.partyId}`} className="text-blue-800">{p.partyName}</Link></p>
        <p>Date: {p.paymentDate}</p><p>Method: {p.method.toUpperCase()}{p.reference && ` · ${p.reference}`}</p>
        <p>Amount: <span className="font-semibold">{formatPaise(p.amountPaise)}</span></p>
        <p>Applied: {formatPaise(p.allocatedPaise)} · advance {formatPaise(p.amountPaise - p.allocatedPaise)}</p>
        {p.drawerSessionId && <p>Through the register drawer</p>}
        {p.cancelReason && <p>Cancelled: {p.cancelReason}</p>}
      </div>
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Settled</th><th className="p-2 text-right">Amount</th></tr></thead>
        <tbody>{p.allocations.map((a) => <tr key={a.id} className={`border-t ${a.voided ? 'text-slate-400 line-through' : ''}`}><td className="p-2">{a.docNumber ?? a.targetType}</td><td className="p-2 text-right tabular-nums">{formatPaise(a.amountPaise)}</td></tr>)}</tbody>
      </table>
      {p.status === 'posted' && canCancel && (
        <div className="card flex items-end gap-2">
          <div className="grow"><label className="label" htmlFor="pc-reason">Reason to cancel</label><input id="pc-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <button type="button" className="btn-secondary" disabled={!reason.trim()} onClick={() => void cancel()}>Cancel payment</button>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
