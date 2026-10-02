import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdjustmentResult } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { countDiffs, countProblems, setCount, type Counts } from '../../lib/inventory/stockTake.js';
import { useDebounced } from '../../lib/useDebounced.js';

export default function StockTake() {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [counts, setCounts] = useState<Counts>({});
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<AdjustmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.listCategories({}) });
  const q = useDebounced(query.trim(), 150);
  const stock = useInfiniteQuery({
    queryKey: ['stockTake', categoryId, q],
    queryFn: ({ pageParam }) => api.inventory.getStock({ limit: 200, lowOnly: false, ...(categoryId && { categoryId }), ...(q && { query: q }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = stock.data?.pages.flatMap((p) => p.items) ?? [];
  const { diffs, errors, counted } = countDiffs(counts);

  async function post() {
    setError(null);
    try {
      setResult(await api.inventory.stockTake({ counts: diffs.map((d) => ({ productId: d.productId, countedMilli: d.countedMilli })) }));
      setCounts({}); setReviewing(false);
      await qc.invalidateQueries();
    } catch (e) { setError(errorMessage(e)); }
  }

  if (result) {
    return (
      <div className="card max-w-xl space-y-3" role="status">
        <h1 className="text-xl font-semibold">Stock take posted</h1>
        <p className="text-sm">{result.lines.length} product(s) corrected, {result.unchanged} already right. Value change {formatPaise(result.lines.reduce((s, l) => s + l.valuePaise, 0))}.</p>
        <div className="flex gap-2"><button className="btn-primary" onClick={() => setResult(null)}>Count more</button><Link to="/inventory" className="btn-secondary">Back to inventory</Link></div>
      </div>
    );
  }
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Stock take</h1><Link to="/inventory" className="btn-secondary">Cancel</Link></div>
      <p className="text-sm text-slate-600">Count what is on the shelf and enter it. Leave a product blank if you did not count it. Differences are worked out when you post, so sales made while counting are taken into account.</p>
      <div className="card flex items-end gap-4">
        <div><label className="label" htmlFor="st-cat">Category</label>
          <select id="st-cat" className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setReviewing(false); }}>
            <option value="">All products</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grow"><label className="label" htmlFor="st-q">Search</label><input id="st-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <p className="pb-2 text-sm text-slate-600">{counted} counted across all categories</p>
      </div>
      {!reviewing ? (
        <table className="w-full rounded-lg border bg-white text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Product</th><th className="p-2 text-right">System</th><th className="p-2">Counted</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="border-t">
                <td className="p-2">{r.name} <span className="text-slate-500">{r.sku}</span></td>
                <td className="p-2 text-right tabular-nums">{scaledToText(r.qtyMilli, 3)} {r.uomCode}</td>
                <td className="p-2"><input aria-label={`Counted ${r.name}`} className="input w-28 py-1" inputMode="decimal" value={counts[r.productId]?.text ?? ''} onChange={(e) => setCounts(setCount(counts, r, e.target.value))} />
                  {errors[r.productId] && <p className="err">{errors[r.productId]}</p>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full rounded-lg border bg-white text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Product</th><th className="p-2 text-right">System</th><th className="p-2 text-right">Counted</th><th className="p-2 text-right">Difference</th></tr></thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.productId} className="border-t">
                <td className="p-2">{d.name}</td>
                <td className="p-2 text-right tabular-nums">{scaledToText(d.systemMilli, 3)}</td>
                <td className="p-2 text-right tabular-nums">{scaledToText(d.countedMilli, 3)}</td>
                <td className={`p-2 text-right tabular-nums ${d.diffMilli < 0 ? 'text-red-700' : d.diffMilli > 0 ? 'text-green-800' : 'text-slate-500'}`}>{d.diffMilli > 0 ? '+' : ''}{scaledToText(d.diffMilli, 3)} {d.uomCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!reviewing && stock.hasNextPage && <button className="btn-secondary" onClick={() => void stock.fetchNextPage()}>Load more products</button>}
      {error && <p className="err" role="alert">{error}</p>}
      {Object.keys(errors).length > 0 && <p className="err" role="alert">Fix these counts first: {countProblems(counts, errors).join(', ')}</p>}
      <div className="flex gap-2">
        {!reviewing
          ? <button className="btn-primary" disabled={diffs.length === 0 || Object.keys(errors).length > 0} onClick={() => setReviewing(true)}>Review differences</button>
          : <><button className="btn-primary" onClick={() => void post()}>Post stock take</button><button className="btn-secondary" onClick={() => setReviewing(false)}>Back to counting</button></>}
      </div>
    </div>
  );
}
