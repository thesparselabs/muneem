import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OPENING_IMPORT_FIELDS, type OpeningImportField, type OpeningImportMapping, type OpeningImportPreview, type ProductHit } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import ProductPicker from '../../components/ProductPicker.js';
import { fileToBase64 } from '../../lib/fileToBase64.js';
import { parseOptional } from '../../lib/money.js';

interface Row { productId: string; name: string; uomCode: string; qty: string; cost: string }
const FIELD_LABEL: Record<OpeningImportField, string> = { sku: 'SKU', barcode: 'Barcode', qty: 'Quantity', unitCost: 'Unit cost' };

export default function OpeningStock() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OpeningImportPreview | null>(null);
  const add = (h: ProductHit) => setRows((r) => (r.some((x) => x.productId === h.productId) ? r : [...r, { productId: h.productId, name: h.name, uomCode: h.baseUomCode, qty: '', cost: '' }]));
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const done = async () => { await qc.invalidateQueries(); nav('/inventory'); };

  async function save(e: FormEvent) {
    e.preventDefault();
    const lines = [];
    for (const r of rows) {
      const qty = parseOptional(r.qty, 3);
      const cost = parseOptional(r.cost, 2);
      if (!qty || qty <= 0 || cost === null || cost === undefined || cost < 0) { setError(`Enter a quantity and unit cost for ${r.name}`); return; }
      lines.push({ productId: r.productId, qtyMilli: qty, unitCostPaise: cost });
    }
    try { await api.inventory.setOpeningStock({ lines }); await done(); } catch (err) { setError(errorMessage(err)); }
  }
  async function choose(file: File) {
    try { setPreview(await api.inventory.importOpeningPreview({ fileName: file.name, contentBase64: await fileToBase64(file) })); } catch (err) { setError(errorMessage(err)); }
  }
  async function remap(mapping: OpeningImportMapping) {
    try { setPreview(await api.inventory.importOpeningPreview({ importId: preview!.importId, mapping })); } catch (err) { setError(errorMessage(err)); }
  }
  async function commit() {
    try { await api.inventory.importOpeningCommit({ importId: preview!.importId, commandId: newUlid() }); await done(); } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Opening stock</h1><Link to="/inventory" className="btn-secondary">Cancel</Link></div>
      <p className="text-sm text-slate-600">Enter what is on the shelf today and what each unit cost you, in the product's base unit. Opening stock can be entered once per product; after that, use Adjust stock or a stock take.</p>
      {error && <p className="err" role="alert">{error}</p>}
      <form onSubmit={save} className="card space-y-3">
        <h2 className="font-semibold">Enter by hand</h2>
        <ProductPicker id="open-product" label="Add a product" onPick={add} />
        {rows.map((r, i) => (
          <div key={r.productId} className="grid grid-cols-[1fr_140px_140px_auto] items-center gap-2 text-sm">
            <span>{r.name}</span>
            <input aria-label={`Quantity of ${r.name} (${r.uomCode})`} className="input py-1" inputMode="decimal" placeholder={`Qty (${r.uomCode})`} value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} />
            <input aria-label={`Unit cost of ${r.name}`} className="input py-1" inputMode="decimal" placeholder="Unit cost (₹)" value={r.cost} onChange={(e) => set(i, { cost: e.target.value })} />
            <button type="button" className="btn-secondary py-1" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="submit" className="btn-primary" disabled={rows.length === 0}>Save opening stock</button>
      </form>
      <div className="card space-y-3">
        <h2 className="font-semibold">Import from a file</h2>
        {!preview ? (
          <><label className="label" htmlFor="open-file">CSV or Excel file with SKU or barcode, quantity and unit cost</label>
            <input id="open-file" type="file" accept=".csv,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f); }} /></>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              {OPENING_IMPORT_FIELDS.map((f) => (
                <div key={f}><label className="label" htmlFor={`om-${f}`}>{FIELD_LABEL[f]}</label>
                  <select id={`om-${f}`} className="input" value={preview.mapping[f] ?? ''} onChange={(e) => {
                    const next = { ...preview.mapping };
                    if (e.target.value === '') delete next[f]; else next[f] = Number(e.target.value);
                    void remap(next);
                  }}>
                    <option value="">— not in file —</option>{preview.columns.map((c, i) => <option key={i} value={i}>{c || `Column ${i + 1}`}</option>)}
                  </select></div>
              ))}
            </div>
            <p className="text-sm">{preview.counts.ok} ready, {preview.counts.errors} with errors (skipped).</p>
            <ul className="text-sm text-red-700">{preview.rows.filter((r) => r.status === 'error').slice(0, 50).map((r) => <li key={r.line}>Row {r.line}: {Object.values(r.errors).join('; ')}</li>)}</ul>
            <div className="flex gap-2"><button className="btn-primary" disabled={preview.counts.ok === 0} onClick={() => void commit()}>Import {preview.counts.ok} products</button><button className="btn-secondary" onClick={() => setPreview(null)}>Choose another file</button></div>
          </>
        )}
      </div>
    </div>
  );
}
