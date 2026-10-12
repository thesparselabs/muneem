import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ChallanStatus, ChallanSummary, InvoiceTemplateId } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import InvoicePreview from '../../components/InvoicePreview.js';
import ShareDialog from '../../components/ShareDialog.js';
import { challanStatusText, purposeText } from '../../lib/challans/form.js';
import { cn } from '../../lib/cn.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { ChevronDown, Eye, Plus, ReceiptText, Share2, ShoppingCart, Truck } from 'lucide-react';

const FILTERS: { value: ChallanStatus | ''; label: string }[] = [{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'billed', label: 'Invoiced' }];

// FR-087 (ADR-0069): delivery challans, printed on A4 or the 80 mm roll, invoiced by billing a challan for supply at the till.
export default function Challans() {
  const nav = useNavigate();
  const canCreate = useCan('sales.create');
  const canBill = useCan('pos.create');
  const [status, setStatus] = useState<ChallanStatus | ''>('');
  const [previewing, setPreviewing] = useState<{ challan: ChallanSummary; templateId?: InvoiceTemplateId } | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['challans', status],
    queryFn: ({ pageParam }) => api.challans.list({ limit: 100, ...(status && { status }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const preview = previewing && { id: previewing.challan.id, ...(previewing.templateId && { templateId: previewing.templateId }) };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Truck size={22} className="text-primary" aria-hidden />Delivery challans</h1>
        {canCreate && <Link to="/challans/new" className="btn-primary"><Plus size={16} aria-hidden />New challan</Link>}
      </div>
      <div role="group" aria-label="Show" className="inline-flex overflow-hidden rounded-lg border border-border text-sm font-medium">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={status === f.value} onClick={() => setStatus(f.value)}
            className={cn('px-3 py-1.5 transition-colors', status === f.value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>{f.label}</button>
        ))}
      </div>
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr><th className="p-2">Challan</th><th className="p-2">Date</th><th className="p-2">Consignee</th><th className="p-2">Purpose</th><th className="p-2">Vehicle</th><th className="p-2 text-right">Value</th><th className="p-2">Status</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 tabular-nums">{c.docNumber}</td><td className="p-2">{c.docDate}</td><td className="p-2">{c.consigneeName}</td>
                <td className="p-2">{purposeText(c.purpose)}</td><td className="p-2">{c.vehicleNo ?? ''}</td>
                <td className="p-2 text-right tabular-nums">{formatPaise(c.totalPaise)}</td><td className="p-2 text-muted-foreground">{challanStatusText(c)}</td>
                <td className="p-2">
                  <span className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary px-2 py-1" aria-label={`View ${c.docNumber}`} title="View and print" onClick={() => setPreviewing({ challan: c })}><Eye size={14} aria-hidden /></button>
                    <button type="button" className="btn-secondary px-2 py-1" aria-label={`View ${c.docNumber} on the roll`} title="80 mm roll" onClick={() => setPreviewing({ challan: c, templateId: 'thermal-80' })}><ReceiptText size={14} aria-hidden /></button>
                    <button type="button" className="btn-secondary px-2 py-1" aria-label={`Share ${c.docNumber}`} title="Share by WhatsApp or email" onClick={() => setSharing(c.id)}><Share2 size={14} aria-hidden /></button>
                    {canBill && c.status === 'open' && c.purpose === 'supply' && (
                      <button type="button" className="btn-secondary gap-1.5 py-1" onClick={() => nav(`/pos?challan=${c.id}`)}><ShoppingCart size={14} aria-hidden />Bill it</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {list.isSuccess && rows.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No challans here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}><ChevronDown size={16} aria-hidden />Show more</button>}
      {previewing && preview && (
        <InvoicePreview title={`Delivery challan ${previewing.challan.docNumber}`} onClose={() => setPreviewing(null)} source={{
          key: ['challanHtml', preview.id, preview.templateId ?? null], render: () => api.challans.renderHtml(preview), save: () => api.challans.savePdf(preview),
        }} />
      )}
      {sharing && <ShareDialog target={{ docType: 'delivery_challan', id: sharing }} onClose={() => setSharing(null)} />}
    </div>
  );
}
