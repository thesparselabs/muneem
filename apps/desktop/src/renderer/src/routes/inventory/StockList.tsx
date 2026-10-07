import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { useDebounced } from '../../lib/useDebounced.js';
import ExportMenu from '../../components/ExportMenu.js';
import { AlertTriangle, Boxes, ClipboardCheck, GitCompare, PackagePlus, SlidersHorizontal, ChevronDown } from 'lucide-react';

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Boxes size={22} className="text-primary" aria-hidden />Inventory</h1>
        <div className="flex gap-2">
          <ExportMenu reportId="stock.valuation" />
          <Link to="/inventory/reconciliation" className="btn-secondary"><GitCompare size={16} aria-hidden />Reconciliation</Link>
          <Link to="/inventory/opening" className="btn-secondary"><PackagePlus size={16} aria-hidden />Opening stock</Link>
          <Link to="/inventory/adjust" className="btn-secondary"><SlidersHorizontal size={16} aria-hidden />Adjust stock</Link>
          <Link to="/inventory/stock-take" className="btn-primary"><ClipboardCheck size={16} aria-hidden />Stock take</Link>
        </div>
      </div>
      <div className="flex shrink-0 gap-1" role="tablist">
        {(['stock', 'valuation'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`btn-secondary py-1 ${tab === t ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setTab(t)}>{t === 'stock' ? 'Stock' : 'Valuation'}</button>)}
      </div>
      {tab === 'valuation' ? <ValuationView /> : (
        <>
          <div className="card flex shrink-0 items-end gap-4">
            <div className="grow"><label className="label" htmlFor="stock-q">Search</label><input id="stock-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />Low stock only</label>
          </div>
          {stock.error && <p className="err" role="alert">{errorMessage(stock.error)}</p>}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
          <table className="table-modern">
            <thead><tr><th>Product</th><th className="text-right">On hand</th><th className="text-right">Reorder at</th><th className="text-right">Avg cost</th><th className="text-right">Value</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td><Link to={`/inventory/product/${r.productId}`} className="font-medium text-primary">{r.name}</Link> {r.low && <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-500/20 px-1.5 text-xs text-amber-900 dark:text-amber-300"><AlertTriangle size={11} aria-hidden />Low</span>}</td>
                  <td className={`text-right tabular-nums ${r.qtyMilli < 0 ? 'text-destructive' : ''}`}>{scaledToText(r.qtyMilli, 3)} {r.uomCode}</td>
                  <td className="text-right tabular-nums">{r.reorderLevelMilli !== undefined ? `${scaledToText(r.reorderLevelMilli, 3)} ${r.uomCode}` : '—'}</td>
                  <td className="text-right tabular-nums">{formatPaise(r.avgCostPaise)}</td>
                  <td className="text-right tabular-nums">{formatPaise(r.valuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {stock.hasNextPage && <button className="btn-secondary shrink-0 self-start" onClick={() => void stock.fetchNextPage()}><ChevronDown size={16} aria-hidden />Load more</button>}
        </>
      )}
    </div>
  );
}

function ValuationView() {
  const v = useQuery({ queryKey: ['valuation'], queryFn: () => api.inventory.valuation({}) });
  if (v.error) return <p className="err" role="alert">{errorMessage(v.error)}</p>;
  if (!v.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
        <div><p className="text-muted-foreground">Stock value</p><p className="text-2xl font-semibold">{formatPaise(v.data.totalValuePaise)}</p></div>
        <div><p className="text-muted-foreground">Products below zero</p><p className="text-2xl font-semibold">{v.data.negativeCount}</p></div>
        <div><p className="text-muted-foreground">Ledger check</p><p className={`text-lg font-semibold ${v.data.balanced ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>{v.data.balanced ? 'Balanced' : `Off by ${formatPaise(v.data.totalValuePaise - v.data.movementValuePaise)}`}</p></div>
      </div>
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Avg cost</th><th className="text-right">Value</th></tr></thead>
        <tbody>{v.data.rows.map((r) => <tr key={r.productId}><td>{r.name}</td><td className="text-right tabular-nums">{scaledToText(r.qtyMilli, 3)} {r.uomCode}</td><td className="text-right tabular-nums">{formatPaise(r.avgCostPaise)}</td><td className="text-right tabular-nums">{formatPaise(r.valuePaise)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
