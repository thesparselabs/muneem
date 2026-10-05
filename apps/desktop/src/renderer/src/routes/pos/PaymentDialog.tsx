import { useState, type FormEvent } from 'react';
import { TENDER_METHODS, type SaleQuote, type TenderLine } from '@muneem/contracts';
import Dialog from '../../components/Dialog.js';
import ShimmerButton from '../../components/ShimmerButton.js';
import { formatPaise, paiseToText } from '../../lib/money.js';
import { previewSettlement, rowsToTenders, type TenderRow } from '../../lib/pos/payment.js';

const LABEL: Record<TenderLine['method'], string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other', credit: 'Credit' };

// The credit row is offered only with a customer on the bill (credit = the quote's credit info); the server still checks the limit.
export default function PaymentDialog({ totalPaise, credit, busy, warning, onPay, onClose }: {
  totalPaise: number; credit: SaleQuote['credit'] | null; busy: boolean; warning: string | null; onPay: (tenders: TenderLine[]) => void; onClose: () => void;
}) {
  const methods = TENDER_METHODS.filter((m) => m !== 'credit' || credit);
  const [rows, setRows] = useState<TenderRow[]>(methods.map((m) => ({ method: m, amount: m === 'cash' ? paiseToText(totalPaise) : '', reference: '' })));
  const preview = previewSettlement(totalPaise, rows);
  const set = (i: number, patch: Partial<TenderRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = rowsToTenders(rows);
    if (parsed.ok && preview.ok) onPay(parsed.tenders);
  }
  const status = preview.ok
    ? preview.changePaise > 0 ? `Change to give: ${formatPaise(preview.changePaise)}` : 'Paid in full'
    : preview.reason === 'short' ? `${formatPaise(preview.shortByPaise)} still to pay`
      : preview.reason === 'non_cash_over_total' ? 'Card, UPI, credit and other cannot be more than the bill; only cash gives change'
        : preview.reason === 'invalid' ? preview.error : 'Every amount must be more than zero';
  return (
    <Dialog title={`Payment (F5) · ${formatPaise(totalPaise)}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.method} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
            <label htmlFor={`tender-${r.method}`} className="text-sm font-medium">{LABEL[r.method]}</label>
            <input id={`tender-${r.method}`} className="input" inputMode="decimal" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
            {r.method === 'credit' && credit && <span className="text-sm text-muted-foreground">Available {formatPaise(credit.availablePaise)}</span>}
            {r.method !== 'cash' && r.method !== 'credit' && <input aria-label={`${LABEL[r.method]} reference`} className="input" placeholder="Reference (optional)" value={r.reference} onChange={(e) => set(i, { reference: e.target.value })} />}
          </div>
        ))}
        <p className={`text-sm font-medium ${preview.ok ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-300'}`} role="status">{status}</p>
        {warning && <p className="text-sm text-amber-800 dark:text-amber-300" role="alert">{warning}</p>}
        <ShimmerButton type="submit" className="w-full" disabled={busy || !preview.ok}>{busy ? 'Saving…' : 'Complete sale (Enter)'}</ShimmerButton>
      </form>
    </Dialog>
  );
}
