import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CustomerInput, type Customer } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import Field from '../../components/Field.js';
import { useDebounced } from '../../lib/useDebounced.js';

export default function CustomerDialog({ onPick, onClose }: { onPick: (c: Customer | null) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useDebounced(query.trim(), 120);
  const found = useQuery({ queryKey: ['customers', q], queryFn: () => api.customers.search({ query: q, limit: 10 }), enabled: q !== '' });
  return (
    <Dialog title="Customer (F3)" onClose={onClose}>
      {creating ? <NewCustomer initialName={query} onCreated={onPick} /> : (
        <div className="space-y-3">
          <Field label="Search by name, phone or GSTIN" htmlFor="cust-q"><input id="cust-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} /></Field>
          <ul className="divide-y text-sm">
            {found.data?.map((c) => (
              <li key={c.id}><button type="button" className="w-full py-2 text-left hover:bg-blue-50" onClick={() => onPick(c)}>
                <span className="font-medium">{c.name}</span> <span className="text-slate-500">{[c.phone, c.gstin].filter(Boolean).join(' · ')}</span>
              </button></li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(true)}>New customer</button>
            <button type="button" className="btn-secondary" onClick={() => onPick(null)}>Walk-in (no customer)</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function NewCustomer({ initialName, onCreated }: { initialName: string; onCreated: (c: Customer) => void }) {
  const [f, setF] = useState({ name: /^\d+$/u.test(initialName) ? '' : initialName, phone: /^\d+$/u.test(initialName) ? initialName : '', gstin: '' });
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = CustomerInput.safeParse({ name: f.name, ...(f.phone && { phone: f.phone }), ...(f.gstin && { gstin: f.gstin.toUpperCase() }) });
    if (!parsed.success) { setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')); return; }
    try { onCreated(await api.customers.create(parsed.data)); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name" htmlFor="nc-name"><input id="nc-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
      <Field label="Phone" htmlFor="nc-phone"><input id="nc-phone" className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="GSTIN (for a B2B invoice)" htmlFor="nc-gstin"><input id="nc-gstin" className="input uppercase" maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} /></Field>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary">Save customer</button>
    </form>
  );
}
