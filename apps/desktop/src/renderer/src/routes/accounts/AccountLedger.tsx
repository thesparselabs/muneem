import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import AccountsNav from './AccountsNav.js';
import LedgerView from './LedgerView.js';
import { BookOpen } from 'lucide-react';

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
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen size={22} className="text-primary" aria-hidden />{account.data ? `${account.data.code} ${account.data.name}` : 'Ledger'}</h1>
      <AccountsNav />
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="lg-from">From</label><DatePicker id="lg-from" value={range.from} onChange={(v) => setRange({ ...range, from: v })} /></div>
        <div><label className="label" htmlFor="lg-to">To</label><DatePicker id="lg-to" value={range.to} onChange={(v) => setRange({ ...range, to: v })} /></div>
      </div>
      {ledger.error && <p className="err" role="alert">{errorMessage(ledger.error)}</p>}
      <LedgerView pages={ledger.data?.pages ?? []} from={range.from} more={!!ledger.hasNextPage} onMore={() => void ledger.fetchNextPage()} />
    </div>
  );
}
