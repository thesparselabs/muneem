import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CHALLAN_PURPOSES, TRANSPORT_MODES, type ProductHit } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import Field from '../../components/Field.js';
import PartyPicker from '../../components/PartyPicker.js';
import ProductPicker from '../../components/ProductPicker.js';
import { emptyChallanForm, formToDraft, purposeText, quoteDraftOf, type ChallanForm, type ChallanFormLine } from '../../lib/challans/form.js';
import { formatPaise } from '../../lib/money.js';
import { alignQuote } from '../../lib/pos/cart.js';
import { unitsOf } from '../../lib/purchases/form.js';
import { useToasts } from '../../lib/toast.js';
import { useDebounced } from '../../lib/useDebounced.js';
import { Pencil, Save, Trash2, Truck, X } from 'lucide-react';

const MODE_LABELS: Record<(typeof TRANSPORT_MODES)[number], string> = { road: 'Road', rail: 'Rail', air: 'Air', ship: 'Ship' };

// FR-087: goods leave with a challan valued like a bill; it posts nothing until a challan for supply is billed at the till.
export default function NewChallan() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const push = useToasts((s) => s.push);
  const [form, setForm] = useState<ChallanForm>(emptyChallanForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [commandId] = useState(newUlid);
  const uoms = useQuery({ queryKey: ['uoms'], queryFn: () => api.catalog.listUoms({}) });
  const parsed = useMemo(() => formToDraft(form), [form]);
  const draft = useDebounced(parsed.ok ? parsed.draft : null, 250);
  const quote = useQuery({ queryKey: ['challanQuote', draft], queryFn: () => api.sales.quote(quoteDraftOf(draft!)), enabled: !!draft, retry: false });
  const set = (patch: Partial<ChallanForm>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i: number, patch: Partial<ChallanFormLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  async function addProduct(h: ProductHit) {
    try {
      const p = await api.products.get({ id: h.productId });
      setForm((f) => ({ ...f, lines: [...f.lines, { productId: p.id, name: p.name, units: unitsOf(p, uoms.data ?? []), uomId: p.baseUomId, qty: '1' }] }));
    } catch (e) { setError(errorMessage(e)); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.ok) { setError(Object.values(parsed.errors).join('; ')); return; }
    if (!quote.data) { setError('Wait for the values, then save'); return; }
    setSaving(true);
    try {
      const saved = await api.challans.create({ ...parsed.draft, commandId, expectedTotalPaise: quote.data.totals.totalPaise });
      await qc.invalidateQueries({ queryKey: ['challans'] });
      push(`Challan ${saved.docNumber} saved`, 'success');
      nav('/challans');
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  }
  const q = quote.data;
  const priced = alignQuote(form.lines.length, q);
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Truck size={22} className="text-primary" aria-hidden />New delivery challan</h1>
        <Link to="/challans" className="btn-secondary"><X size={16} aria-hidden />Cancel</Link>
      </div>
      <div className="card grid grid-cols-4 gap-3">
        <Field label="Purpose" htmlFor="ch-purpose">
          <select id="ch-purpose" className="select" value={form.purpose} onChange={(e) => set({ purpose: e.target.value as ChallanForm['purpose'] })}>
            {CHALLAN_PURPOSES.map((p) => <option key={p} value={p}>{purposeText(p)}</option>)}
          </select>
        </Field>
        <div className="col-span-3">{form.customer
          ? <p className="pt-6 font-medium">{form.customer.name} <button type="button" className="btn-secondary px-2 py-1" onClick={() => set({ customer: null })} aria-label="Change customer" title="Change customer"><Pencil size={14} aria-hidden /></button></p>
          : <PartyPicker id="ch-customer" partyType="customer" onPick={(p) => set({ customer: { id: p.id, name: p.name } })} />}</div>
        {!form.customer && <>
          <Field label="Or the consignee's name" htmlFor="ch-name"><input id="ch-name" className="input" maxLength={120} value={form.consigneeName} onChange={(e) => set({ consigneeName: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Consignee address" htmlFor="ch-address"><input id="ch-address" className="input" maxLength={300} value={form.consigneeAddress} onChange={(e) => set({ consigneeAddress: e.target.value })} /></Field></div>
          <Field label="Consignee GSTIN" htmlFor="ch-gstin"><input id="ch-gstin" className="input" maxLength={15} value={form.consigneeGstin} onChange={(e) => set({ consigneeGstin: e.target.value })} /></Field>
        </>}
      </div>
      <div className="card"><ProductPicker id="ch-product" label="Add a product" onPick={(h) => void addProduct(h)} /></div>
      {form.lines.length > 0 && (
        <table className="table-modern rounded-lg border border-border bg-card">
          <thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th className="text-right">Rate</th><th className="text-right">Taxable</th><th className="text-right">Value</th><th /></tr></thead>
          <tbody>
            {form.lines.map((l, i) => {
              const { line: ql, issue } = priced[i]!;
              return (
                <tr key={`${l.productId}-${i}`}>
                  <td>{l.name}{issue && <span className="block text-xs text-amber-800 dark:text-amber-300">{issue}</span>}</td>
                  <td><select aria-label={`Unit for ${l.name}`} className="select py-1" value={l.uomId} onChange={(e) => setLine(i, { uomId: e.target.value })}>{l.units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select></td>
                  <td><input aria-label={`Quantity for ${l.name}`} className="input w-20 py-1" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
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
        <fieldset className="card grid grid-cols-3 gap-3">
          <legend className="label">Transport (for an e-way bill later)</legend>
          <Field label="Mode" htmlFor="ch-mode">
            <select id="ch-mode" className="select" value={form.mode} onChange={(e) => set({ mode: e.target.value as ChallanForm['mode'] })}>
              {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
            </select>
          </Field>
          <Field label="Vehicle number" htmlFor="ch-vehicle"><input id="ch-vehicle" className="input" maxLength={15} value={form.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} /></Field>
          <Field label="Distance (km)" htmlFor="ch-distance"><input id="ch-distance" className="input" inputMode="numeric" value={form.distanceKm} onChange={(e) => set({ distanceKm: e.target.value })} /></Field>
          <Field label="Transporter" htmlFor="ch-transporter"><input id="ch-transporter" className="input" maxLength={100} value={form.transporterName} onChange={(e) => set({ transporterName: e.target.value })} /></Field>
          <Field label="Transporter GSTIN / ID" htmlFor="ch-transporter-id"><input id="ch-transporter-id" className="input" maxLength={15} value={form.transporterId} onChange={(e) => set({ transporterId: e.target.value })} /></Field>
          <Field label="LR / transport doc no." htmlFor="ch-doc"><input id="ch-doc" className="input" maxLength={30} value={form.docNo} onChange={(e) => set({ docNo: e.target.value })} /></Field>
          <div className="col-span-3"><Field label="Note on the challan" htmlFor="ch-notes"><input id="ch-notes" className="input" maxLength={500} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
        </fieldset>
        <div className="card space-y-1 text-sm" aria-label="Challan value">
          {q && <>
            <p className="flex justify-between"><span>Taxable</span><span className="tabular-nums">{formatPaise(q.totals.taxablePaise)}</span></p>
            <p className="flex justify-between"><span>GST ({q.totals.supplyType === 'inter' ? 'IGST' : 'CGST + SGST'})</span><span className="tabular-nums">{formatPaise(q.totals.cgstPaise + q.totals.sgstPaise + q.totals.igstPaise + q.totals.cessPaise)}</span></p>
            <p className="flex justify-between text-lg font-semibold"><span>Value of goods</span><span className="tabular-nums">{formatPaise(q.totals.totalPaise)}</span></p>
          </>}
          {quote.error && <p className="err">{errorMessage(quote.error)}</p>}
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={!q || q.issues.length > 0 || saving}><Save size={16} aria-hidden />Save challan</button>
    </form>
  );
}
