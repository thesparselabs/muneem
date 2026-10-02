import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { useDebounced } from '../../lib/useDebounced.js';

export default function StockList() {
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [tab, setTab] = useState<'stock' | 'valuation'>('stock');
  const q = useDebounced(query.trim(), 120);
  const stock = useInfiniteQuery({
    queryKey: ['stock', q, lowOnly],
    queryFn: ({ pageParam }) => api.inventory.getStock({ lowOnly, limit: 100, ...(q && { query: q }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined, enabled: tab === 'stock',
  });
  const rows = stock.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex gap-2">
          <Link to="/inventory/opening" className="btn-secondary">Opening stock</Link>
          <Link to="/inventory/adjust" className="btn-secondary">Adjust stock</Link>
          <Link to="/inventory/stock-take" className="btn-primary">Stock take</Link>
        </div>
      </div>
      <div className="flex gap-1" role="tablist">
        {(['stock', 'valuation'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`btn-secondary py-1 ${tab === t ? 'bg-slate-200' : ''}`} onClick={() => setTab(t)}>{t === 'stock' ? 'Stock' : 'Valuation'}</button>)}
      </div>
      {tab === 'valuation' ? <ValuationView /> : (
        <>
          <div className="card flex items-end gap-4">
            <div className="grow"><label className="label" htmlFor="stock-q">Search</label><input id="stock-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />Low stock only</label>
          </div>
          {stock.error && <p className="err" role="alert">{errorMessage(stock.error)}</p>}
          <table className="w-full rounded-lg border bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Product</th><th className="p-2 text-right">On hand</th><th className="p-2 text-right">Reorder at</th><th className="p-2 text-right">Avg cost</th><th className="p-2 text-right">Value</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} className="border-t">
                  <td className="p-2"><Link to={`/inventory/product/${r.productId}`} className="font-medium text-blue-800">{r.name}</Link> {r.low && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">Low</span>}</td>
                  <td className={`p-2 text-right tabular-nums ${r.qtyMilli < 0 ? 'text-red-700' : ''}`}>{scaledToText(r.qtyMilli, 3)} {r.uomCode}</td>
                  <td className="p-2 text-right tabular-nums">{r.reorderLevelMilli !== undefined ? `${scaledToText(r.reorderLevelMilli, 3)} ${r.uomCode}` : '—'}</td>
                  <td className="p-2 text-right tabular-nums">{formatPaise(r.avgCostPaise)}</td>
                  <td className="p-2 text-right tabular-nums">{formatPaise(r.valuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stock.hasNextPage && <button className="btn-secondary" onClick={() => void stock.fetchNextPage()}>Load more</button>}
        </>
      )}
    </div>
  );
}

function ValuationView() {
  const v = useQuery({ queryKey: ['valuation'], queryFn: () => api.inventory.valuation({}) });
  if (v.error) return <p className="err" role="alert">{errorMessage(v.error)}</p>;
  if (!v.data) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-3 gap-4 text-sm">
        <div><p className="text-slate-500">Stock value</p><p className="text-2xl font-semibold">{formatPaise(v.data.totalValuePaise)}</p></div>
        <div><p className="text-slate-500">Products below zero</p><p className="text-2xl font-semibold">{v.data.negativeCount}</p></div>
        <div><p className="text-slate-500">Ledger check</p><p className={`text-lg font-semibold ${v.data.balanced ? 'text-green-700' : 'text-red-700'}`}>{v.data.balanced ? 'Balanced' : `Off by ${formatPaise(v.data.totalValuePaise - v.data.movementValuePaise)}`}</p></div>
      </div>
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Product</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Avg cost</th><th className="p-2 text-right">Value</th></tr></thead>
        <tbody>{v.data.rows.map((r) => <tr key={r.productId} className="border-t"><td className="p-2">{r.name}</td><td className="p-2 text-right tabular-nums">{scaledToText(r.qtyMilli, 3)} {r.uomCode}</td><td className="p-2 text-right tabular-nums">{formatPaise(r.avgCostPaise)}</td><td className="p-2 text-right tabular-nums">{formatPaise(r.valuePaise)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
