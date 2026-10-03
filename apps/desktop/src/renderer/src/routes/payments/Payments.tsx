import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
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
        <div><label className="label" htmlFor="pl-from">From</label><input id="pl-from" type="date" className="input" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="pl-to">To</label><input id="pl-to" type="date" className="input" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <div><label className="label" htmlFor="pl-status">Status</label>
          <select id="pl-status" className="input" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}><option value="">All</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select></div>
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Number</th><th className="p-2">Date</th><th className="p-2">Party</th><th className="p-2">Method</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Unapplied</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`border-t ${p.status === 'cancelled' ? 'text-slate-400 line-through' : ''}`}>
              <td className="p-2"><Link to={`/payments/${p.id}`} className="text-blue-800">{p.docNumber}</Link></td><td className="p-2">{p.paymentDate}</td>
              <td className="p-2">{p.direction === 'in' ? '← ' : '→ '}{p.partyName}</td><td className="p-2">{p.method.toUpperCase()}</td>
              <td className="p-2 text-right tabular-nums">{formatPaise(p.amountPaise)}</td><td className="p-2 text-right tabular-nums">{formatPaise(p.amountPaise - p.allocatedPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}>Show more</button>}
    </div>
  );
}
