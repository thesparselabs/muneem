import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { matchesSearch, REFUND_LABELS, returnLabel } from '../../lib/sales/returnForm.js';
import ReturnDialog from './ReturnDialog.js';
import InvoicePreview from '../../components/InvoicePreview.js';
import { FileText, Printer, Receipt, Undo2 } from 'lucide-react';

// Bills with receipt search and Return / Cancel, and the credit notes issued against them (ADR-0043).
export default function Sales() {
  const qc = useQueryClient();
  const canReturn = useCan('sales.edit');
  const canCancel = useCan('sales.cancel');
  const canTakeBack = canReturn || canCancel;
  const [search, setSearch] = useState('');
  const [returning, setReturning] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const sales = useInfiniteQuery({
    queryKey: ['sales'], queryFn: ({ pageParam }) => api.sales.list({ limit: 100, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const notes = useQuery({ queryKey: ['creditNotes'], queryFn: () => api.returns.list({ limit: 50 }) });
  const rows = (sales.data?.pages.flatMap((p) => p.items) ?? []).filter((s) => matchesSearch(s, search));

  async function reprint(creditNoteId: string, docNumber: string) {
    try { await api.returns.reprint({ creditNoteId }); setMessage({ kind: 'ok', text: `Reprinting ${docNumber}` }); } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); }
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Receipt size={22} className="text-primary" aria-hidden /> Sales and returns</h1>
      {message && <p className={message.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'err'} role="status">{message.text}</p>}
      <section className="space-y-3" aria-label="Bills">
        <div className="card">
          <label className="label" htmlFor="sl-search">Find a bill by number or customer</label>
          <input id="sl-search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. 000042 or Meena" />
        </div>
        {sales.error && <p className="err" role="alert">{errorMessage(sales.error)}</p>}
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground"><tr><th className="p-2">Bill</th><th className="p-2">Date</th><th className="p-2">Customer</th><th className="p-2 text-right">Total</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2 tabular-nums">{s.docNumber}</td><td className="p-2">{s.docDate}</td><td className="p-2">{s.customerName ?? 'Walk-in'}</td>
                <td className="p-2 text-right tabular-nums">{formatPaise(s.totalPaise)}</td><td className="p-2 text-muted-foreground">{returnLabel(s)}</td>
                <td className="p-2 text-right">
                  <span className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary gap-1.5 py-1" onClick={() => setPreviewing(s.id)}><FileText size={14} aria-hidden /> Invoice</button>
                    {canTakeBack && s.returned !== 'full' && <button type="button" className="btn-secondary gap-1.5 py-1" onClick={() => setReturning(s.id)}><Undo2 size={14} aria-hidden />Return / Cancel</button>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {sales.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void sales.fetchNextPage()}>Show more</button>}
      </section>
      <section className="space-y-3" aria-label="Credit notes">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText size={18} className="text-muted-foreground" aria-hidden /> Credit notes</h2>
        <div className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground"><tr><th className="p-2">Number</th><th className="p-2">Date</th><th className="p-2">Against</th><th className="p-2">Customer</th><th className="p-2">Refund</th><th className="p-2 text-right">Total</th><th className="p-2" /></tr></thead>
          <tbody>
            {notes.data?.items.map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="p-2 tabular-nums">{n.docNumber}{n.kind === 'cancel' && <span className="ml-2 text-xs text-muted-foreground">cancel</span>}</td><td className="p-2">{n.docDate}</td>
                <td className="p-2 tabular-nums">{n.saleDocNumber}</td><td className="p-2">{n.customerName ?? 'Walk-in'}</td><td className="p-2">{REFUND_LABELS[n.refundMethod]}</td>
                <td className="p-2 text-right tabular-nums">{formatPaise(n.totalPaise)}</td>
                <td className="p-2 text-right"><button type="button" className="btn-secondary gap-1.5 py-1" onClick={() => void reprint(n.id, n.docNumber)}><Printer size={14} aria-hidden />Reprint</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      {previewing && <InvoicePreview saleId={previewing} onClose={() => setPreviewing(null)} />}
      {returning && (
        <ReturnDialog saleId={returning} onClose={() => setReturning(null)} onDone={(r) => {
          setReturning(null);
          setMessage({ kind: 'ok', text: `Credit note ${r.docNumber} for ${formatPaise(r.totalPaise)} issued` });
          void qc.invalidateQueries();
        }} />
      )}
    </div>
  );
}
