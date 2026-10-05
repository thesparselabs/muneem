import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PartyType } from '@muneem/contracts';
import { api } from '../api.js';
import { useDebounced } from '../lib/useDebounced.js';

export interface PickedParty { partyType: PartyType; id: string; name: string }

export default function PartyPicker({ id, partyType, onPick }: { id: string; partyType: PartyType; onPick: (p: PickedParty) => void }) {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 120);
  const hits = useQuery({
    queryKey: ['partyPicker', partyType, q], enabled: q !== '',
    queryFn: async (): Promise<{ id: string; name: string; phone?: string | undefined; gstin?: string | undefined }[]> =>
      (partyType === 'customer' ? api.customers.search({ query: q, limit: 8 }) : api.suppliers.search({ query: q, limit: 8 })),
  });
  return (
    <div className="relative">
      <label className="label" htmlFor={id}>{partyType === 'customer' ? 'Customer' : 'Supplier'}</label>
      <input id={id} className="input" placeholder="Name, phone or GSTIN" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      {hits.data && hits.data.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full divide-y rounded border border-border bg-card text-sm shadow">
          {hits.data.map((p) => (
            <li key={p.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-accent" onClick={() => { onPick({ partyType, id: p.id, name: p.name }); setQuery(''); }}>
              <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">{[p.phone, p.gstin].filter(Boolean).join(' · ')}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
