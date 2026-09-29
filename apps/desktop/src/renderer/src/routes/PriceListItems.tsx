import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product, Uom } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import { itemToRow, rowsToItems, type PriceRow } from '../lib/priceItems.js';
import UomSelect from '../components/UomSelect.js';

const today = () => new Date().toLocaleDateString('en-CA');

export default function PriceListItems({ product, uoms }: { product: Product; uoms: Uom[] }) {
  const qc = useQueryClient();
  const lists = useQuery({ queryKey: ['priceLists'], queryFn: () => api.pricing.listLists({}) });
  const [listId, setListId] = useState('');
  const activeList = listId || lists.data?.[0]?.id || '';
  const items = useQuery({
    queryKey: ['priceItems', activeList, product.id],
    queryFn: () => api.pricing.getItems({ priceListId: activeList, productId: product.id }),
    enabled: activeList !== '',
  });
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { if (items.data) setRows(items.data.map(itemToRow)); }, [items.data]);

  const update = (i: number, patch: Partial<PriceRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  async function save() {
    const result = rowsToItems(rows);
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({}); setMessage(null);
    try {
      await api.pricing.setItems({ priceListId: activeList, productId: product.id, items: result.items });
      await qc.invalidateQueries({ queryKey: ['priceItems', activeList, product.id] });
      await qc.invalidateQueries({ queryKey: ['product', product.id] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      setMessage('Prices saved.');
    } catch (e) { setMessage(errorMessage(e)); }
  }

  return (
    <fieldset className="card space-y-3">
      <legend className="px-1 font-semibold">Price lists</legend>
      <div className="flex items-end gap-3">
        <div>
          <label className="label" htmlFor="price-list">Price list</label>
          <select id="price-list" className="input" value={activeList} onChange={(e) => setListId(e.target.value)}>
            {lists.data?.map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </div>
        <p className="text-sm text-slate-500 pb-2">Add a row per unit and quantity break. The newest price that is in effect wins.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-600"><tr><th className="p-1">Unit</th><th className="p-1">From qty</th><th className="p-1">Price (₹)</th><th className="p-1">Incl. GST</th><th className="p-1">From date</th><th className="p-1">Until</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="p-1"><UomSelect id={`pli-uom-${i}`} uoms={uoms} value={r.uomId} onChange={(v) => update(i, { uomId: v })} /></td>
              <td className="p-1"><input aria-label="From quantity" className="input" inputMode="decimal" value={r.minQty} onChange={(e) => update(i, { minQty: e.target.value })} /></td>
              <td className="p-1"><input aria-label="Price" className="input" inputMode="decimal" value={r.price} onChange={(e) => update(i, { price: e.target.value })} />{errors[`items.${i}.pricePaise`] && <p className="err">{errors[`items.${i}.pricePaise`]}</p>}</td>
              <td className="p-1 text-center"><input aria-label="Price includes GST" type="checkbox" checked={r.isInclusive} onChange={(e) => update(i, { isInclusive: e.target.checked })} /></td>
              <td className="p-1"><input aria-label="Effective from" type="date" className="input" value={r.effectiveFrom} onChange={(e) => update(i, { effectiveFrom: e.target.value })} /></td>
              <td className="p-1"><input aria-label="Effective until" type="date" className="input" value={r.effectiveTo} onChange={(e) => update(i, { effectiveTo: e.target.value })} /></td>
              <td className="p-1"><button type="button" className="btn-secondary py-1" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {Object.keys(errors).length > 0 && <p className="err">Fix the highlighted prices. {Object.values(errors)[0]}</p>}
      {message && <p className="text-sm" role="status">{message}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => setRows([...rows, { uomId: product.baseUomId, minQty: '0', price: '', isInclusive: product.priceIsInclusive, effectiveFrom: today(), effectiveTo: '' }])}>Add price</button>
        <button type="button" className="btn-primary" onClick={() => void save()}>Save prices</button>
      </div>
    </fieldset>
  );
}
