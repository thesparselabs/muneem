import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PAYMENT_METHODS, type PartyType } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import Field from '../../components/Field.js';
import PartyPicker, { type PickedParty } from '../../components/PartyPicker.js';
import { parseOptional } from '../../lib/money.js';
import { summarise, toChoice, type GridItem, type GridMode } from '../../lib/payments/allocationGrid.js';
import { useCan } from '../../lib/permissions.js';
import AllocationGrid from './AllocationGrid.js';
import { Wallet, Save, X } from 'lucide-react';

export default function NewPayment() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const canSuppliers = useCan('suppliers.view');
  const [partyType, setPartyType] = useState<PartyType>(params.get('partyType') === 'supplier' ? 'supplier' : 'customer');
  const [party, setParty] = useState<PickedParty | null>(null);
  const partyId = party?.id ?? params.get('partyId') ?? '';
  const preset = useQuery({
    queryKey: ['party', partyType, partyId], enabled: !party && !!partyId,
    queryFn: async () => (partyType === 'customer' ? api.customers.get({ id: partyId }) : api.suppliers.get({ id: partyId })),
  });
  const partyName = party?.name ?? preset.data?.name;
  const [f, setF] = useState({ amount: '', method: 'cash' as (typeof PAYMENT_METHODS)[number], date: new Date().toLocaleDateString('en-CA'), reference: '' });
  const [mode, setMode] = useState<GridMode>('auto');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [commandId] = useState(newUlid);
  const open = useQuery({ queryKey: ['openItems', partyType, partyId], queryFn: () => api.payments.openItems({ partyType, partyId }), enabled: !!partyId });
  const items: GridItem[] = (open.data?.charges ?? []).map((c) => ({ ...c, type: c.type as GridItem['type'] }));
  const amountPaise = parseOptional(f.amount, 2);
  const summary = summarise(mode, items, amountPaise && amountPaise > 0 ? amountPaise : 0, typed);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!partyId) { setError(`Choose the ${partyType}`); return; }
    if (!amountPaise || amountPaise <= 0) { setError('Enter the amount'); return; }
    if (Object.keys(summary.errors).length > 0) { setError('Fix the allocation first'); return; }
    try {
      const p = await api.payments.create({
        partyType, partyId, amountPaise, method: f.method, paymentDate: f.date, commandId,
        ...(f.reference.trim() && { reference: f.reference.trim() }), allocation: toChoice(mode, items, summary),
      });
      await qc.invalidateQueries();
      nav(`/payments/${p.id}`);
    } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <form onSubmit={submit} className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><Wallet size={22} className="text-primary" aria-hidden />{partyType === 'customer' ? 'Receive payment' : 'Pay supplier'}</h1><Link to="/payments" className="btn-secondary"><X size={16} aria-hidden />Cancel</Link></div>
      <div className="card grid grid-cols-2 gap-3">
        {!params.get('partyId') && (
          <div className="col-span-2 flex gap-1" role="tablist">
            {(['customer', 'supplier'] as const).filter((t) => t === 'customer' || canSuppliers).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={partyType === t} className={`btn-secondary py-1 ${partyType === t ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => { setPartyType(t); setParty(null); }}>{t === 'customer' ? 'From a customer' : 'To a supplier'}</button>
            ))}
          </div>
        )}
        {partyName ? <p className="col-span-2 font-medium">{partyName}</p> : <div className="col-span-2"><PartyPicker id="pay-party" partyType={partyType} onPick={setParty} /></div>}
        <Field label="Amount (₹)" htmlFor="pay-amount"><input id="pay-amount" className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Method" htmlFor="pay-method">
          <select id="pay-method" className="select" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as typeof f.method })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
        </Field>
        <Field label="Date" htmlFor="pay-date"><DatePicker id="pay-date" value={f.date} onChange={(v) => setF({ ...f, date: v })} /></Field>
        <Field label="Reference" htmlFor="pay-ref" hint="Cheque or UTR number"><input id="pay-ref" className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      </div>
      {partyId && <div className="card"><AllocationGrid items={items} mode={mode} typed={typed} summary={summary} onMode={setMode} onType={(id, v) => setTyped({ ...typed, [id]: v })} /></div>}
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save payment</button>
    </form>
  );
}
