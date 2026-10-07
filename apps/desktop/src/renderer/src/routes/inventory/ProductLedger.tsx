import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { BookOpen, ArrowLeft, ChevronDown } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = { opening: 'Opening stock', sale: 'Sale', adjustment: 'Adjustment', cost_correction: 'Cost correction', purchase: 'Purchase' };

export default function ProductLedger() {
  const { id } = useParams();
  const product = useQuery({ queryKey: ['product', id], queryFn: () => api.products.get({ id: id! }) });
  const moves = useInfiniteQuery({
    queryKey: ['movements', id],
    queryFn: ({ pageParam }) => api.inventory.getMovements({ productId: id!, limit: 100, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = moves.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen size={22} className="text-primary" aria-hidden />{product.data?.name ?? '…'} — stock ledger</h1>
        <Link to="/inventory" className="btn-secondary px-2.5" aria-label="Back to inventory" title="Back to inventory"><ArrowLeft size={16} aria-hidden /></Link>
      </div>
      {moves.error && <p className="err" role="alert">{errorMessage(moves.error)}</p>}
      {rows.length === 0 && !moves.isLoading && <p className="card text-sm text-muted-foreground">No stock movements yet.</p>}
      {rows.length > 0 && (
        <table className="table-modern rounded-lg border border-border bg-card">
          <thead><tr><th>When</th><th>What</th><th className="text-right">Qty</th><th className="text-right">Unit cost</th><th className="text-right">Value</th><th className="text-right">Balance</th><th className="text-right">Balance value</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.at).toLocaleString('en-IN')}</td>
                <td>{TYPE_LABEL[m.type] ?? m.type}{m.reason && <span className="text-muted-foreground"> · {m.reason.replace('_', ' ')}</span>}{m.provisional && <span className="ml-1 text-xs text-amber-800 dark:text-amber-300">(provisional cost)</span>}</td>
                <td className={`text-right tabular-nums ${m.qtyMilli < 0 ? 'text-destructive' : ''}`}>{m.qtyMilli ? scaledToText(m.qtyMilli, 3) : '—'}</td>
                <td className="text-right tabular-nums">{m.unitCostPaise ? formatPaise(m.unitCostPaise) : '—'}</td>
                <td className="text-right tabular-nums">{formatPaise(m.valuePaise)}</td>
                <td className="text-right tabular-nums">{scaledToText(m.balanceQtyMilli, 3)}</td>
                <td className="text-right tabular-nums">{formatPaise(m.balanceValuePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {moves.hasNextPage && <button className="btn-secondary" onClick={() => void moves.fetchNextPage()}><ChevronDown size={16} aria-hidden />Load older</button>}
    </div>
  );
}
