import type { AccountLedgerPage } from '@muneem/contracts';
import { Link } from 'react-router-dom';
import { formatPaise } from '../../lib/money.js';

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
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Date</th><th className="p-2">Entry</th><th className="p-2">Source</th><th className="p-2">Narration</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Balance</th></tr></thead>
        <tbody>
          {first && from && <tr className="border-t text-slate-600"><td className="p-2" colSpan={6}>Opening balance</td><td className="p-2 text-right tabular-nums">{formatPaise(first.openingBalancePaise)}</td></tr>}
          {lines.map((l) => {
            const link = l.refType && l.refId ? DOC_LINK[l.refType]?.(l.refId) : '';
            return (
              <tr key={`${l.entryId}-${l.debitPaise}-${l.creditPaise}-${l.balancePaise}`} className="border-t">
                <td className="p-2">{l.date}</td>
                <td className="p-2 font-mono text-xs">{link ? <Link to={link} className="text-blue-800">{l.entryNo}</Link> : l.entryNo}</td>
                <td className="p-2">{SOURCE[l.source] ?? l.source}</td><td className="p-2">{l.narration ?? ''}</td>
                <td className="p-2 text-right tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise) : ''}</td>
                <td className="p-2 text-right tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise) : ''}</td>
                <td className="p-2 text-right tabular-nums">{formatPaise(l.balancePaise)}</td>
              </tr>
            );
          })}
          {last && !more && <tr className="border-t font-medium"><td className="p-2" colSpan={6}>Closing balance (debit positive)</td><td className="p-2 text-right tabular-nums">{formatPaise(last.closingBalancePaise)}</td></tr>}
        </tbody>
      </table>
      {more && <button type="button" className="btn-secondary" onClick={onMore}>Show more</button>}
    </>
  );
}
