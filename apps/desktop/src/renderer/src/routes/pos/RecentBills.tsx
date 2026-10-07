import { Eye, History, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// The last few bills, shown while the cart is empty so a cashier can reopen or reprint one without leaving the till.
export default function RecentBills({ onView, onReprint }: { onView: (saleId: string) => void; onReprint: (saleId: string, docNumber: string) => void }) {
  const canView = useCan('sales.view');
  const bills = useQuery({ queryKey: ['recentBills'], queryFn: () => api.sales.list({ limit: 8 }), enabled: canView });
  const items = bills.data?.items ?? [];
  if (!canView || items.length === 0) return null;
  return (
    <section aria-label="Recent bills" className="min-h-0 overflow-auto rounded-lg border border-border bg-card">
      <h2 className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm font-semibold"><History size={16} className="text-primary" aria-hidden />Recent bills</h2>
      <table className="w-full text-sm">
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t border-border first:border-t-0 hover:bg-muted/50">
              <td className="p-2 tabular-nums">{s.docNumber}</td>
              <td className="p-2 text-muted-foreground">{s.docDate} · {timeOf(s.createdAt)}</td>
              <td className="p-2">{s.customerName ?? 'Walk-in'}</td>
              <td className="p-2 text-muted-foreground">{s.status === 'cancelled' ? 'Cancelled' : s.returned === 'full' ? 'Returned' : s.returned === 'partial' ? 'Part returned' : ''}</td>
              <td className="p-2 text-right font-medium tabular-nums">{formatPaise(s.totalPaise)}</td>
              <td className="p-2">
                <span className="flex justify-end gap-1">
                  <button type="button" className="btn-ghost p-1.5" aria-label={`View invoice ${s.docNumber}`} title="View invoice" onClick={() => onView(s.id)}><Eye size={16} aria-hidden /></button>
                  <button type="button" className="btn-ghost p-1.5" aria-label={`Reprint ${s.docNumber}`} title="Reprint receipt" onClick={() => onReprint(s.id, s.docNumber)}><Printer size={16} aria-hidden /></button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
