import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrandInput, CategoryInput, PriceListInput, UomInput, type PriceList } from '@muneem/contracts';
import type { z } from 'zod';
import { api, errorMessage } from '../api.js';

type Tab = 'units' | 'categories' | 'brands' | 'priceLists';
const TABS: [Tab, string][] = [['units', 'Units'], ['categories', 'Categories'], ['brands', 'Brands'], ['priceLists', 'Price lists']];

export default function CatalogSettings() {
  const [tab, setTab] = useState<Tab>('units');
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Units, categories &amp; price lists</h1>
        <Link to="/products" className="btn-secondary">Back to products</Link>
      </div>
      <div className="flex gap-1" role="tablist">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`btn-secondary py-1 ${tab === t ? 'bg-slate-200' : ''}`} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'units' && <Units />}
        {tab === 'categories' && <Categories />}
        {tab === 'brands' && <Brands />}
        {tab === 'priceLists' && <PriceLists />}
      </div>
    </div>
  );
}

function useSave() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = async (fn: () => Promise<unknown>, keys: string[]): Promise<boolean> => {
    setError(null);
    try {
      await fn();
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      return true;
    } catch (e) { setError(errorMessage(e)); return false; }
  };
  const create = <S extends z.ZodTypeAny>(schema: S, value: unknown, fn: (input: z.output<S>) => Promise<unknown>, keys: string[]) => {
    const parsed = schema.safeParse(value);
    if (parsed.success) return save(() => fn(parsed.data), keys);
    setError(parsed.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; '));
    return Promise.resolve(false);
  };
  return { save, create, error };
}

function AddForm({ onSubmit, children, error }: { onSubmit: () => Promise<boolean>; children: ReactNode; error: string | null }) {
  const submit = (e: FormEvent) => { e.preventDefault(); void onSubmit(); };
  return (
    <form onSubmit={submit} className="card space-y-2">
      <div className="flex items-end gap-2">{children}<button type="submit" className="btn-primary">Add</button></div>
      {error && <p className="err" role="alert">{error}</p>}
    </form>
  );
}

function Units() {
  const uoms = useQuery({ queryKey: ['uoms'], queryFn: () => api.catalog.listUoms({}) });
  const { create, error } = useSave();
  const [f, setF] = useState({ code: '', name: '', decimals: 0 });
  const add = async () => {
    const ok = await create(UomInput, { ...f, code: f.code.trim().toUpperCase() }, (input) => api.catalog.createUom(input), ['uoms']);
    if (ok) setF({ code: '', name: '', decimals: 0 });
    return ok;
  };
  return (
    <div className="space-y-3">
      <AddForm onSubmit={add} error={error}>
        <div><label className="label" htmlFor="uom-code">Code</label><input id="uom-code" className="input uppercase w-28" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required maxLength={8} /></div>
        <div className="grow"><label className="label" htmlFor="uom-name">Name</label><input id="uom-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><label className="label" htmlFor="uom-dec">Decimals</label>
          <select id="uom-dec" className="input" value={f.decimals} onChange={(e) => setF({ ...f, decimals: Number(e.target.value) })}>{[0, 1, 2, 3].map((d) => <option key={d}>{d}</option>)}</select>
        </div>
      </AddForm>
      <ul className="card divide-y text-sm">
        {uoms.data?.map((u) => <li key={u.id} className="py-2 flex justify-between"><span><span className="font-mono">{u.code}</span> · {u.name}</span><span className="text-slate-500">{u.decimals} decimals</span></li>)}
      </ul>
    </div>
  );
}

function RenameRow({ name, prefix, onRename }: { name: string; prefix?: string | undefined; onRename: (n: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (!editing) return <li className="py-2 flex justify-between"><span>{prefix && <span className="text-slate-500">{prefix} › </span>}{name}</span><button className="btn-secondary py-1" onClick={() => setEditing(true)}>Rename</button></li>;
  return (
    <li className="py-2 flex gap-2">
      <input aria-label={`New name for ${name}`} className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      <button className="btn-primary py-1" onClick={async () => { if (await onRename(value)) setEditing(false); }}>Save</button>
      <button className="btn-secondary py-1" onClick={() => { setValue(name); setEditing(false); }}>Cancel</button>
    </li>
  );
}

function Categories() {
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.listCategories({}) });
  const { save, create, error } = useSave();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const nameOf = (id: string | null) => categories.data?.find((c) => c.id === id)?.name;
  const add = async () => {
    const ok = await create(CategoryInput, { name, parentId: parentId || null }, (input) => api.catalog.createCategory(input), ['categories']);
    if (ok) setName('');
    return ok;
  };
  return (
    <div className="space-y-3">
      <AddForm onSubmit={add} error={error}>
        <div className="grow"><label className="label" htmlFor="cat-name">Category name</label><input id="cat-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label" htmlFor="cat-parent">Inside</label>
          <select id="cat-parent" className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">(top level)</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </AddForm>
      <ul className="card divide-y text-sm">
        {categories.data?.map((c) => (
          <RenameRow key={c.id} name={c.name} prefix={nameOf(c.parentId)}
            onRename={(n) => save(() => api.catalog.updateCategory({ id: c.id, version: c.version, name: n, parentId: c.parentId }), ['categories', 'products'])} />
        ))}
      </ul>
    </div>
  );
}

function Brands() {
  const brands = useQuery({ queryKey: ['brands'], queryFn: () => api.catalog.listBrands({}) });
  const { save, create, error } = useSave();
  const [name, setName] = useState('');
  const add = async () => {
    const ok = await create(BrandInput, { name }, (input) => api.catalog.createBrand(input), ['brands']);
    if (ok) setName('');
    return ok;
  };
  return (
    <div className="space-y-3">
      <AddForm onSubmit={add} error={error}>
        <div className="grow"><label className="label" htmlFor="brand-name">Brand name</label><input id="brand-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      </AddForm>
      <ul className="card divide-y text-sm">
        {brands.data?.map((b) => <RenameRow key={b.id} name={b.name} onRename={(n) => save(() => api.catalog.updateBrand({ id: b.id, version: b.version, name: n }), ['brands', 'products'])} />)}
      </ul>
    </div>
  );
}

function PriceLists() {
  const lists = useQuery({ queryKey: ['priceLists'], queryFn: () => api.pricing.listLists({}) });
  const { create, error } = useSave();
  const [f, setF] = useState<{ name: string; kind: PriceList['kind'] }>({ name: '', kind: 'wholesale' });
  const add = async () => {
    const ok = await create(PriceListInput, f, (input) => api.pricing.createList(input), ['priceLists']);
    if (ok) setF({ ...f, name: '' });
    return ok;
  };
  return (
    <div className="space-y-3">
      <AddForm onSubmit={add} error={error}>
        <div className="grow"><label className="label" htmlFor="pl-name">List name</label><input id="pl-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><label className="label" htmlFor="pl-kind">Kind</label>
          <select id="pl-kind" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PriceList['kind'] })}>
            {['retail', 'wholesale', 'distributor', 'custom'].map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
      </AddForm>
      <ul className="card divide-y text-sm">
        {lists.data?.map((l) => <li key={l.id} className="py-2 flex justify-between"><span>{l.name}</span><span className="text-slate-500">{l.kind}{l.isDefault ? ' · default' : ''}</span></li>)}
      </ul>
      <p className="text-sm text-slate-500">Set a product's prices in each list from the product's page.</p>
    </div>
  );
}
