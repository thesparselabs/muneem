import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductHit } from '@muneem/contracts';
import { api } from '../api.js';
import { scaledToText } from '../lib/money.js';
import { useDebounced } from '../lib/useDebounced.js';

export default function ProductPicker({ id, label, onPick }: { id: string; label: string; onPick: (h: ProductHit) => void }) {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 120);
  const hits = useQuery({ queryKey: ['picker', q], queryFn: () => api.products.search({ query: q, limit: 8 }), enabled: q.length > 0 });
  const pick = (h: ProductHit) => { onPick(h); setQuery(''); };
  return (
    <div className="relative">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder="Name, SKU or barcode"
        onKeyDown={(e) => { if (e.key === 'Enter' && hits.data?.[0]) { e.preventDefault(); pick(hits.data[0]); } }} />
      {q && hits.data && hits.data.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full divide-y rounded-md border border-border bg-card text-sm shadow">
          {hits.data.map((h) => (
            <li key={`${h.productId}-${h.uomId}`}><button type="button" className="flex w-full justify-between px-3 py-2 text-left hover:bg-accent" onClick={() => pick(h)}>
              <span>{h.name} <span className="text-muted-foreground">{h.sku}</span></span>
              <span className="tabular-nums text-muted-foreground">{scaledToText(h.stockMilli, 3)} {h.baseUomCode} in stock</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
