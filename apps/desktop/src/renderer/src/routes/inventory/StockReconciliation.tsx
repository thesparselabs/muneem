import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { scaledToText } from '../../lib/money.js';
import { reconcile } from '../../lib/sync/reconciliation.js';
import { GitCompare, ArrowLeft } from 'lucide-react';

const qty = (milli: number, uom: string) => `${scaledToText(milli, 3)} ${uom}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function StockReconciliation() {
  const [viaSyncOnly, setViaSyncOnly] = useState(true);
  const report = useQuery({ queryKey: ['stockReconciliation'], queryFn: () => api.inventory.stockReconciliation({}) });
  const products = reconcile(report.data ?? [], { viaSyncOnly });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><GitCompare size={22} className="text-primary" aria-hidden />Stock reconciliation</h1>
        <Link to="/inventory" className="btn-secondary"><ArrowLeft size={16} aria-hidden />Back to inventory</Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Terminals bill offline from their own count, so two of them can sell the last unit. These are the products whose stock went below zero, and the sales that took it there.
        Count the shelf and use a stock take or an adjustment to correct them.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={viaSyncOnly} onChange={(e) => setViaSyncOnly(e.target.checked)} /> Only where another terminal's sale was involved
      </label>
      {report.isError && <p className="err" role="alert">{errorMessage(report.error)}</p>}
      {report.isSuccess && products.length === 0 && <p className="text-sm text-muted-foreground">No product went below zero{viaSyncOnly ? ' through another terminal' : ''}.</p>}
      {products.map((p) => (
        <section key={p.key} className="card space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <p><Link to={`/inventory/product/${p.productId}`} className="font-medium text-primary">{p.productName}</Link> <span className="text-muted-foreground">· {p.warehouseName}</span></p>
            <p className="tabular-nums">Now <span className={p.currentQtyMilli < 0 ? 'font-medium text-destructive' : ''}>{qty(p.currentQtyMilli, p.uomCode)}</span> · lowest {qty(p.lowestMilli, p.uomCode)}</p>
          </div>
          <table className="table-modern">
            <thead><tr><th className="font-normal">When</th><th className="font-normal">Where</th><th className="font-normal">Document</th>
              <th className="text-right font-normal">Quantity</th><th className="text-right font-normal">Stock after</th></tr></thead>
            <tbody>{p.breaches.map((b) => (
              <tr key={b.movementId}>
                <td>{when(b.occurredAt)}</td>
                <td>{b.source}{b.viaSync && <span className="ml-2 rounded bg-accent px-1.5 text-xs text-primary">synced</span>}</td>
                <td className="font-mono text-xs">{b.document ?? '—'}</td>
                <td className="text-right tabular-nums">{qty(b.qtyMilli, p.uomCode)}</td>
                <td className="text-right tabular-nums text-destructive">{qty(b.balanceAfterMilli, p.uomCode)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
