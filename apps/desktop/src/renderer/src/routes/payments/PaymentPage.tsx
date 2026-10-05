import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { Wallet, ArrowLeft } from 'lucide-react';

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
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Wallet size={22} className="text-primary" aria-hidden />{p.direction === 'in' ? 'Receipt' : 'Payment'} {p.docNumber}{p.status === 'cancelled' && <span className="text-amber-700 dark:text-amber-300"> (cancelled)</span>}</h1>
        <Link to="/payments" className="btn-secondary"><ArrowLeft size={16} aria-hidden />Payments</Link>
      </div>
      <div className="card grid grid-cols-2 gap-2 text-sm">
        <p>{p.direction === 'in' ? 'From' : 'To'}: <Link to={`/parties/${p.partyType}/${p.partyId}`} className="text-primary">{p.partyName}</Link></p>
        <p>Date: {p.paymentDate}</p><p>Method: {p.method.toUpperCase()}{p.reference && ` · ${p.reference}`}</p>
        <p>Amount: <span className="font-semibold">{formatPaise(p.amountPaise)}</span></p>
        <p>Applied: {formatPaise(p.allocatedPaise)} · advance {formatPaise(p.amountPaise - p.allocatedPaise)}</p>
        {p.drawerSessionId && <p>Through the register drawer</p>}
        {p.cancelReason && <p>Cancelled: {p.cancelReason}</p>}
      </div>
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Settled</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{p.allocations.map((a) => <tr key={a.id} className={a.voided ? 'text-muted-foreground line-through' : ''}><td>{a.docNumber ?? a.targetType}</td><td className="text-right tabular-nums">{formatPaise(a.amountPaise)}</td></tr>)}</tbody>
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
