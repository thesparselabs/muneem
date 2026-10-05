import type { AccountLedgerPage } from '@muneem/contracts';
import { Link } from 'react-router-dom';
import { formatPaise } from '../../lib/money.js';
import { ChevronDown } from 'lucide-react';

const DOC_LINK: Record<string, (id: string) => string> = {
  purchase: (id) => `/purchases/${id}`, payment: (id) => `/payments/${id}`,
};
const SOURCE: Record<string, string> = {
  sale: 'Sale', sale_return: 'Credit note', purchase: 'Purchase', purchase_return: 'Debit note', receipt: 'Receipt', payment: 'Payment', expense: 'Expense', write_off: 'Write-off',
  stock_adjustment: 'Stock', opening: 'Opening', register_close: 'Register', cash_movement: 'Cash in/out', manual: 'Journal',
};

// One account's lines with a running balance; shared by the ledger, the cash book and the bank book.
export default function LedgerView({ pages, from, more, onMore }: { pages: AccountLedgerPage[]; from: string; more: boolean; onMore: () => void }) {
  const first = pages[0];
  const last = pages.at(-1);
  const lines = pages.flatMap((p) => p.items);
  return (
    <>
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Date</th><th>Entry</th><th>Source</th><th>Narration</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
        <tbody>
          {first && from && <tr className="text-muted-foreground"><td colSpan={6}>Opening balance</td><td className="text-right tabular-nums">{formatPaise(first.openingBalancePaise)}</td></tr>}
          {lines.map((l) => {
            const link = l.refType && l.refId ? DOC_LINK[l.refType]?.(l.refId) : '';
            return (
              <tr key={`${l.entryId}-${l.debitPaise}-${l.creditPaise}-${l.balancePaise}`}>
                <td>{l.date}</td>
                <td className="font-mono text-xs">{link ? <Link to={link} className="text-primary">{l.entryNo}</Link> : l.entryNo}</td>
                <td>{SOURCE[l.source] ?? l.source}</td><td>{l.narration ?? ''}</td>
                <td className="text-right tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise) : ''}</td>
                <td className="text-right tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise) : ''}</td>
                <td className="text-right tabular-nums">{formatPaise(l.balancePaise)}</td>
              </tr>
            );
          })}
          {last && !more && <tr className="font-medium"><td colSpan={6}>Closing balance (debit positive)</td><td className="text-right tabular-nums">{formatPaise(last.closingBalancePaise)}</td></tr>}
        </tbody>
      </table>
      {more && <button type="button" className="btn-secondary" onClick={onMore}><ChevronDown size={16} aria-hidden />Show more</button>}
    </>
  );
}
