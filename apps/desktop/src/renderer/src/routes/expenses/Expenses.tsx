import { useState, type FormEvent } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { EXPENSE_METHODS } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import Dialog from '../../components/Dialog.js';
import PartyPicker, { type PickedParty } from '../../components/PartyPicker.js';
import { emptyExpenseForm, expenseFormToInput, gstAllowed, type ExpenseForm } from '../../lib/expenses/form.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { TrendingDown, Ban, Save } from 'lucide-react';

export default function Expenses() {
  const qc = useQueryClient();
  const canCreate = useCan('expenses.create');
  const canCancel = useCan('expenses.cancel');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ['expenseCategories'], queryFn: () => api.expenses.listCategories({}) });
  const list = useInfiniteQuery({
    queryKey: ['expenses'], queryFn: ({ pageParam }) => api.expenses.list({ limit: 50, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  async function cancel(e: FormEvent) {
    e.preventDefault();
    try { await api.expenses.cancel({ id: cancelling!, reason }); setCancelling(null); setReason(''); await qc.invalidateQueries(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><TrendingDown size={22} className="text-primary" aria-hidden />Expenses</h1>{canCreate && <button type="button" className="btn-primary" onClick={() => setAdding(true)}>New expense</button>}</div>
      {(list.error || error) && <p className="err" role="alert">{error ?? errorMessage(list.error)}</p>}
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Number</th><th>Date</th><th>Category</th><th>Paid by</th><th>Description</th><th className="text-right">GST</th><th className="text-right">Total</th><th /></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id} className={x.status === 'cancelled' ? 'text-muted-foreground line-through' : ''}>
              <td>{x.docNumber}</td><td>{x.expenseDate}</td><td>{x.categoryName}</td><td>{x.method.toUpperCase()}</td>
              <td>{x.description ?? x.vendorName ?? ''}</td><td className="text-right tabular-nums">{formatPaise(x.cgstPaise + x.sgstPaise + x.igstPaise + x.cessPaise)}</td>
              <td className="text-right tabular-nums">{formatPaise(x.totalPaise)}</td>
              <td>{x.status === 'posted' && canCancel && x.settledPaise === 0 && <button type="button" className="btn-secondary py-1" onClick={() => setCancelling(x.id)}>Cancel</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}>Show more</button>}
      {cancelling && (
        <Dialog title="Cancel expense" onClose={() => setCancelling(null)}>
          <form onSubmit={cancel} className="space-y-3">
            <div><label className="label" htmlFor="exc-reason">Reason</label><input id="exc-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
            <button type="submit" className="btn-primary"><Ban size={16} aria-hidden />Cancel expense</button>
          </form>
        </Dialog>
      )}
      {adding && categories.data && <NewExpense categories={categories.data} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void qc.invalidateQueries(); }} />}
    </div>
  );
}

function NewExpense({ categories, onClose, onDone }: { categories: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<ExpenseForm>(emptyExpenseForm(new Date().toLocaleDateString('en-CA'), categories[0]?.id));
  const [supplier, setSupplier] = useState<PickedParty | null>(null);
  const [errors, setErrors] = useState<Record<string, string> | string | null>(null);
  const [commandId] = useState(newUlid);
  const supplierDetail = useQuery({ queryKey: ['party', 'supplier', supplier?.id], queryFn: () => api.suppliers.get({ id: supplier!.id }), enabled: !!supplier });
  const supplierHasGstin = !!supplierDetail.data?.gstin;
  const set = (patch: Partial<ExpenseForm>) => setF({ ...f, ...patch });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = expenseFormToInput(f, commandId, supplierHasGstin);
    if (!r.ok) { setErrors(r.errors); return; }
    try { await api.expenses.create(r.input); onDone(); } catch (err) { setErrors(errorMessage(err)); }
  }
  const errorText = errors && (typeof errors === 'string' ? errors : Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; '));
  return (
    <Dialog title="New expense" onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="ex-cat">Category</label><select id="ex-cat" className="select" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="ex-date">Date</label><DatePicker id="ex-date" value={f.date} onChange={(v) => set({ date: v })} /></div>
        <div><label className="label" htmlFor="ex-amount">Amount (₹)</label><input id="ex-amount" className="input" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></div>
        <div><label className="label" htmlFor="ex-method">Paid by</label><select id="ex-method" className="select" value={f.method} onChange={(e) => set({ method: e.target.value as ExpenseForm['method'] })}>{EXPENSE_METHODS.map((m) => <option key={m} value={m}>{m === 'credit' ? 'On credit (supplier)' : m.toUpperCase()}</option>)}</select></div>
        <div className="col-span-2">{supplier ? <p className="text-sm">Supplier: <span className="font-medium">{supplier.name}</span> <button type="button" className="btn-secondary py-0" onClick={() => { setSupplier(null); set({ supplierId: '' }); }}>Change</button></p>
          : <PartyPicker id="ex-supplier" partyType="supplier" onPick={(p) => { setSupplier(p); set({ supplierId: p.id }); }} />}</div>
        {!supplier && <>
          <div><label className="label" htmlFor="ex-vendor">Or vendor name</label><input id="ex-vendor" className="input" value={f.vendorName} onChange={(e) => set({ vendorName: e.target.value })} /></div>
          <div><label className="label" htmlFor="ex-gstin">Vendor GSTIN</label><input id="ex-gstin" className="input uppercase" maxLength={15} value={f.vendorGstin} onChange={(e) => set({ vendorGstin: e.target.value })} /></div>
        </>}
        {gstAllowed(f, supplierHasGstin) && <>
          <div><label className="label" htmlFor="ex-gst">GST %</label><input id="ex-gst" className="input" inputMode="decimal" value={f.gstRate} onChange={(e) => set({ gstRate: e.target.value })} /></div>
          <div className="flex items-end gap-4 pb-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.inclusive} onChange={(e) => set({ inclusive: e.target.checked })} />Amount includes GST</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.itc} onChange={(e) => set({ itc: e.target.checked })} />Claim ITC</label>
          </div>
        </>}
        <div className="col-span-2"><label className="label" htmlFor="ex-desc">Description</label><input id="ex-desc" className="input" value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
        <div className="col-span-2 space-y-2">{errorText && <p className="err" role="alert">{errorText}</p>}<button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save expense</button></div>
      </form>
    </Dialog>
  );
}
