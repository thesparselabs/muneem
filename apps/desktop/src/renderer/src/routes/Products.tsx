import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ProductHit } from '@muneem/contracts';
import { api } from '../api.js';
import { formatPaise, formatRateBp } from '../lib/money.js';
import { useDebounced } from '../lib/useDebounced.js';

const SEARCH_DEBOUNCE_MS = 120;

export default function Products() {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const q = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.listCategories({}) });
  const search = useQuery({ queryKey: ['products', 'search', q], queryFn: () => api.products.search({ query: q, limit: 50 }), enabled: q !== '' });
  const list = useInfiniteQuery({
    queryKey: ['products', 'list', categoryId, includeInactive],
    queryFn: ({ pageParam }) => api.products.list({ limit: 50, includeInactive, ...(categoryId && { categoryId }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: q === '',
  });
  const rows = q ? search.data ?? [] : list.data?.pages.flatMap((p) => p.items) ?? [];
  const loading = q ? search.isLoading : list.isLoading;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex gap-2">
          <Link to="/settings/catalog" className="btn-secondary">Units, categories &amp; price lists</Link>
          <Link to="/products/import" className="btn-secondary">Import from file</Link>
          <Link to="/products/new" className="btn-primary">Add product</Link>
        </div>
      </div>
      <div className="card flex flex-wrap items-end gap-4">
        <div className="grow">
          <label className="label" htmlFor="product-search">Search by name, SKU, barcode, HSN or brand</label>
          <input id="product-search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan or type…" autoFocus maxLength={64} />
        </div>
        <div>
          <label className="label" htmlFor="category-filter">Category</label>
          <select id="category-filter" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={q !== ''}>
            <option value="">All</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} disabled={q !== ''} />
          Show deactivated
        </label>
      </div>
      <ProductTable rows={rows} loading={loading} empty={q ? `Nothing matches "${q}".` : 'No products yet. Add one or import a file.'} />
      {!q && list.hasNextPage && (
        <button className="btn-secondary" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>Load more</button>
      )}
    </div>
  );
}

function ProductTable({ rows, loading, empty }: { rows: ProductHit[]; loading: boolean; empty: string }) {
  const nav = useNavigate();
  if (loading) return <p className="text-sm text-slate-500" role="status">Loading…</p>;
  if (rows.length === 0) return <p className="card text-sm text-slate-600">{empty}</p>;
  return (
    <table className="table-modern bg-white border rounded-lg overflow-hidden">
      <thead>
        <tr><th>Name</th><th>SKU</th><th>Barcode</th><th>Brand</th><th>Category</th><th className="text-right">Price</th><th className="text-right">GST</th><th>Status</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.productId}-${r.uomId}`} className="hover:bg-blue-50 cursor-pointer" onClick={() => nav(`/products/${r.productId}`)}>
            <td><Link to={`/products/${r.productId}`} className="font-medium text-blue-800" onClick={(e) => e.stopPropagation()}>{r.name}</Link></td>
            <td className="font-mono text-xs">{r.sku ?? ''}</td>
            <td className="font-mono text-xs">{r.barcode ?? ''}</td>
            <td>{r.brandName ?? ''}</td>
            <td>{r.categoryName ?? ''}</td>
            <td className="text-right tabular-nums">{formatPaise(r.pricePaise)}<span className="text-xs text-slate-500"> /{r.uomCode}</span></td>
            <td className="text-right">{r.taxTreatment === 'taxable' ? formatRateBp(r.gstRateBp) : r.taxTreatment.replace('_', ' ')}</td>
            <td>{r.isActive ? 'Active' : <span className="text-slate-500">Deactivated</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
