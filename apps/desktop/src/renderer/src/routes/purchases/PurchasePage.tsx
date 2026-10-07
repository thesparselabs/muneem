import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import type { Purchase } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import { formatPaise, formatRateBp, scaledToText } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { returnLines, type ReturnRow } from '../../lib/purchases/form.js';
import { Truck, ArrowLeft, FileText } from 'lucide-react';

export default function PurchasePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const canReturn = useCan('purchases.create');
  const canCancel = useCan('purchases.cancel');
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const purchase = useQuery({ queryKey: ['purchase', id], queryFn: () => api.purchases.get({ id: id! }) });
  const p = purchase.data;
  if (purchase.error) return <p className="err" role="alert">{errorMessage(purchase.error)}</p>;
  if (!p) return <p>Loading…</p>;
  const returned = p.lines.some((l) => l.returnedQtyMilli > 0);
  async function cancel() {
    try { await api.purchases.cancel({ id: id!, reason }); await qc.invalidateQueries(); } catch (e) { setError(errorMessage(e)); }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Truck size={22} className="text-primary" aria-hidden />Purchase {p.docNumber}{p.status === 'cancelled' && <span className="text-amber-700 dark:text-amber-300"> (cancelled)</span>}</h1>
        <div className="flex gap-2">
          {p.status === 'posted' && canReturn && <button type="button" className="btn-secondary" onClick={() => setReturning(true)}>Return goods</button>}
          <Link to="/purchases" className="btn-secondary px-2.5" aria-label="Purchases" title="Purchases"><ArrowLeft size={16} aria-hidden /></Link>
        </div>
      </div>
      <div className="card grid grid-cols-3 gap-2 text-sm">
        <p>Supplier: <Link to={`/parties/supplier/${p.supplierId}`} className="text-primary">{p.supplier.name}</Link></p>
        <p>Bill {p.supplierInvoiceNo} of {p.supplierInvoiceDate}</p><p>Due {p.dueDate}</p>
        <p>Total <span className="font-semibold">{formatPaise(p.totals.totalPaise)}</span></p><p>Settled {formatPaise(p.settledPaise)}</p><p>ITC {formatPaise(p.totals.itcPaise)}</p>
        {p.cancelReason && <p className="col-span-3">Cancelled: {p.cancelReason}</p>}
      </div>
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">GST</th><th className="text-right">Taxable</th><th className="text-right">Charges</th><th className="text-right">Landed</th><th className="text-right">Unit cost</th><th className="text-right">Returned</th></tr></thead>
        <tbody>
          {p.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.name}{!l.itcEligible && <span className="text-xs text-muted-foreground"> (no ITC)</span>}</td>
              <td className="text-right">{scaledToText(l.qtyMilli, 3)} {l.uomCode}</td><td className="text-right tabular-nums">{formatPaise(l.unitPricePaise)}</td>
              <td className="text-right">{formatRateBp(l.gstRateBp)}</td><td className="text-right tabular-nums">{formatPaise(l.taxablePaise)}</td>
              <td className="text-right tabular-nums">{formatPaise(l.chargesPaise)}</td><td className="text-right tabular-nums">{formatPaise(l.landedValuePaise)}</td>
              <td className="text-right tabular-nums">{formatPaise(l.unitCostPaise)}</td><td className="text-right">{l.returnedQtyMilli ? scaledToText(l.returnedQtyMilli, 3) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.status === 'posted' && canCancel && p.settledPaise === 0 && !returned && (
        <div className="card flex items-end gap-2">
          <div className="grow"><label className="label" htmlFor="pc-reason">Cancel a wrong entry — reason</label><input id="pc-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <button type="button" className="btn-secondary" disabled={!reason.trim()} onClick={() => void cancel()}>Cancel purchase</button>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      {returning && <ReturnDialog purchase={p} onClose={() => setReturning(false)} onDone={() => { setReturning(false); void qc.invalidateQueries(); }} />}
    </div>
  );
}

function ReturnDialog({ purchase, onClose, onDone }: { purchase: Purchase; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ReturnRow[]>(purchase.lines.map((l) => ({ purchaseItemId: l.id, name: l.name, uomCode: l.uomCode, leftMilli: l.qtyMilli - l.returnedQtyMilli, qty: '' })));
  const [reason, setReason] = useState('');
  const [refundCharges, setRefundCharges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandId] = useState(newUlid);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = returnLines(rows);
    if (!r.ok) { setError(r.error); return; }
    try { await api.purchases.return({ purchaseId: purchase.id, lines: r.lines, reason, refundCharges, commandId }); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title={`Return goods · ${purchase.docNumber}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <table className="table-modern">
          <thead><tr><th>Product</th><th className="text-right">Left to return</th><th>Return</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.purchaseItemId}><td>{r.name}</td><td className="text-right">{scaledToText(r.leftMilli, 3)} {r.uomCode}</td>
              <td><input aria-label={`Return quantity for ${r.name}`} className="input w-24 py-1" inputMode="decimal" disabled={r.leftMilli === 0} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} /></td></tr>
          ))}</tbody>
        </table>
        <div><label className="label" htmlFor="rt-reason">Reason</label><input id="rt-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={refundCharges} onChange={(e) => setRefundCharges(e.target.checked)} />The supplier also refunds the freight on these goods</label>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary"><FileText size={16} aria-hidden />Issue debit note</button>
      </form>
    </Dialog>
  );
}
