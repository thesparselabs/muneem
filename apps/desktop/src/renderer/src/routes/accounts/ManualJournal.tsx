import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import { checkJournal, emptyRows, postableAccounts, toJournalInput, type JournalRow } from '../../lib/accounting/journalForm.js';
import { formatPaise } from '../../lib/money.js';
import AccountsNav from './AccountsNav.js';
import { PenLine, Check } from 'lucide-react';

export default function ManualJournal() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounting.listAccounts({}) });
  const options = postableAccounts(accounts.data ?? []);
  const [rows, setRows] = useState<JournalRow[]>(emptyRows());
  const [narration, setNarration] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [error, setError] = useState<string | null>(null);
  const [commandId] = useState(newUlid);
  const check = checkJournal(rows, narration);
  const set = (i: number, patch: Partial<JournalRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.accounting.postManualJournal(toJournalInput(rows, narration, date, commandId));
      await qc.invalidateQueries();
      nav('/accounts/books');
    } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <form onSubmit={submit} className="max-w-6xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><PenLine size={22} className="text-primary" aria-hidden />Manual journal</h1>
      <AccountsNav />
      <p className="text-sm text-muted-foreground">Receivables, payables, inventory and GST accounts change only through their documents, so they are not offered here.</p>
      <div className="card grid grid-cols-[160px_1fr] gap-3">
        <div><label className="label" htmlFor="mj-date">Date</label><DatePicker id="mj-date" value={date} onChange={(v) => setDate(v)} /></div>
        <div><label className="label" htmlFor="mj-narr">Narration</label><input id="mj-narr" className="input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Card settlement for 3 Oct" /></div>
      </div>
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>Account</th><th>Debit (₹)</th><th>Credit (₹)</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><select aria-label={`Account, line ${i + 1}`} className="select py-1" value={r.accountId} onChange={(e) => set(i, { accountId: e.target.value })}>
                <option value="">Choose…</option>{options.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select>
                {check.errors[`${i}.accountId`] && <p className="text-xs text-destructive">{check.errors[`${i}.accountId`]}</p>}</td>
              <td><input aria-label={`Debit, line ${i + 1}`} className="input w-32 py-1" inputMode="decimal" value={r.debit} onChange={(e) => set(i, { debit: e.target.value })} /></td>
              <td><input aria-label={`Credit, line ${i + 1}`} className="input w-32 py-1" inputMode="decimal" value={r.credit} onChange={(e) => set(i, { credit: e.target.value })} />
                {check.errors[`${i}`] && <p className="text-xs text-destructive">{check.errors[`${i}`]}</p>}</td>
              <td>{rows.length > 2 && <button type="button" className="btn-secondary py-0" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}</td>
            </tr>
          ))}
          <tr className="font-medium"><td>Totals</td><td className="tabular-nums">{formatPaise(check.debitPaise)}</td><td className="tabular-nums">{formatPaise(check.creditPaise)}</td><td /></tr>
        </tbody>
      </table>
      <div className="flex items-center gap-4">
        <button type="button" className="btn-secondary" onClick={() => setRows([...rows, { accountId: '', debit: '', credit: '' }])}>Add line</button>
        <p role="status" className={check.differencePaise === 0 ? 'text-green-800 dark:text-green-400' : 'text-destructive'}>{check.differencePaise === 0 ? 'Balanced' : `Difference ${formatPaise(Math.abs(check.differencePaise))}`}</p>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={!check.ready}><Check size={16} aria-hidden />Post journal</button>
    </form>
  );
}
