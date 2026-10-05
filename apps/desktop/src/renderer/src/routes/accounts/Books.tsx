import { useState, type FormEvent } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { monthStart } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import Dialog from '../../components/Dialog.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import AccountsNav from './AccountsNav.js';
import LedgerView from './LedgerView.js';
import { BookMarked, Undo2 } from 'lucide-react';

const today = () => new Date().toLocaleDateString('en-CA');

export default function Books() {
  const [tab, setTab] = useState<'cash' | 'bank' | 'day'>('cash');
  const [range, setRange] = useState({ from: monthStart(today()), to: today() });
  const [bankId, setBankId] = useState('');
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounting.listAccounts({}) });
  const banks = (accounts.data ?? []).filter((a) => a.type === 'asset' && !a.isGroup && (a.role === 'bank' || !a.isSystem));
  const book = useInfiniteQuery({
    queryKey: ['book', tab, range, bankId],
    queryFn: ({ pageParam }) => {
      const q = { ...range, limit: 100, ...(pageParam && { cursor: pageParam }) };
      return tab === 'cash' ? api.accounting.getCashBook(q) : api.accounting.getBankBook({ ...q, ...(bankId && { accountId: bankId }) });
    },
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined, enabled: tab !== 'day',
  });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><BookMarked size={22} className="text-primary" aria-hidden />Books</h1>
      <AccountsNav />
      <div className="flex gap-1" role="tablist">
        {([['cash', 'Cash book'], ['bank', 'Bank book'], ['day', 'Day book']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`btn-secondary py-1 ${tab === k ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="card flex items-end gap-3">
        <div><label className="label" htmlFor="bk-from">From</label><DatePicker id="bk-from" value={range.from} onChange={(v) => setRange({ ...range, from: v })} /></div>
        <div><label className="label" htmlFor="bk-to">To</label><DatePicker id="bk-to" value={range.to} onChange={(v) => setRange({ ...range, to: v })} /></div>
        {tab === 'bank' && banks.length > 1 && (
          <div><label className="label" htmlFor="bk-bank">Bank account</label>
            <select id="bk-bank" className="select" value={bankId} onChange={(e) => setBankId(e.target.value)}>{banks.map((b) => <option key={b.id} value={b.role === 'bank' ? '' : b.id}>{b.code} {b.name}</option>)}</select></div>
        )}
      </div>
      {book.error && <p className="err" role="alert">{errorMessage(book.error)}</p>}
      {tab === 'day' ? <DayBook from={range.from} to={range.to} />
        : <LedgerView pages={book.data?.pages ?? []} from={range.from} more={!!book.hasNextPage} onMore={() => void book.fetchNextPage()} />}
    </div>
  );
}

function DayBook({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const canReverse = useCan('accounting.create');
  const [reversing, setReversing] = useState<string | null>(null);
  const book = useInfiniteQuery({
    queryKey: ['daybook', from, to],
    queryFn: ({ pageParam }) => api.accounting.getDayBook({ from, to, limit: 50, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  return (
    <div className="space-y-3">
      {book.error && <p className="err" role="alert">{errorMessage(book.error)}</p>}
      {(book.data?.pages ?? []).flatMap((p) => p.items).map((e) => (
        <div key={e.id} className="card text-sm">
          <div className="flex items-center justify-between">
            <p><span className="font-mono">{e.entryNo}</span> · {e.date} · {e.source}{e.narration && ` · ${e.narration}`}
              {e.latePosting && <span className="ml-2 rounded bg-amber-100 dark:bg-amber-500/20 px-1 text-xs text-amber-800 dark:text-amber-300">late, dated {e.docDate}</span>}
              {e.reversalOf && <span className="ml-2 rounded bg-muted px-1 text-xs">reversal</span>}</p>
            {canReverse && e.source === 'manual' && !e.reversalOf && !e.reversedBy && <button type="button" className="btn-secondary py-0" onClick={() => setReversing(e.id)}>Reverse</button>}
          </div>
          <table className="mt-1 w-full"><tbody>
            {e.lines.map((l, i) => <tr key={i}><td className={`p-0.5 ${l.creditPaise ? 'pl-8' : ''}`}><span className="font-mono text-xs text-muted-foreground">{l.code}</span> {l.name}</td>
              <td className="p-0.5 text-right tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise) : ''}</td><td className="p-0.5 text-right tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise) : ''}</td></tr>)}
          </tbody></table>
        </div>
      ))}
      {book.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void book.fetchNextPage()}>Show more</button>}
      {reversing && <ReverseDialog id={reversing} onClose={() => setReversing(null)} onDone={() => { setReversing(null); void qc.invalidateQueries(); }} />}
    </div>
  );
}

function ReverseDialog({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.accounting.reverseJournal({ id, reason }); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title="Reverse journal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="rv-reason">Reason</label><input id="rv-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary"><Undo2 size={16} aria-hidden />Reverse</button>
      </form>
    </Dialog>
  );
}
