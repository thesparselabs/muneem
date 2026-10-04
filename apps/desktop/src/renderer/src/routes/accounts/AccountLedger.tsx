import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import AccountsNav from './AccountsNav.js';
import LedgerView from './LedgerView.js';

export default function AccountLedger() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState({ from: '', to: '' });
  const account = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounting.listAccounts({}), select: (xs) => xs.find((a) => a.id === id) });
  const ledger = useInfiniteQuery({
    queryKey: ['ledger', id, range],
    queryFn: ({ pageParam }) => api.accounting.getLedger({ accountId: id!, limit: 100, ...(range.from && { from: range.from }), ...(range.to && { to: range.to }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">{account.data ? `${account.data.code} ${account.data.name}` : 'Ledger'}</h1>
      <AccountsNav />
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="lg-from">From</label><input id="lg-from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="lg-to">To</label><input id="lg-to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>
      {ledger.error && <p className="err" role="alert">{errorMessage(ledger.error)}</p>}
      <LedgerView pages={ledger.data?.pages ?? []} from={range.from} more={!!ledger.hasNextPage} onMore={() => void ledger.fetchNextPage()} />
    </div>
  );
}
