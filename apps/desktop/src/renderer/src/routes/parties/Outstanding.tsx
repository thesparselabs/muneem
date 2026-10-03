import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PartyType } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { AGEING_COLUMNS } from '../../lib/parties/forms.js';
import { useCan } from '../../lib/permissions.js';

export default function Outstanding() {
  const canSuppliers = useCan('suppliers.view');
  const [tab, setTab] = useState<PartyType>('customer');
  const [asOf, setAsOf] = useState(new Date().toLocaleDateString('en-CA'));
  const report = useQuery({
    queryKey: ['outstanding', tab, 'all', asOf],
    queryFn: () => (tab === 'customer' ? api.customers.getOutstanding({ asOf }) : api.suppliers.getOutstanding({ asOf })),
  });
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Outstanding</h1><Link to="/parties" className="btn-secondary">Parties</Link></div>
      <div className="flex items-end gap-3">
        <div className="flex gap-1" role="tablist">
          {(['customer', 'supplier'] as const).filter((t) => t === 'customer' || canSuppliers).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`btn-secondary py-1 ${tab === t ? 'bg-slate-200' : ''}`} onClick={() => setTab(t)}>{t === 'customer' ? 'Receivables' : 'Payables'}</button>
          ))}
        </div>
        <div><label className="label" htmlFor="os-asof">As of</label><input id="os-asof" type="date" className="input" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
      </div>
      {report.error && <p className="err" role="alert">{errorMessage(report.error)}</p>}
      <table className="w-full rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">{tab === 'customer' ? 'Customer' : 'Supplier'}</th>{AGEING_COLUMNS.map(([k, l]) => <th key={k} className="p-2 text-right">{l}</th>)}</tr></thead>
        <tbody>
          {report.data?.rows.map((r) => (
            <tr key={r.partyId} className="border-t">
              <td className="p-2"><Link to={`/parties/${tab}/${r.partyId}`} className="text-blue-800">{r.name}</Link></td>
              {AGEING_COLUMNS.map(([k]) => <td key={k} className="p-2 text-right tabular-nums">{formatPaise(r[k])}</td>)}
            </tr>
          ))}
          {report.data && <tr className="border-t font-semibold"><td className="p-2">Total</td>{AGEING_COLUMNS.map(([k]) => <td key={k} className="p-2 text-right tabular-nums">{formatPaise(report.data.totals[k])}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}
