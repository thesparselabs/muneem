import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';

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
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{product.data?.name ?? '…'} — stock ledger</h1>
        <Link to="/inventory" className="btn-secondary">Back to inventory</Link>
      </div>
      {moves.error && <p className="err" role="alert">{errorMessage(moves.error)}</p>}
      {rows.length === 0 && !moves.isLoading && <p className="card text-sm text-slate-600">No stock movements yet.</p>}
      {rows.length > 0 && (
        <table className="table-modern rounded-lg border bg-white">
          <thead><tr><th>When</th><th>What</th><th className="text-right">Qty</th><th className="text-right">Unit cost</th><th className="text-right">Value</th><th className="text-right">Balance</th><th className="text-right">Balance value</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.at).toLocaleString('en-IN')}</td>
                <td>{TYPE_LABEL[m.type] ?? m.type}{m.reason && <span className="text-slate-500"> · {m.reason.replace('_', ' ')}</span>}{m.provisional && <span className="ml-1 text-xs text-amber-800">(provisional cost)</span>}</td>
                <td className={`text-right tabular-nums ${m.qtyMilli < 0 ? 'text-red-700' : ''}`}>{m.qtyMilli ? scaledToText(m.qtyMilli, 3) : '—'}</td>
                <td className="text-right tabular-nums">{m.unitCostPaise ? formatPaise(m.unitCostPaise) : '—'}</td>
                <td className="text-right tabular-nums">{formatPaise(m.valuePaise)}</td>
                <td className="text-right tabular-nums">{scaledToText(m.balanceQtyMilli, 3)}</td>
                <td className="text-right tabular-nums">{formatPaise(m.balanceValuePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {moves.hasNextPage && <button className="btn-secondary" onClick={() => void moves.fetchNextPage()}>Load older</button>}
    </div>
  );
}
