import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product, Uom } from '@muneem/contracts';
import { api, errorMessage, isClientError } from '../api.js';
import Field from '../components/Field.js';
import UomSelect from '../components/UomSelect.js';
import { formatRateBp } from '../lib/money.js';
import { GST_RATES_BP, emptyForm, formToInput, productToForm, rebaseForm, type FormErrors, type ProductForm } from '../lib/productForm.js';
import PriceListItems from './PriceListItems.js';
import { Package, ArrowLeft, Trash2, Ban, Plus, RotateCcw } from 'lucide-react';

const TAX_TREATMENTS = [['taxable', 'Taxable'], ['exempt', 'Exempt'], ['nil_rated', 'Nil rated'], ['zero_rated', 'Zero rated'], ['non_gst', 'Non-GST']] as const;

export default function ProductEdit() {
  const { id } = useParams();
  const isNew = id === undefined;
  const nav = useNavigate();
  const qc = useQueryClient();
  const uoms = useQuery({ queryKey: ['uoms'], queryFn: () => api.catalog.listUoms({}) });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.listCategories({}) });
  const brands = useQuery({ queryKey: ['brands'], queryFn: () => api.catalog.listBrands({}) });
  const product = useQuery({ queryKey: ['product', id], queryFn: () => api.products.get({ id: id! }), enabled: !isNew });
  const [form, setForm] = useState<ProductForm | null>(null);
  const [baseline, setBaseline] = useState<ProductForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew || !product.data) return;
    const fresh = productToForm(product.data);
    setForm((current) => (current && baseline ? rebaseForm(current, baseline, fresh) : fresh));
    setBaseline(fresh);
  }, [isNew, product.data]); // rebase only when the server copy changes

  useEffect(() => {
    const pcs = uoms.data?.find((u) => u.code === 'PCS') ?? uoms.data?.[0];
    if (isNew && !form && pcs) setForm(emptyForm(pcs.id));
  }, [form, isNew, uoms.data]);

  if (!form || !uoms.data) return <p className="text-sm text-muted-foreground" role="status">Loading…</p>;
  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm({ ...form, [key]: value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const result = formToInput(form!, isNew ? undefined : baseline ?? undefined);
    if (!result.ok) { setErrors(result.errors); return; }
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const saved: Product = isNew
        ? await api.products.create(result.input)
        : await api.products.update({ ...result.input, id: id!, version: product.data!.version });
      await qc.invalidateQueries({ queryKey: ['products'] });
      setForm(productToForm(saved));
      setBaseline(productToForm(saved));
      qc.setQueryData(['product', saved.id], saved);
      setMessage('Saved.');
      if (isNew) nav(`/products/${saved.id}`, { replace: true });
    } catch (err) {
      if (isClientError(err) && err.fields) setErrors(err.fields);
      setMessage(errorMessage(err));
    } finally { setBusy(false); }
  }

  async function toggleActive() {
    const p = product.data!;
    try {
      const updated = p.isActive ? await api.products.deactivate({ id: p.id, version: p.version }) : await api.products.reactivate({ id: p.id, version: p.version });
      qc.setQueryData(['product', p.id], updated);
      await qc.invalidateQueries({ queryKey: ['products'] });
    } catch (err) { setMessage(errorMessage(err)); }
  }

  const err = (key: string) => errors[key] && <p className="err">{errors[key]}</p>;
  return (
    <div className="max-w-6xl space-y-4">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Package size={22} className="text-primary" aria-hidden />{isNew ? 'Add product' : form.name}</h1>
          <Link to="/products" className="btn-secondary px-2.5" aria-label="Back to products" title="Back to products"><ArrowLeft size={16} aria-hidden /></Link>
        </div>
        {!isNew && product.data && !product.data.isActive && <p className="card text-sm text-amber-800 dark:text-amber-300">This product is deactivated. It does not appear in billing or search.</p>}

        <Section title="Basics">
          <Field label="Name" htmlFor="name"><input id="name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />{err('name')}</Field>
          <Field label="SKU / item code" htmlFor="sku"><input id="sku" className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} />{err('sku')}</Field>
          <Field label="Category" htmlFor="category">
            <select id="category" className="select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">None</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Brand" htmlFor="brand">
            <select id="brand" className="select" value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
              <option value="">None</option>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Base unit" htmlFor="baseUom" hint="Stock is counted in this unit">
            <UomSelect id="baseUom" uoms={uoms.data} value={form.baseUomId} onChange={(v) => set('baseUomId', v)} />
          </Field>
          <Field label="Reorder level" htmlFor="reorder" hint="In the base unit"><input id="reorder" className="input" inputMode="decimal" value={form.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)} />{err('reorderLevelMilli')}</Field>
        </Section>

        <Section title="Tax">
          <Field label="HSN / SAC" htmlFor="hsn"><input id="hsn" className="input" inputMode="numeric" value={form.hsnCode} onChange={(e) => set('hsnCode', e.target.value)} />{err('hsnCode')}</Field>
          <Field label="Tax treatment" htmlFor="treatment">
            <select id="treatment" className="select" value={form.taxTreatment} onChange={(e) => set('taxTreatment', e.target.value as ProductForm['taxTreatment'])}>
              {TAX_TREATMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {form.taxTreatment === 'taxable' && (
            <Field label="GST rate" htmlFor="gst">
              <select id="gst" className="select" value={form.gstRateBp} onChange={(e) => set('gstRateBp', Number(e.target.value))}>
                {GST_RATES_BP.map((r) => <option key={r} value={r}>{formatRateBp(r)}</option>)}
              </select>{err('gstRateBp')}
            </Field>
          )}
        </Section>

        <Section title="Prices">
          <Field label="MRP (₹)" htmlFor="mrp"><input id="mrp" className="input" inputMode="decimal" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />{err('mrpPaise')}</Field>
          <Field label="Selling price (₹)" htmlFor="sp" hint="Retail price list, per base unit"><input id="sp" className="input" inputMode="decimal" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />{err('sellingPricePaise')}</Field>
          <Field label="Purchase price (₹)" htmlFor="pp"><input id="pp" className="input" inputMode="decimal" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />{err('purchasePricePaise')}</Field>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" checked={form.priceIsInclusive} onChange={(e) => set('priceIsInclusive', e.target.checked)} /> Prices include GST
          </label>
        </Section>

        <BarcodeEditor form={form} uoms={uoms.data} errors={errors} onChange={(barcodes) => set('barcodes', barcodes)} />
        <ConversionEditor form={form} uoms={uoms.data} errors={errors} onChange={(conversions) => set('conversions', conversions)} />

        {message && <p className="text-sm" role="status">{message}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>{isNew ? 'Create product' : 'Save changes'}</button>
          {!isNew && product.data && (
            <button type="button" className="btn-secondary" onClick={() => void toggleActive()}>{product.data.isActive ? <><Ban size={16} aria-hidden />Deactivate</> : <><RotateCcw size={16} aria-hidden />Reactivate</>}</button>
          )}
        </div>
      </form>
      {!isNew && product.data && <PriceListItems product={product.data} uoms={uoms.data} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="card grid grid-cols-2 gap-4"><legend className="px-1 font-semibold">{title}</legend>{children}</fieldset>;
}

function BarcodeEditor({ form, uoms, errors, onChange }: { form: ProductForm; uoms: Uom[]; errors: FormErrors; onChange: (b: ProductForm['barcodes']) => void }) {
  const update = (i: number, patch: Partial<ProductForm['barcodes'][number]>) => onChange(form.barcodes.map((b, j) => (j === i ? { ...b, ...patch } : patch.isPrimary ? { ...b, isPrimary: false } : b)));
  return (
    <fieldset className="card space-y-2">
      <legend className="px-1 font-semibold">Barcodes</legend>
      {form.barcodes.length === 0 && <p className="text-sm text-muted-foreground">No barcodes. Add one to scan this product at the counter.</p>}
      {form.barcodes.map((b, i) => (
        <div key={i} className="grid grid-cols-[1fr_200px_auto_auto] items-center gap-2">
          <input aria-label={`Barcode ${i + 1}`} className="input font-mono" value={b.code} onChange={(e) => update(i, { code: e.target.value })} />
          <UomSelect id={`barcode-uom-${i}`} uoms={uoms} value={b.uomId} onChange={(v) => update(i, { uomId: v })} allowNone="Base unit" />
          <label className="flex items-center gap-1 text-sm"><input type="radio" name="primary-barcode" checked={b.isPrimary} onChange={() => update(i, { isPrimary: true })} /> Primary</label>
          <button type="button" className="btn-secondary px-2 py-1" onClick={() => onChange(form.barcodes.filter((_, j) => j !== i))} aria-label="Remove" title="Remove"><Trash2 size={14} aria-hidden /></button>
          {errors[`barcodes.${i}.code`] && <p className="err col-span-4">{errors[`barcodes.${i}.code`]}</p>}
        </div>
      ))}
      {errors.barcodes && <p className="err">{errors.barcodes}</p>}
      <button type="button" className="btn-secondary" onClick={() => onChange([...form.barcodes, { code: '', uomId: '', isPrimary: form.barcodes.length === 0 }])}><Plus size={16} aria-hidden />Add barcode</button>
    </fieldset>
  );
}

function ConversionEditor({ form, uoms, errors, onChange }: { form: ProductForm; uoms: Uom[]; errors: FormErrors; onChange: (c: ProductForm['conversions']) => void }) {
  const base = uoms.find((u) => u.id === form.baseUomId);
  const others = uoms.filter((u) => u.id !== form.baseUomId);
  const update = (i: number, patch: Partial<ProductForm['conversions'][number]>) => onChange(form.conversions.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <fieldset className="card space-y-2">
      <legend className="px-1 font-semibold">Other units</legend>
      <p className="text-sm text-muted-foreground">For example, 1 BOX = 24 {base?.code ?? 'PCS'}. Stock always stays in {base?.code ?? 'the base unit'}.</p>
      {form.conversions.map((c, i) => (
        <div key={i} className="grid grid-cols-[auto_200px_auto_140px_auto_auto] items-center gap-2 text-sm">
          <span>1</span>
          <UomSelect id={`conv-uom-${i}`} uoms={others} value={c.fromUomId} onChange={(v) => update(i, { fromUomId: v })} />
          <span>=</span>
          <input aria-label={`Units of ${base?.code ?? 'base'} in conversion ${i + 1}`} className="input" inputMode="decimal" value={c.factor} onChange={(e) => update(i, { factor: e.target.value })} />
          <span>{base?.code}</span>
          <button type="button" className="btn-secondary px-2 py-1" onClick={() => onChange(form.conversions.filter((_, j) => j !== i))} aria-label="Remove" title="Remove"><Trash2 size={14} aria-hidden /></button>
          {(errors[`conversions.${i}.factorMilli`] ?? errors[`conversions.${i}.fromUomId`]) && <p className="err col-span-6">{errors[`conversions.${i}.factorMilli`] ?? errors[`conversions.${i}.fromUomId`]}</p>}
        </div>
      ))}
      {errors.conversions && <p className="err">{errors.conversions}</p>}
      {others.length > 0 && <button type="button" className="btn-secondary" onClick={() => onChange([...form.conversions, { fromUomId: others[0]!.id, factor: '' }])}><Plus size={16} aria-hidden />Add unit</button>}
    </fieldset>
  );
}
