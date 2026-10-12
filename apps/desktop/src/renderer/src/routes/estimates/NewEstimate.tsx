import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ESTIMATE_DEFAULT_VALID_DAYS, type ProductHit } from '@muneem/contracts';
import { addDays, newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import PartyPicker from '../../components/PartyPicker.js';
import ProductPicker from '../../components/ProductPicker.js';
import { alignQuote, emptyEstimateForm, formToDraft, lineFor, type EstimateForm, type EstimateFormLine } from '../../lib/estimates/form.js';
import { formatPaise } from '../../lib/money.js';
import { useToasts } from '../../lib/toast.js';
import { useDebounced } from '../../lib/useDebounced.js';
import { ClipboardList, Pencil, Save, Trash2, X } from 'lucide-react';

// FR-086: an estimate is priced live by the same engine as a bill; saving it posts nothing.
export default function NewEstimate() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const push = useToasts((s) => s.push);
  const today = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState<EstimateForm>(() => emptyEstimateForm(addDays(today, ESTIMATE_DEFAULT_VALID_DAYS)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [commandId] = useState(newUlid);
  const uoms = useQuery({ queryKey: ['uoms'], queryFn: () => api.catalog.listUoms({}) });
  const parsed = useMemo(() => formToDraft(form), [form]);
  const draft = useDebounced(parsed.ok ? parsed.draft : null, 250);
  const quote = useQuery({ queryKey: ['estimateQuote', draft], queryFn: () => api.sales.quote(draft!), enabled: !!draft, retry: false });
  const set = (patch: Partial<EstimateForm>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i: number, patch: Partial<EstimateFormLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  async function addProduct(h: ProductHit) {
    try { const p = await api.products.get({ id: h.productId }); setForm((f) => ({ ...f, lines: [...f.lines, lineFor(p, uoms.data ?? [])] })); } catch (e) { setError(errorMessage(e)); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.ok) { setError(Object.values(parsed.errors).join('; ')); return; }
    if (!quote.data) { setError('Wait for the prices, then save'); return; }
    setSaving(true);
    try {
      const saved = await api.estimates.create({ ...parsed.draft, commandId, expectedTotalPaise: quote.data.totals.totalPaise });
      await qc.invalidateQueries({ queryKey: ['estimates'] });
      push(`Estimate ${saved.docNumber} saved`, 'success');
      nav('/estimates');
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  }
  const q = quote.data;
  const priced = alignQuote(form.lines.length, q);
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><ClipboardList size={22} className="text-primary" aria-hidden />New estimate</h1>
        <Link to="/estimates" className="btn-secondary"><X size={16} aria-hidden />Cancel</Link>
      </div>
      <div className="card grid grid-cols-4 gap-3">
        <div className="col-span-2">{form.customer
          ? <p className="pt-6 font-medium">{form.customer.name} <button type="button" className="btn-secondary px-2 py-1" onClick={() => set({ customer: null })} aria-label="Change customer" title="Change customer"><Pencil size={14} aria-hidden /></button></p>
          : <PartyPicker id="es-customer" partyType="customer" onPick={(p) => set({ customer: { id: p.id, name: p.name } })} />}</div>
        <div><label className="label" htmlFor="es-valid">Valid until</label><DatePicker id="es-valid" value={form.validUntil} onChange={(v) => set({ validUntil: v })} /></div>
        <div><label className="label" htmlFor="es-notes">Note on the quotation</label><input id="es-notes" className="input" maxLength={500} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      </div>
      <div className="card"><ProductPicker id="es-product" label="Add a product" onPick={(h) => void addProduct(h)} /></div>
      {form.lines.length > 0 && (
        <table className="table-modern rounded-lg border border-border bg-card">
          <thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Disc %</th><th className="text-right">Rate</th><th className="text-right">Taxable</th><th className="text-right">Amount</th><th /></tr></thead>
          <tbody>
            {form.lines.map((l, i) => {
              const { line: ql, issue } = priced[i]!;
              return (
                <tr key={`${l.productId}-${i}`}>
                  <td>{l.name}{issue && <span className="block text-xs text-amber-800 dark:text-amber-300">{issue}</span>}</td>
                  <td><select aria-label={`Unit for ${l.name}`} className="select py-1" value={l.uomId} onChange={(e) => setLine(i, { uomId: e.target.value })}>{l.units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select></td>
                  <td><input aria-label={`Quantity for ${l.name}`} className="input w-20 py-1" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                  <td><input aria-label={`Discount for ${l.name}`} className="input w-16 py-1" inputMode="decimal" value={l.discountPct} onChange={(e) => setLine(i, { discountPct: e.target.value })} /></td>
                  <td className="text-right tabular-nums">{ql ? formatPaise(ql.unitPricePaise) : ''}</td>
                  <td className="text-right tabular-nums">{ql ? formatPaise(ql.taxablePaise) : ''}</td>
                  <td className="text-right tabular-nums">{ql ? formatPaise(ql.totalPaise) : ''}</td>
                  <td><button type="button" className="btn-secondary px-2 py-1" onClick={() => set({ lines: form.lines.filter((_, j) => j !== i) })} aria-label={`Remove ${l.name}`} title="Remove"><Trash2 size={14} aria-hidden /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="card"><label className="label" htmlFor="es-billdisc">Bill discount %</label><input id="es-billdisc" className="input w-24" inputMode="decimal" value={form.billDiscountPct} onChange={(e) => set({ billDiscountPct: e.target.value })} /></div>
        <div className="card space-y-1 text-sm" aria-label="Estimate total">
          {q && <>
            <p className="flex justify-between"><span>Taxable</span><span className="tabular-nums">{formatPaise(q.totals.taxablePaise)}</span></p>
            <p className="flex justify-between"><span>GST ({q.totals.supplyType === 'inter' ? 'IGST' : 'CGST + SGST'})</span><span className="tabular-nums">{formatPaise(q.totals.cgstPaise + q.totals.sgstPaise + q.totals.igstPaise + q.totals.cessPaise)}</span></p>
            {q.totals.roundOffPaise !== 0 && <p className="flex justify-between"><span>Round off</span><span className="tabular-nums">{formatPaise(q.totals.roundOffPaise)}</span></p>}
            <p className="flex justify-between text-lg font-semibold"><span>Total</span><span className="tabular-nums">{formatPaise(q.totals.totalPaise)}</span></p>
            {q.issues.length > 0 && <p className="text-amber-800 dark:text-amber-300">{q.issues.map((x) => x.message).join('; ')}</p>}
          </>}
          {quote.error && <p className="err">{errorMessage(quote.error)}</p>}
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={!q || q.issues.length > 0 || saving}><Save size={16} aria-hidden />Save estimate</button>
    </form>
  );
}
