import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { Truck, Plus } from 'lucide-react';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><Truck size={22} className="text-primary" aria-hidden />Purchases</h1>{canCreate && <Link to="/purchases/new" className="btn-primary"><Plus size={16} aria-hidden />New purchase</Link>}</div>
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="pl-from">From</label><DatePicker id="pl-from" value={filter.from} onChange={(v) => setFilter({ ...filter, from: v })} /></div>
        <div><label className="label" htmlFor="pl-to">To</label><DatePicker id="pl-to" value={filter.to} onChange={(v) => setFilter({ ...filter, to: v })} /></div>
        <div><label className="label" htmlFor="pl-status">Status</label>
          <select id="pl-status" className="select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}><option value="">All</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select></div>
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Number</th><th>Date</th><th>Supplier</th><th>Bill no.</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Owed</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={p.status === 'cancelled' ? 'text-muted-foreground line-through' : ''}>
              <td><Link to={`/purchases/${p.id}`} className="text-primary">{p.docNumber}</Link></td><td>{p.docDate}</td><td>{p.supplierName}</td>
              <td>{p.supplierInvoiceNo}</td><td>{p.dueDate}</td>
              <td className="text-right tabular-nums">{formatPaise(p.totalPaise)}</td><td className="text-right tabular-nums">{formatPaise(p.status === 'posted' ? p.totalPaise - p.settledPaise : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}>Show more</button>}
    </div>
  );
}
