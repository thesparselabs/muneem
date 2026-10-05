import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PartyType } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { useDebounced } from '../../lib/useDebounced.js';
import { CustomerEditDialog, SupplierDialog } from './PartyDialogs.js';

export default function Parties() {
  const nav = useNavigate();
  const canSuppliers = useCan('suppliers.view');
  const [tab, setTab] = useState<PartyType>('customer');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const q = useDebounced(query.trim(), 120);
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  const list = useQuery({
    queryKey: ['parties', tab, q],
    queryFn: async (): Promise<{ id: string; name: string; phone?: string | undefined; gstin?: string | undefined }[]> =>
      (tab === 'customer' ? api.customers.search({ query: q, limit: 50 }) : api.suppliers.search({ query: q, limit: 50 })),
  });
  const balances = useQuery({
    queryKey: ['outstanding', tab],
    queryFn: () => (tab === 'customer' ? api.customers.getOutstanding({}) : api.suppliers.getOutstanding({})),
  });
  const net = new Map(balances.data?.rows.map((r) => [r.partyId, r.netPaise]) ?? []);
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Parties</h1>
        <div className="flex gap-2">
          <Link to="/parties/outstanding" className="btn-secondary">Outstanding</Link>
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>New {tab}</button>
        </div>
      </div>
      <div className="flex gap-1" role="tablist">
        {(['customer', 'supplier'] as const).filter((t) => t === 'customer' || canSuppliers).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`btn-secondary py-1 ${tab === t ? 'bg-slate-200' : ''}`} onClick={() => setTab(t)}>{t === 'customer' ? 'Customers' : 'Suppliers'}</button>
        ))}
      </div>
      <div className="card"><label className="label" htmlFor="party-q">Search</label><input id="party-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <table className="table-modern rounded-lg border bg-white">
        <thead><tr><th>Name</th><th>Phone</th><th>GSTIN</th><th className="text-right">{tab === 'customer' ? 'Owes us' : 'We owe'}</th></tr></thead>
        <tbody>
          {list.data?.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/parties/${tab}/${p.id}`} className="text-blue-800">{p.name}</Link></td>
              <td>{p.phone ?? ''}</td><td className="font-mono text-xs">{p.gstin ?? ''}</td>
              <td className="text-right tabular-nums">{net.has(p.id) ? formatPaise(net.get(p.id)) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding && tab === 'customer' && <CustomerEditDialog onClose={() => setAdding(false)} onDone={(c) => nav(`/parties/customer/${c.id}`)} />}
      {adding && tab === 'supplier' && <SupplierDialog defaultState={branches.data?.[0]?.stateCode ?? ''} onClose={() => setAdding(false)} onDone={(s) => nav(`/parties/supplier/${s.id}`)} />}
    </div>
  );
}
