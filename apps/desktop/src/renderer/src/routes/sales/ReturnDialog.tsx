import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CompleteReturnResult, RefundMethod, ReturnDraft, ReturnQuote } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import HoldToDelete from '../../components/HoldToDelete.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { parseQuantities, REFUND_LABELS, wholeBill, type QtyInputs } from '../../lib/sales/returnForm.js';
import { useDebounced } from '../../lib/useDebounced.js';

// ADR-0043: pick lines and quantities, see the credit note priced from the bill's own tax, then refund or credit the customer.
export default function ReturnDialog({ saleId, onClose, onDone }: { saleId: string; onClose: () => void; onDone: (r: CompleteReturnResult) => void }) {
  const canReturn = useCan('sales.edit');
  const canCancel = useCan('sales.cancel');
  const [inputs, setInputs] = useState<QtyInputs | null>(null);
  const [method, setMethod] = useState<RefundMethod | undefined>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commandId = useMemo(() => newUlid(), []);

  const base = useQuery({ queryKey: ['returnBase', saleId], queryFn: () => api.returns.quote({ saleId, lines: [{ lineNo: 1, qtyMilli: 1 }] }) });
  useEffect(() => { if (base.data && inputs === null) setInputs(wholeBill(base.data)); }, [base.data, inputs]);
  const parsed = base.data && inputs ? parseQuantities(base.data, inputs) : null;
  const draftKey = useDebounced(parsed && parsed.lines.length > 0 ? JSON.stringify({ saleId, lines: parsed.lines, ...(method && { refundMethod: method }) }) : '', 200);
  const draft = draftKey ? (JSON.parse(draftKey) as ReturnDraft) : null;
  const quote = useQuery({ queryKey: ['returnQuote', draft], queryFn: () => api.returns.quote(draft!), enabled: draft !== null });
  const q: ReturnQuote | undefined = draft ? quote.data : undefined;
  const untouched = base.data?.lines.every((l) => l.returnedQtyMilli === 0) ?? false;

  async function run(action: () => Promise<CompleteReturnResult>) {
    setBusy(true);
    setError(null);
    try { onDone(await action()); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const complete = () => q && run(() => api.returns.complete({
    saleId, lines: parsed!.lines, commandId, reason: reason.trim(), expectedTotalPaise: q.totalPaise, refundMethod: q.refundMethod, refundPaise: q.refundPaise,
  }));
  const cancelBill = () => run(() => api.sales.cancel({ saleId, reason: reason.trim(), commandId, ...(method && { refundMethod: method }) }));

  return (
    <Dialog title={`Return against ${base.data?.saleDocNumber ?? '…'}`} onClose={onClose} wide>
      {base.error && <p className="err" role="alert">{errorMessage(base.error)}</p>}
      {base.data && inputs && (
        <div className="space-y-4">
          {base.data.customerName && <p className="text-sm text-muted-foreground">Customer: {base.data.customerName}</p>}
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="p-1">Item</th><th className="p-1 text-right">Sold</th><th className="p-1 text-right">Returned</th><th className="p-1 text-right">Return now</th><th className="p-1 text-right">Amount</th></tr></thead>
            <tbody>
              {base.data.lines.map((l) => (
                <tr key={l.lineNo} className="border-t border-border">
                  <td className="p-1">{l.name}</td>
                  <td className="p-1 text-right tabular-nums">{l.soldQtyMilli / 1000} {l.uomCode}</td>
                  <td className="p-1 text-right tabular-nums">{l.returnedQtyMilli / 1000}</td>
                  <td className="p-1 text-right">
                    <input aria-label={`Return quantity of ${l.name}`} className="input w-24 text-right" disabled={l.returnableQtyMilli === 0} value={inputs[l.lineNo] ?? ''}
                      onChange={(e) => setInputs({ ...inputs, [l.lineNo]: e.target.value })} />
                    {parsed?.errors[l.lineNo] && <div className="err text-xs">{parsed.errors[l.lineNo]}</div>}
                  </td>
                  <td className="p-1 text-right tabular-nums">{formatPaise(q?.lines.find((x) => x.lineNo === l.lineNo)?.totalPaise ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="rt-method">Refund by</label>
              <select id="rt-method" className="input" value={method ?? q?.refundMethod ?? base.data.refundMethod} onChange={(e) => setMethod(e.target.value as RefundMethod)}>
                {base.data.refundMethods.map((m) => <option key={m} value={m}>{REFUND_LABELS[m]}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="rt-reason">Reason</label><input id="rt-reason" className="input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></div>
          </div>
          {q && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt>Taxable value</dt><dd className="text-right tabular-nums">{formatPaise(q.taxablePaise)}</dd>
              <dt>GST</dt><dd className="text-right tabular-nums">{formatPaise(q.cgstPaise + q.sgstPaise + q.igstPaise + q.cessPaise)}</dd>
              {q.roundOffPaise !== 0 && <><dt>Round off</dt><dd className="text-right tabular-nums">{formatPaise(q.roundOffPaise)}</dd></>}
              <dt className="font-semibold">Credit note total</dt><dd className="text-right font-semibold tabular-nums">{formatPaise(q.totalPaise)}</dd>
              {q.creditPaise > 0 && <><dt>Off what the customer owes</dt><dd className="text-right tabular-nums">{formatPaise(q.creditPaise)}</dd></>}
              {q.refundPaise > 0 && <><dt>Refund by {REFUND_LABELS[q.refundMethod]}</dt><dd className="text-right tabular-nums">{formatPaise(q.refundPaise)}</dd></>}
            </dl>
          )}
          {q?.issues.map((i) => <p key={`${i.lineNo}-${i.message}`} className="err text-sm">{i.message}</p>)}
          {error && <p className="err" role="alert">{error}</p>}
          <div className="flex justify-between gap-3">
            {canCancel && untouched
              ? <HoldToDelete label="Hold to cancel whole bill" disabled={busy || reason.trim() === ''} onConfirm={() => void cancelBill()} />
              : <span />}
            {canReturn && (
              <button type="button" className="btn-primary" disabled={busy || !q || q.issues.length > 0 || q.totalPaise <= 0 || reason.trim() === '' || Object.keys(parsed?.errors ?? {}).length > 0}
                onClick={() => void complete()}>Issue credit note</button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
