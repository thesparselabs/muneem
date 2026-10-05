import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PartyType } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import { formatPaise } from '../../lib/money.js';
import { AGEING_COLUMNS } from '../../lib/parties/forms.js';
import { useCan } from '../../lib/permissions.js';
import { Scale, ArrowLeft } from 'lucide-react';

export default function Outstanding() {
  const canSuppliers = useCan('suppliers.view');
  const [tab, setTab] = useState<PartyType>('customer');
  const [asOf, setAsOf] = useState(new Date().toLocaleDateString('en-CA'));
  const report = useQuery({
    queryKey: ['outstanding', tab, 'all', asOf],
    queryFn: () => (tab === 'customer' ? api.customers.getOutstanding({ asOf }) : api.suppliers.getOutstanding({ asOf })),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-semibold"><Scale size={22} className="text-primary" aria-hidden />Outstanding</h1><Link to="/parties" className="btn-secondary"><ArrowLeft size={16} aria-hidden />Parties</Link></div>
      <div className="flex items-end gap-3">
        <div className="flex gap-1" role="tablist">
          {(['customer', 'supplier'] as const).filter((t) => t === 'customer' || canSuppliers).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`btn-secondary py-1 ${tab === t ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setTab(t)}>{t === 'customer' ? 'Receivables' : 'Payables'}</button>
          ))}
        </div>
        <div><label className="label" htmlFor="os-asof">As of</label><DatePicker id="os-asof" value={asOf} onChange={(v) => setAsOf(v)} /></div>
      </div>
      {report.error && <p className="err" role="alert">{errorMessage(report.error)}</p>}
      <table className="table-modern rounded-lg border border-border bg-card">
        <thead><tr><th>{tab === 'customer' ? 'Customer' : 'Supplier'}</th>{AGEING_COLUMNS.map(([k, l]) => <th key={k} className="text-right">{l}</th>)}</tr></thead>
        <tbody>
          {report.data?.rows.map((r) => (
            <tr key={r.partyId}>
              <td><Link to={`/parties/${tab}/${r.partyId}`} className="text-primary">{r.name}</Link></td>
              {AGEING_COLUMNS.map(([k]) => <td key={k} className="text-right tabular-nums">{formatPaise(r[k])}</td>)}
            </tr>
          ))}
          {report.data && <tr className="font-semibold"><td>Total</td>{AGEING_COLUMNS.map(([k]) => <td key={k} className="text-right tabular-nums">{formatPaise(report.data.totals[k])}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}
