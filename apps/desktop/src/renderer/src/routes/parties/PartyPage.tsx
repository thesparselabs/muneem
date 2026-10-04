import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, PartyType, Supplier } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { AGEING_COLUMNS } from '../../lib/parties/forms.js';
import { useCan } from '../../lib/permissions.js';
import { CreditLimitDialog, CustomerEditDialog, OpeningDialog, SupplierDialog, WriteOffDialog } from './PartyDialogs.js';

type Modal = 'edit' | 'opening' | 'limit' | 'writeOff' | null;
const REF_LABEL: Record<string, string> = { sale: 'Sale', purchase: 'Purchase', debit_note: 'Debit note', credit_note: 'Credit note', payment: 'Payment', write_off: 'Write-off', opening: 'Opening balance', expense: 'Expense' };

export default function PartyPage() {
  const { kind, id } = useParams<{ kind: PartyType; id: string }>();
  const partyType: PartyType = kind === 'supplier' ? 'supplier' : 'customer';
  const qc = useQueryClient();
  const [modal, setModal] = useState<Modal>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState<string | null>(null);
  const canApproveCredit = useCan('customers.approve');
  const canWriteOff = useCan('payments.approve');
  const canPay = useCan('payments.create');
  const party = useQuery({
    queryKey: ['party', partyType, id],
    queryFn: async (): Promise<Customer | Supplier> => (partyType === 'customer' ? api.customers.get({ id: id! }) : api.suppliers.get({ id: id! })),
  });
  const ledgerApi = partyType === 'customer' ? api.customers : api.suppliers;
  const statement = useInfiniteQuery({
    queryKey: ['statement', partyType, id, range],
    queryFn: ({ pageParam }) => ledgerApi.getLedger({ partyId: id!, limit: 100, ...(range.from && { from: range.from }), ...(range.to && { to: range.to }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const ageing = useQuery({ queryKey: ['outstanding', partyType, id], queryFn: () => ledgerApi.getOutstanding({ partyId: id! }) });
  const open = useQuery({ queryKey: ['openItems', partyType, id], queryFn: () => api.payments.openItems({ partyType, partyId: id! }), enabled: canPay });
  const done = () => { setModal(null); void qc.invalidateQueries(); };
  const p = party.data;
  const first = statement.data?.pages[0];
  const last = statement.data?.pages.at(-1);
  const lines = statement.data?.pages.flatMap((pg) => pg.items) ?? [];
  const row = ageing.data?.rows[0];
  if (party.error) return <p className="err" role="alert">{errorMessage(party.error)}</p>;
  if (!p) return <p>Loading…</p>;
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <p className="text-sm text-slate-600">{partyType === 'customer' ? 'Customer' : 'Supplier'}{p.gstin && ` · ${p.gstin}`} · {p.creditDays} credit days
            {'creditLimitPaise' in p && ` · limit ${p.creditLimitPaise === null ? 'not set' : formatPaise(p.creditLimitPaise)}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPay && <Link to={`/payments/new?partyType=${partyType}&partyId=${p.id}`} className="btn-primary">{partyType === 'customer' ? 'Receive payment' : 'Pay supplier'}</Link>}
          <button type="button" className="btn-secondary" onClick={() => setModal('edit')}>Edit</button>
          <button type="button" className="btn-secondary" onClick={() => setModal('opening')}>Opening balance</button>
          {partyType === 'customer' && canApproveCredit && <button type="button" className="btn-secondary" onClick={() => setModal('limit')}>Credit limit</button>}
          {partyType === 'customer' && canWriteOff && (open.data?.charges.length ?? 0) > 0 && <button type="button" className="btn-secondary" onClick={() => setModal('writeOff')}>Write off</button>}
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {row && (
        <div className="card grid grid-cols-7 gap-2 text-sm">
          {AGEING_COLUMNS.map(([k, label]) => <div key={k}><p className="text-xs text-slate-500">{label}</p><p className="font-semibold tabular-nums">{formatPaise(row[k])}</p></div>)}
        </div>
      )}
      {canPay && open.data && open.data.credits.length > 0 && open.data.charges.length > 0 && (
        <div className="card flex items-center justify-between text-sm">
          <span>Unapplied credit: {open.data.credits.map((c) => `${c.docNumber ?? c.type} ${formatPaise(c.openPaise)}`).join(', ')}</span>
          <button type="button" className="btn-secondary" onClick={async () => {
            try {
              for (const c of open.data!.credits) await api.payments.allocate({ partyType, partyId: p.id, creditType: c.type as 'payment' | 'debit_note' | 'credit_note' | 'opening', creditId: c.id, allocation: 'auto' });
              done();
            } catch (e) { setError(errorMessage(e)); }
          }}>Apply to open bills</button>
        </div>
      )}
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="st-from">From</label><input id="st-from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="st-to">To</label><input id="st-to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Date</th><th className="p-2">Document</th><th className="p-2">Due</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Balance</th></tr></thead>
        <tbody>
          {first && range.from && <tr className="border-t text-slate-600"><td className="p-2" colSpan={4}>Opening balance</td><td className="p-2 text-right tabular-nums">{formatPaise(first.openingBalancePaise)}</td></tr>}
          {lines.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-2">{l.docDate}</td>
              <td className="p-2">{REF_LABEL[l.refType] ?? l.refType} {l.docNumber ?? ''}{l.kind === 'cancel' && <span className="text-amber-700"> (cancelled)</span>}</td>
              <td className="p-2">{l.dueDate ?? ''}</td>
              <td className="p-2 text-right tabular-nums">{formatPaise(l.amountPaise)}</td>
              <td className="p-2 text-right tabular-nums">{formatPaise(l.balancePaise)}</td>
            </tr>
          ))}
          {last && !statement.hasNextPage && <tr className="border-t font-medium"><td className="p-2" colSpan={4}>Closing balance {partyType === 'customer' ? '(they owe us)' : '(negative = we owe)'}</td><td className="p-2 text-right tabular-nums">{formatPaise(last.closingBalancePaise)}</td></tr>}
        </tbody>
      </table>
      {statement.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void statement.fetchNextPage()}>Show more</button>}
      {modal === 'edit' && partyType === 'customer' && <CustomerEditDialog customer={p as Customer} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'edit' && partyType === 'supplier' && <SupplierDialog supplier={p as Supplier} defaultState={(p as Supplier).stateCode} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'opening' && <OpeningDialog partyType={partyType} partyId={p.id} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'limit' && <CreditLimitDialog customer={p as Customer} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'writeOff' && open.data && <WriteOffDialog customer={p as Customer} items={open.data.charges} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}
