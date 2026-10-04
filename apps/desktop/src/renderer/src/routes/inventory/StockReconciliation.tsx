import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { scaledToText } from '../../lib/money.js';
import { reconcile } from '../../lib/sync/reconciliation.js';

const qty = (milli: number, uom: string) => `${scaledToText(milli, 3)} ${uom}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function StockReconciliation() {
  const [viaSyncOnly, setViaSyncOnly] = useState(true);
  const report = useQuery({ queryKey: ['stockReconciliation'], queryFn: () => api.inventory.stockReconciliation({}) });
  const products = reconcile(report.data ?? [], { viaSyncOnly });
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock reconciliation</h1>
        <Link to="/inventory" className="btn-secondary">Back to inventory</Link>
      </div>
      <p className="text-sm text-slate-600">
        Terminals bill offline from their own count, so two of them can sell the last unit. These are the products whose stock went below zero, and the sales that took it there.
        Count the shelf and use a stock take or an adjustment to correct them.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={viaSyncOnly} onChange={(e) => setViaSyncOnly(e.target.checked)} /> Only where another terminal's sale was involved
      </label>
      {report.isError && <p className="err" role="alert">{errorMessage(report.error)}</p>}
      {report.isSuccess && products.length === 0 && <p className="text-sm text-slate-600">No product went below zero{viaSyncOnly ? ' through another terminal' : ''}.</p>}
      {products.map((p) => (
        <section key={p.key} className="card space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <p><Link to={`/inventory/product/${p.productId}`} className="font-medium text-blue-800">{p.productName}</Link> <span className="text-slate-500">· {p.warehouseName}</span></p>
            <p className="tabular-nums">Now <span className={p.currentQtyMilli < 0 ? 'font-medium text-red-700' : ''}>{qty(p.currentQtyMilli, p.uomCode)}</span> · lowest {qty(p.lowestMilli, p.uomCode)}</p>
          </div>
          <table className="w-full">
            <thead className="text-left text-slate-500"><tr><th className="p-1 font-normal">When</th><th className="p-1 font-normal">Where</th><th className="p-1 font-normal">Document</th>
              <th className="p-1 text-right font-normal">Quantity</th><th className="p-1 text-right font-normal">Stock after</th></tr></thead>
            <tbody>{p.breaches.map((b) => (
              <tr key={b.movementId} className="border-t">
                <td className="p-1">{when(b.occurredAt)}</td>
                <td className="p-1">{b.source}{b.viaSync && <span className="ml-2 rounded bg-blue-100 px-1.5 text-xs text-blue-900">synced</span>}</td>
                <td className="p-1 font-mono text-xs">{b.document ?? '—'}</td>
                <td className="p-1 text-right tabular-nums">{qty(b.qtyMilli, p.uomCode)}</td>
                <td className="p-1 text-right tabular-nums text-red-700">{qty(b.balanceAfterMilli, p.uomCode)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
