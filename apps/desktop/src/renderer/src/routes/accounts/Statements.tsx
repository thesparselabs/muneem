import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fyStartOf } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import { balanceSheetSides, profitAndLossSections, type Section } from '../../lib/accounting/statementLayout.js';
import { formatPaise } from '../../lib/money.js';
import AccountsNav from './AccountsNav.js';

const today = () => new Date().toLocaleDateString('en-CA');

function Badge({ ok }: { ok: boolean }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ok ? 'Balanced' : 'Not balanced'}</span>;
}

function SectionTable({ s }: { s: Section }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><th className="p-1 text-left" colSpan={2}>{s.title}</th></tr></thead>
      <tbody>
        {s.lines.map((l) => <tr key={`${l.code}-${l.name}`}><td className="p-1 pl-4">{l.code && <span className="font-mono text-xs text-slate-500">{l.code} </span>}{l.name}</td><td className="p-1 text-right tabular-nums">{formatPaise(l.amountPaise)}</td></tr>)}
        <tr className="border-t font-medium"><td className="p-1">{s.totalLabel}</td><td className="p-1 text-right tabular-nums">{formatPaise(s.totalPaise)}</td></tr>
      </tbody>
    </table>
  );
}

export default function Statements() {
  const [tab, setTab] = useState<'tb' | 'pl' | 'bs'>('tb');
  const [asOf, setAsOf] = useState(today());
  const [range, setRange] = useState({ from: fyStartOf(today()), to: today() });
  const [branchId, setBranchId] = useState('');
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  const branch = branchId ? { branchId } : {};
  const tb = useQuery({ queryKey: ['tb', asOf, branchId], queryFn: () => api.accounting.getTrialBalance({ asOf, ...branch }), enabled: tab === 'tb' });
  const pl = useQuery({ queryKey: ['pl', range, branchId], queryFn: () => api.accounting.getProfitAndLoss({ ...range, ...branch }), enabled: tab === 'pl' });
  const bs = useQuery({ queryKey: ['bs', asOf, branchId], queryFn: () => api.accounting.getBalanceSheet({ asOf, ...branch }), enabled: tab === 'bs' });
  const error = tb.error ?? pl.error ?? bs.error;
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">Statements</h1>
      <AccountsNav />
      <div className="flex gap-1" role="tablist">
        {([['tb', 'Trial Balance'], ['pl', 'Profit & Loss'], ['bs', 'Balance Sheet']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`btn-secondary py-1 ${tab === k ? 'bg-slate-200' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="card flex items-end gap-3">
        {tab === 'pl' ? <>
          <div><label className="label" htmlFor="st-from">From</label><input id="st-from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
          <div><label className="label" htmlFor="st-to">To</label><input id="st-to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        </> : <div><label className="label" htmlFor="st-asof">As at</label><input id="st-asof" type="date" className="input" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>}
        {(branches.data?.length ?? 0) > 1 && (
          <div><label className="label" htmlFor="st-branch">Branch</label>
            <select id="st-branch" className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">All branches</option>{branches.data!.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        )}
      </div>
      {error && <p className="err" role="alert">{errorMessage(error)}</p>}
      {tab === 'tb' && tb.data && (
        <div className="card space-y-2">
          <div className="flex justify-between"><h2 className="font-semibold">Trial Balance as at {tb.data.asOf}</h2><Badge ok={tb.data.balanced} /></div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600"><tr><th className="p-1">Code</th><th className="p-1">Account</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Credit</th></tr></thead>
            <tbody>
              {tb.data.rows.map((r) => <tr key={r.accountId} className="border-t"><td className="p-1 font-mono">{r.code}</td><td className="p-1">{r.name}</td><td className="p-1 text-right tabular-nums">{r.debitPaise ? formatPaise(r.debitPaise) : ''}</td><td className="p-1 text-right tabular-nums">{r.creditPaise ? formatPaise(r.creditPaise) : ''}</td></tr>)}
              <tr className="border-t font-semibold"><td className="p-1" colSpan={2}>Total</td><td className="p-1 text-right tabular-nums">{formatPaise(tb.data.debitPaise)}</td><td className="p-1 text-right tabular-nums">{formatPaise(tb.data.creditPaise)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {tab === 'pl' && pl.data && (() => {
        const l = profitAndLossSections(pl.data);
        return (
          <div className="card space-y-3">
            <h2 className="font-semibold">Profit & Loss, {pl.data.from} to {pl.data.to}</h2>
            <SectionTable s={l.sections[0]!} /><SectionTable s={l.sections[1]!} />
            <p className="flex justify-between font-semibold"><span>Gross profit</span><span className="tabular-nums">{formatPaise(l.grossProfitPaise)}</span></p>
            <SectionTable s={l.sections[2]!} /><SectionTable s={l.sections[3]!} />
            <p className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Net profit</span><span className="tabular-nums">{formatPaise(l.netProfitPaise)}</span></p>
          </div>
        );
      })()}
      {tab === 'bs' && bs.data && (() => {
        const s = balanceSheetSides(bs.data);
        return (
          <div className="card space-y-3">
            <div className="flex justify-between"><h2 className="font-semibold">Balance Sheet as at {bs.data.asOf}</h2><Badge ok={bs.data.balanced} /></div>
            <div className="grid grid-cols-2 gap-6">
              <div>{s.left.map((x) => <SectionTable key={x.title} s={x} />)}</div>
              <div>{s.right.map((x) => <SectionTable key={x.title} s={x} />)}
                <p className="flex justify-between border-t pt-1 font-semibold"><span>Total liabilities and equity</span><span className="tabular-nums">{formatPaise(bs.data.totalLiabilitiesAndEquityPaise)}</span></p></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
