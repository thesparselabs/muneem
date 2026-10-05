import type { GridItem, GridMode, GridSummary } from '../../lib/payments/allocationGrid.js';
import { formatPaise } from '../../lib/money.js';

export default function AllocationGrid({ items, mode, typed, summary, onMode, onType }: {
  items: GridItem[]; mode: GridMode; typed: Record<string, string>; summary: GridSummary;
  onMode: (m: GridMode) => void; onType: (id: string, v: string) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-600">Nothing is open; the whole amount stays as an advance on account.</p>;
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="alloc-mode" checked={mode === 'auto'} onChange={() => onMode('auto')} />Oldest due first</label>
        <label className="flex items-center gap-2"><input type="radio" name="alloc-mode" checked={mode === 'choose'} onChange={() => onMode('choose')} />Choose</label>
      </div>
      <table className="table-modern">
        <thead><tr><th>Document</th><th>Due</th><th className="text-right">Open</th><th className="text-right">Settle</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.docNumber ?? i.type}</td><td>{i.dueDate}</td><td className="text-right tabular-nums">{formatPaise(i.openPaise)}</td>
              <td className="text-right">
                {mode === 'auto' ? <span className="tabular-nums">{formatPaise(summary.amounts.get(i.id) ?? 0)}</span>
                  : <input aria-label={`Settle ${i.docNumber ?? i.type}`} className="input w-28 py-1 text-right" inputMode="decimal" value={typed[i.id] ?? ''} onChange={(e) => onType(i.id, e.target.value)} />}
                {summary.errors[i.id] && <p className="text-xs text-red-700">{summary.errors[i.id]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm">Settling {formatPaise(summary.allocatedPaise)} · advance {formatPaise(summary.advancePaise)}</p>
      {summary.errors.total && <p className="err" role="alert">{summary.errors.total}</p>}
    </div>
  );
}
