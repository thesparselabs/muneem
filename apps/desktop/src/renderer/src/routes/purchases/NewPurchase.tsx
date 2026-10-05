import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PURCHASE_CHARGE_KINDS, type ProductHit } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import PartyPicker, { type PickedParty } from '../../components/PartyPicker.js';
import ProductPicker from '../../components/ProductPicker.js';
import { fileToBase64 } from '../../lib/fileToBase64.js';
import { formatPaise } from '../../lib/money.js';
import { billCheck, emptyPurchaseForm, formToDraft, lineFor, type PurchaseForm, type PurchaseFormLine } from '../../lib/purchases/form.js';
import { useDebounced } from '../../lib/useDebounced.js';

export default function NewPurchase() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<PurchaseForm>(emptyPurchaseForm(new Date().toLocaleDateString('en-CA')));
  const [supplier, setSupplier] = useState<PickedParty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [commandId] = useState(newUlid);
  const uoms = useQuery({ queryKey: ['uoms'], queryFn: () => api.catalog.listUoms({}) });
  const parsed = useMemo(() => formToDraft(form), [form]);
  const draft = useDebounced(parsed.ok ? parsed.draft : null, 250);
  const quote = useQuery({ queryKey: ['purchaseQuote', draft], queryFn: () => api.purchases.quote(draft!), enabled: !!draft, retry: false });
  const check = billCheck(quote.data);
  const set = (patch: Partial<PurchaseForm>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i: number, patch: Partial<PurchaseFormLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  async function addProduct(h: ProductHit) {
    try { const p = await api.products.get({ id: h.productId }); setForm((f) => ({ ...f, lines: [...f.lines, lineFor(p, uoms.data ?? [])] })); } catch (e) { setError(errorMessage(e)); }
  }
  async function importFile(file: File) {
    try {
      const r = await api.purchases.importLinesPreview({ fileName: file.name, contentBase64: await fileToBase64(file) });
      const products = new Map(r.products.map((p) => [p.id, p]));
      setForm((f) => ({ ...f, lines: [...f.lines, ...r.lines.map((l) => lineFor(products.get(l.productId)!, uoms.data ?? [], l))] }));
      setImportErrors(r.errors.map((e) => `Row ${e.line}: ${Object.values(e.errors).join('; ')}`));
    } catch (e) { setError(errorMessage(e)); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.ok) { setError(Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`).join('; ')); return; }
    if (parsed.draft.billTotalPaise === undefined) { setError('Enter the bill total'); return; }
    try {
      const p = await api.purchases.create({ ...parsed.draft, billTotalPaise: parsed.draft.billTotalPaise, commandId });
      await qc.invalidateQueries();
      nav(`/purchases/${p.id}`);
    } catch (err) { setError(errorMessage(err)); }
  }
  const q = quote.data;
  const quoted = new Map(q?.lines.map((l) => [l.draftLineNo, l]) ?? []);
  return (
    <form onSubmit={submit} className="max-w-7xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">New purchase</h1><Link to="/purchases" className="btn-secondary">Cancel</Link></div>
      <div className="card grid grid-cols-4 gap-3">
        <div className="col-span-2">{supplier ? <p className="pt-6 font-medium">{supplier.name} <button type="button" className="btn-secondary py-0" onClick={() => { setSupplier(null); set({ supplierId: '' }); }}>Change</button></p>
          : <PartyPicker id="pu-supplier" partyType="supplier" onPick={(p) => { setSupplier(p); set({ supplierId: p.id }); }} />}</div>
        <div><label className="label" htmlFor="pu-inv">Bill number</label><input id="pu-inv" className="input" value={form.invoiceNo} onChange={(e) => set({ invoiceNo: e.target.value })} /></div>
        <div><label className="label" htmlFor="pu-date">Bill date</label><DatePicker id="pu-date" value={form.invoiceDate} onChange={(v) => set({ invoiceDate: v })} /></div>
        <div><label className="label" htmlFor="pu-due">Due date</label><DatePicker id="pu-due" value={form.dueDate || q?.dueDate || ''} onChange={(v) => set({ dueDate: v })} /></div>
      </div>
      <div className="card flex items-end gap-4">
        <div className="grow"><ProductPicker id="pu-product" label="Add a product" onPick={(h) => void addProduct(h)} /></div>
        <div><label className="label" htmlFor="pu-file">Or import lines (CSV/XLSX)</label><input id="pu-file" type="file" accept=".csv,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} /></div>
      </div>
      {importErrors.length > 0 && <div className="card text-sm text-amber-800" role="status"><p className="font-medium">Rows not imported:</p><ul>{importErrors.slice(0, 20).map((t) => <li key={t}>{t}</li>)}</ul></div>}
      {form.lines.length > 0 && (
        <table className="table-modern rounded-lg border bg-white">
          <thead><tr>
            <th>Product</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Incl. GST</th><th>Disc %</th>
            <th>GST %</th><th>ITC</th><th className="text-right">Taxable</th><th className="text-right">Landed / unit</th><th />
          </tr></thead>
          <tbody>
            {form.lines.map((l, i) => {
              const ql = quoted.get(i + 1);
              return (
                <tr key={`${l.productId}-${i}`}>
                  <td>{l.name}</td>
                  <td><select aria-label={`Unit for ${l.name}`} className="select py-1" value={l.uomId} onChange={(e) => setLine(i, { uomId: e.target.value })}>{l.units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select></td>
                  <td><input aria-label={`Quantity for ${l.name}`} className="input w-20 py-1" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                  <td><input aria-label={`Rate for ${l.name}`} className="input w-24 py-1" inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} /></td>
                  <td><input type="checkbox" aria-label={`Rate includes GST for ${l.name}`} checked={l.inclusive} onChange={(e) => setLine(i, { inclusive: e.target.checked })} /></td>
                  <td><input aria-label={`Discount for ${l.name}`} className="input w-16 py-1" inputMode="decimal" value={l.discountPct} onChange={(e) => setLine(i, { discountPct: e.target.value })} /></td>
                  <td><input aria-label={`GST rate for ${l.name}`} className="input w-16 py-1" inputMode="decimal" value={l.gstRate} onChange={(e) => setLine(i, { gstRate: e.target.value })} /></td>
                  <td><input type="checkbox" aria-label={`Claim ITC for ${l.name}`} checked={l.itc} onChange={(e) => setLine(i, { itc: e.target.checked })} /></td>
                  <td className="text-right tabular-nums">{ql ? formatPaise(ql.taxablePaise) : ''}</td>
                  <td className="text-right tabular-nums">{ql ? formatPaise(ql.unitCostPaise) : ''}</td>
                  <td><button type="button" className="btn-secondary py-1" onClick={() => set({ lines: form.lines.filter((_, j) => j !== i) })}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="card space-y-2">
          <div><label className="label" htmlFor="pu-billdisc">Bill discount %</label><input id="pu-billdisc" className="input w-24" inputMode="decimal" value={form.billDiscountPct} onChange={(e) => set({ billDiscountPct: e.target.value })} /></div>
          <p className="label">Charges (freight, loading…) spread into cost by value</p>
          {form.charges.map((c, i) => (
            <div key={i} className="flex gap-2">
              <select aria-label="Charge kind" className="select py-1" value={c.kind} onChange={(e) => set({ charges: form.charges.map((x, j) => (j === i ? { ...x, kind: e.target.value as typeof c.kind } : x)) })}>{PURCHASE_CHARGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
              <input aria-label="Charge amount" className="input w-28 py-1" inputMode="decimal" value={c.amount} onChange={(e) => set({ charges: form.charges.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) })} />
              <button type="button" className="btn-secondary py-1" onClick={() => set({ charges: form.charges.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn-secondary py-1" onClick={() => set({ charges: [...form.charges, { kind: 'freight', amount: '' }] })}>Add a charge</button>
        </div>
        <div className="card space-y-1 text-sm">
          {q && <>
            <p className="flex justify-between"><span>Taxable</span><span className="tabular-nums">{formatPaise(q.totals.taxablePaise)}</span></p>
            <p className="flex justify-between"><span>GST ({q.totals.supplyType === 'inter' ? 'IGST' : 'CGST + SGST'})</span><span className="tabular-nums">{formatPaise(q.totals.cgstPaise + q.totals.sgstPaise + q.totals.igstPaise + q.totals.cessPaise)}</span></p>
            <p className="flex justify-between"><span>Charges</span><span className="tabular-nums">{formatPaise(q.totals.chargesPaise)}</span></p>
            <p className="flex justify-between"><span>ITC to claim</span><span className="tabular-nums">{formatPaise(q.totals.itcPaise)}</span></p>
            <p className="flex justify-between font-semibold"><span>Lines add up to</span><span className="tabular-nums">{formatPaise(q.totals.computedTotalPaise)}</span></p>
            {q.issues.length > 0 && <p className="text-amber-800">{q.issues.map((x) => x.message).join('; ')}</p>}
          </>}
          {quote.error && <p className="err">{errorMessage(quote.error)}</p>}
          <div><label className="label" htmlFor="pu-total">Bill total (as printed)</label><input id="pu-total" className="input" inputMode="decimal" value={form.billTotal} onChange={(e) => set({ billTotal: e.target.value })} /></div>
          <p role="status" className={check.tone === 'ok' ? 'text-green-800' : check.tone === 'bad' ? 'text-red-700' : 'text-slate-600'}>{check.text}</p>
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={check.tone !== 'ok'}>Save purchase</button>
    </form>
  );
}
