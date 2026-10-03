import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';

export default function Purchases() {
  const canCreate = useCan('purchases.create');
  const [filter, setFilter] = useState({ from: '', to: '', status: '' as '' | 'posted' | 'cancelled' });
  const list = useInfiniteQuery({
    queryKey: ['purchases', filter],
    queryFn: ({ pageParam }) => api.purchases.list({
      limit: 50, ...(filter.from && { from: filter.from }), ...(filter.to && { to: filter.to }), ...(filter.status && { status: filter.status }), ...(pageParam && { cursor: pageParam }),
    }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Purchases</h1>{canCreate && <Link to="/purchases/new" className="btn-primary">New purchase</Link>}</div>
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="pl-from">From</label><input id="pl-from" type="date" className="input" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="pl-to">To</label><input id="pl-to" type="date" className="input" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
        <div><label className="label" htmlFor="pl-status">Status</label>
          <select id="pl-status" className="input" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}><option value="">All</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select></div>
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Number</th><th className="p-2">Date</th><th className="p-2">Supplier</th><th className="p-2">Bill no.</th><th className="p-2">Due</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Owed</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`border-t ${p.status === 'cancelled' ? 'text-slate-400 line-through' : ''}`}>
              <td className="p-2"><Link to={`/purchases/${p.id}`} className="text-blue-800">{p.docNumber}</Link></td><td className="p-2">{p.docDate}</td><td className="p-2">{p.supplierName}</td>
              <td className="p-2">{p.supplierInvoiceNo}</td><td className="p-2">{p.dueDate}</td>
              <td className="p-2 text-right tabular-nums">{formatPaise(p.totalPaise)}</td><td className="p-2 text-right tabular-nums">{formatPaise(p.status === 'posted' ? p.totalPaise - p.settledPaise : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}>Show more</button>}
    </div>
  );
}
