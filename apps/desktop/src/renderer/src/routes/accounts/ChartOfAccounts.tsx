import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountView } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import Dialog from '../../components/Dialog.js';
import { chartTree, normalBalance } from '../../lib/accounting/chartTree.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import AccountsNav from './AccountsNav.js';
import ExportMenu from '../../components/ExportMenu.js';
import { ListTree, Plus, Save, Pencil } from 'lucide-react';

export default function ChartOfAccounts() {
  const qc = useQueryClient();
  const canManage = useCan('accounting.manage');
  const [asOf, setAsOf] = useState(new Date().toLocaleDateString('en-CA'));
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<AccountView | null>(null);
  const accounts = useQuery({ queryKey: ['accounts', asOf], queryFn: () => api.accounting.listAccounts({ asOf }) });
  const groups = chartTree(accounts.data ?? []);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><ListTree size={22} className="text-primary" aria-hidden />Accounts</h1><div className="flex gap-2"><ExportMenu reportId="accounting.chartOfAccounts" />{canManage && <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden />Add account</button>}</div></div>
      <AccountsNav />
      <div className="card"><label className="label" htmlFor="coa-asof">Balances as of</label><DatePicker id="coa-asof" className="w-48" value={asOf} onChange={(v) => setAsOf(v)} /></div>
      {accounts.error && <p className="err" role="alert">{errorMessage(accounts.error)}</p>}
      {groups.map((g) => (
        <table key={g.group.id} className="table-modern rounded-lg border border-border bg-card">
          <thead><tr><th className="w-20">{g.group.code}</th><th>{g.group.name}</th><th className="text-right">{formatPaise(g.totalPaise)}</th><th className="w-24" /></tr></thead>
          <tbody>
            {g.accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-mono">{a.code}</td>
                <td><Link to={`/accounts/ledger/${a.id}`} className="text-primary">{a.name}</Link>{!a.isSystem && <span className="text-xs text-muted-foreground"> (added)</span>}</td>
                <td className="text-right tabular-nums">{formatPaise(normalBalance(a))}</td>
                <td>{canManage && <button type="button" className="btn-secondary px-2 py-1" onClick={() => setRenaming(a)} aria-label="Rename" title="Rename"><Pencil size={14} aria-hidden /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {adding && <AddAccount groups={groups.map((g) => g.group)} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void qc.invalidateQueries({ queryKey: ['accounts'] }); }} />}
      {renaming && <RenameAccount account={renaming} onClose={() => setRenaming(null)} onDone={() => { setRenaming(null); void qc.invalidateQueries({ queryKey: ['accounts'] }); }} />}
    </div>
  );
}

function AddAccount({ groups, onClose, onDone }: { groups: AccountView[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ parentCode: groups[0]?.code ?? '', code: '', name: '' });
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.accounting.createAccount(f); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title="Add account" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="aa-group">Group</label><select id="aa-group" className="select" value={f.parentCode} onChange={(e) => setF({ ...f, parentCode: e.target.value })}>{groups.map((g) => <option key={g.id} value={g.code}>{g.code} {g.name}</option>)}</select></div>
        <div><label className="label" htmlFor="aa-code">Code</label><input id="aa-code" className="input" inputMode="numeric" maxLength={4} placeholder={`${f.parentCode[0] ?? ''}xxx`} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
        <div><label className="label" htmlFor="aa-name">Name</label><input id="aa-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary"><Plus size={16} aria-hidden />Add account</button>
      </form>
    </Dialog>
  );
}

function RenameAccount({ account, onClose, onDone }: { account: AccountView; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(account.name);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.accounting.updateAccount({ id: account.id, name }); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title={`Rename ${account.code}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="ra-name">Name</label><input id="ra-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save</button>
      </form>
    </Dialog>
  );
}
