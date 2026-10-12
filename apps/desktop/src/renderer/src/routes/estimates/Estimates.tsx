import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { EstimateStatus, EstimateSummary } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import InvoicePreview from '../../components/InvoicePreview.js';
import ShareDialog from '../../components/ShareDialog.js';
import { STATUS_FILTERS, statusText } from '../../lib/estimates/form.js';
import { cn } from '../../lib/cn.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { ChevronDown, ClipboardList, Eye, Plus, Share2, ShoppingCart } from 'lucide-react';

// FR-086 (ADR-0068): quotations, open until billed; "Bill it" takes one to the till.
export default function Estimates() {
  const nav = useNavigate();
  const canCreate = useCan('sales.create');
  const canBill = useCan('pos.create');
  const [status, setStatus] = useState<EstimateStatus | ''>('');
  const [previewing, setPreviewing] = useState<EstimateSummary | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['estimates', status],
    queryFn: ({ pageParam }) => api.estimates.list({ limit: 100, ...(status && { status }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><ClipboardList size={22} className="text-primary" aria-hidden />Estimates</h1>
        {canCreate && <Link to="/estimates/new" className="btn-primary"><Plus size={16} aria-hidden />New estimate</Link>}
      </div>
      <div role="group" aria-label="Show" className="inline-flex overflow-hidden rounded-lg border border-border text-sm font-medium">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={status === f.value} onClick={() => setStatus(f.value)}
            className={cn('px-3 py-1.5 transition-colors', status === f.value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>{f.label}</button>
        ))}
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr><th className="p-2">Estimate</th><th className="p-2">Date</th><th className="p-2">Valid until</th><th className="p-2">Customer</th><th className="p-2 text-right">Total</th><th className="p-2">Status</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-2 tabular-nums">{e.docNumber}</td><td className="p-2">{e.docDate}</td><td className="p-2">{e.validUntil}</td>
                <td className="p-2">{e.customerName ?? 'Walk-in'}</td><td className="p-2 text-right tabular-nums">{formatPaise(e.totalPaise)}</td>
                <td className={cn('p-2', e.status === 'expired' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{statusText(e)}</td>
                <td className="p-2">
                  <span className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary px-2 py-1" aria-label={`View ${e.docNumber}`} title="View and print" onClick={() => setPreviewing(e)}><Eye size={14} aria-hidden /></button>
                    <button type="button" className="btn-secondary px-2 py-1" aria-label={`Share ${e.docNumber}`} title="Share by WhatsApp or email" onClick={() => setSharing(e.id)}><Share2 size={14} aria-hidden /></button>
                    {canBill && e.status !== 'converted' && (
                      <button type="button" className="btn-secondary gap-1.5 py-1" onClick={() => nav(`/pos?estimate=${e.id}`)}><ShoppingCart size={14} aria-hidden />Bill it</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {list.isSuccess && rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No estimates here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}><ChevronDown size={16} aria-hidden />Show more</button>}
      {previewing && (
        <InvoicePreview title={`Quotation ${previewing.docNumber}`} onClose={() => setPreviewing(null)} source={{
          key: ['estimateHtml', previewing.id], render: () => api.estimates.renderHtml({ id: previewing.id }), save: () => api.estimates.savePdf({ id: previewing.id }),
        }} />
      )}
      {sharing && <ShareDialog target={{ docType: 'estimate', id: sharing }} onClose={() => setSharing(null)} />}
    </div>
  );
}
