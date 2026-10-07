import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ADJUSTMENT_REASONS, type ProductHit } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import ProductPicker from '../../components/ProductPicker.js';
import { parseOptional, scaledToText } from '../../lib/money.js';
import { SlidersHorizontal, Check, X, Trash2 } from 'lucide-react';

type Reason = (typeof ADJUSTMENT_REASONS)[number];
interface Row { productId: string; name: string; uomCode: string; stockMilli: number; direction: 'out' | 'in'; qty: string; reason: Reason }

export default function AdjustStock() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = (h: ProductHit) => setRows((r) => (r.some((x) => x.productId === h.productId) ? r
    : [...r, { productId: h.productId, name: h.name, uomCode: h.baseUomCode, stockMilli: h.stockMilli, direction: 'out', qty: '', reason: 'damage' }]));
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const lines = [];
    for (const r of rows) {
      const q = parseOptional(r.qty, 3);
      if (!q || q <= 0) { setError(`Enter a quantity for ${r.name}`); return; }
      lines.push({ productId: r.productId, qtyMilli: r.direction === 'out' ? -q : q, reason: r.reason });
    }
    try {
      await api.inventory.adjust({ lines, ...(note.trim() && { note: note.trim() }) });
      await qc.invalidateQueries();
      nav('/inventory');
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <form onSubmit={submit} className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><SlidersHorizontal size={22} className="text-primary" aria-hidden />Adjust stock</h1><Link to="/inventory" className="btn-secondary"><X size={16} aria-hidden />Cancel</Link></div>
      <div className="card"><ProductPicker id="adj-product" label="Add a product" onPick={add} /></div>
      {rows.length > 0 && (
        <table className="table-modern rounded-lg border border-border bg-card">
          <thead><tr><th>Product</th><th>In stock</th><th>Change</th><th>Quantity</th><th>Reason</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.productId}>
                <td>{r.name}</td>
                <td className="tabular-nums">{scaledToText(r.stockMilli, 3)} {r.uomCode}</td>
                <td>
                  <select aria-label={`Direction for ${r.name}`} className="select py-1" value={r.direction} onChange={(e) => set(i, { direction: e.target.value as Row['direction'] })}>
                    <option value="out">Remove</option><option value="in">Add</option>
                  </select>
                </td>
                <td><input aria-label={`Quantity for ${r.name}`} className="input w-24 py-1" inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} /></td>
                <td>
                  <select aria-label={`Reason for ${r.name}`} className="select py-1" value={r.reason} onChange={(e) => set(i, { reason: e.target.value as Reason })}>
                    {ADJUSTMENT_REASONS.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
                  </select>
                </td>
                <td><button type="button" className="btn-secondary px-2 py-1" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove" title="Remove"><Trash2 size={14} aria-hidden /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div><label className="label" htmlFor="adj-note">Note (optional)</label><input id="adj-note" className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={rows.length === 0}><Check size={16} aria-hidden />Post adjustment</button>
    </form>
  );
}
