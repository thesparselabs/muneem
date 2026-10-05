import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import { formatPaise } from '../../lib/money.js';

export default function Payments() {
  const [filter, setFilter] = useState({ from: '', to: '', status: '' as '' | 'posted' | 'cancelled' });
  const list = useInfiniteQuery({
    queryKey: ['payments', filter],
    queryFn: ({ pageParam }) => api.payments.list({
      limit: 50, ...(filter.from && { from: filter.from }), ...(filter.to && { to: filter.to }), ...(filter.status && { status: filter.status }), ...(pageParam && { cursor: pageParam }),
    }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Payments</h1><Link to="/payments/new" className="btn-primary">New payment</Link></div>
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="pl-from">From</label><DatePicker id="pl-from" value={filter.from} onChange={(v) => setFilter({ ...filter, from: v })} /></div>
        <div><label className="label" htmlFor="pl-to">To</label><DatePicker id="pl-to" value={filter.to} onChange={(v) => setFilter({ ...filter, to: v })} /></div>
        <div><label className="label" htmlFor="pl-status">Status</label>
          <select id="pl-status" className="select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}><option value="">All</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select></div>
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <table className="table-modern rounded-lg border bg-white">
        <thead><tr><th>Number</th><th>Date</th><th>Party</th><th>Method</th><th className="text-right">Amount</th><th className="text-right">Unapplied</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={p.status === 'cancelled' ? 'text-slate-400 line-through' : ''}>
              <td><Link to={`/payments/${p.id}`} className="text-blue-800">{p.docNumber}</Link></td><td>{p.paymentDate}</td>
              <td>{p.direction === 'in' ? '← ' : '→ '}{p.partyName}</td><td>{p.method.toUpperCase()}</td>
              <td className="text-right tabular-nums">{formatPaise(p.amountPaise)}</td><td className="text-right tabular-nums">{formatPaise(p.amountPaise - p.allocatedPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}>Show more</button>}
    </div>
  );
}
