import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, PartyType, Supplier } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import { formatPaise } from '../../lib/money.js';
import { AGEING_COLUMNS } from '../../lib/parties/forms.js';
import { useCan } from '../../lib/permissions.js';
import { CreditLimitDialog, CustomerEditDialog, OpeningDialog, SupplierDialog, WriteOffDialog } from './PartyDialogs.js';
import CustomerPrivacy from './CustomerPrivacy.js';

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
  const erased = 'erasedAt' in (party.data ?? {}) && !!(party.data as Customer).erasedAt;
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
          {!erased && <button type="button" className="btn-secondary" onClick={() => setModal('edit')}>Edit</button>}
          <button type="button" className="btn-secondary" onClick={() => setModal('opening')}>Opening balance</button>
          {partyType === 'customer' && canApproveCredit && !erased && <button type="button" className="btn-secondary" onClick={() => setModal('limit')}>Credit limit</button>}
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
      {partyType === 'customer' && <CustomerPrivacy customer={p as Customer} balancePaise={ageing.data ? (row?.netPaise ?? 0) : undefined} />}
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="st-from">From</label><DatePicker id="st-from" value={range.from} onChange={(v) => setRange({ ...range, from: v })} /></div>
        <div><label className="label" htmlFor="st-to">To</label><DatePicker id="st-to" value={range.to} onChange={(v) => setRange({ ...range, to: v })} /></div>
      </div>
      <table className="table-modern rounded-lg border bg-white">
        <thead><tr><th>Date</th><th>Document</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
        <tbody>
          {first && range.from && <tr className="text-slate-600"><td colSpan={4}>Opening balance</td><td className="text-right tabular-nums">{formatPaise(first.openingBalancePaise)}</td></tr>}
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{l.docDate}</td>
              <td>{REF_LABEL[l.refType] ?? l.refType} {l.docNumber ?? ''}{l.kind === 'cancel' && <span className="text-amber-700"> (cancelled)</span>}</td>
              <td>{l.dueDate ?? ''}</td>
              <td className="text-right tabular-nums">{formatPaise(l.amountPaise)}</td>
              <td className="text-right tabular-nums">{formatPaise(l.balancePaise)}</td>
            </tr>
          ))}
          {last && !statement.hasNextPage && <tr className="font-medium"><td colSpan={4}>Closing balance {partyType === 'customer' ? '(they owe us)' : '(negative = we owe)'}</td><td className="text-right tabular-nums">{formatPaise(last.closingBalancePaise)}</td></tr>}
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
