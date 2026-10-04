import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import { checkJournal, emptyRows, postableAccounts, toJournalInput, type JournalRow } from '../../lib/accounting/journalForm.js';
import { formatPaise } from '../../lib/money.js';
import AccountsNav from './AccountsNav.js';

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
    <form onSubmit={submit} className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold">Manual journal</h1>
      <AccountsNav />
      <p className="text-sm text-slate-600">Receivables, payables, inventory and GST accounts change only through their documents, so they are not offered here.</p>
      <div className="card grid grid-cols-[160px_1fr] gap-3">
        <div><label className="label" htmlFor="mj-date">Date</label><input id="mj-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label" htmlFor="mj-narr">Narration</label><input id="mj-narr" className="input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Card settlement for 3 Oct" /></div>
      </div>
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Account</th><th className="p-2">Debit (₹)</th><th className="p-2">Credit (₹)</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2"><select aria-label={`Account, line ${i + 1}`} className="input py-1" value={r.accountId} onChange={(e) => set(i, { accountId: e.target.value })}>
                <option value="">Choose…</option>{options.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select>
                {check.errors[`${i}.accountId`] && <p className="text-xs text-red-700">{check.errors[`${i}.accountId`]}</p>}</td>
              <td className="p-2"><input aria-label={`Debit, line ${i + 1}`} className="input w-32 py-1" inputMode="decimal" value={r.debit} onChange={(e) => set(i, { debit: e.target.value })} /></td>
              <td className="p-2"><input aria-label={`Credit, line ${i + 1}`} className="input w-32 py-1" inputMode="decimal" value={r.credit} onChange={(e) => set(i, { credit: e.target.value })} />
                {check.errors[`${i}`] && <p className="text-xs text-red-700">{check.errors[`${i}`]}</p>}</td>
              <td className="p-2">{rows.length > 2 && <button type="button" className="btn-secondary py-0" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}</td>
            </tr>
          ))}
          <tr className="border-t font-medium"><td className="p-2">Totals</td><td className="p-2 tabular-nums">{formatPaise(check.debitPaise)}</td><td className="p-2 tabular-nums">{formatPaise(check.creditPaise)}</td><td /></tr>
        </tbody>
      </table>
      <div className="flex items-center gap-4">
        <button type="button" className="btn-secondary" onClick={() => setRows([...rows, { accountId: '', debit: '', credit: '' }])}>Add line</button>
        <p role="status" className={check.differencePaise === 0 ? 'text-green-800' : 'text-red-700'}>{check.differencePaise === 0 ? 'Balanced' : `Difference ${formatPaise(Math.abs(check.differencePaise))}`}</p>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={!check.ready}>Post journal</button>
    </form>
  );
}
