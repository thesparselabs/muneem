import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import { formatPaise } from '../../lib/money.js';
import ExportMenu from '../../components/ExportMenu.js';
import { Wallet, Plus, ChevronDown } from 'lucide-react';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><Wallet size={22} className="text-primary" aria-hidden />Payments</h1><div className="flex gap-2"><ExportMenu reportId="money.payments" params={{ from: filter.from, to: filter.to }} /><Link to="/payments/new" className="btn-primary"><Plus size={16} aria-hidden />New payment</Link></div></div>
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="pl-from">From</label><DatePicker id="pl-from" value={filter.from} onChange={(v) => setFilter({ ...filter, from: v })} /></div>
        <div><label className="label" htmlFor="pl-to">To</label><DatePicker id="pl-to" value={filter.to} onChange={(v) => setFilter({ ...filter, to: v })} /></div>
        <div><label className="label" htmlFor="pl-status">Status</label>
          <select id="pl-status" className="select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}><option value="">All</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select></div>
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Number</th><th>Date</th><th>Party</th><th>Method</th><th className="text-right">Amount</th><th className="text-right">Unapplied</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={p.status === 'cancelled' ? 'text-muted-foreground line-through' : ''}>
              <td><Link to={`/payments/${p.id}`} className="text-primary">{p.docNumber}</Link></td><td>{p.paymentDate}</td>
              <td>{p.direction === 'in' ? '← ' : '→ '}{p.partyName}</td><td>{p.method.toUpperCase()}</td>
              <td className="text-right tabular-nums">{formatPaise(p.amountPaise)}</td><td className="text-right tabular-nums">{formatPaise(p.amountPaise - p.allocatedPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}><ChevronDown size={16} aria-hidden />Show more</button>}
    </div>
  );
}
