import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatPaise, scaledToText } from '../lib/money.js';
import { overdueOver30 } from '../lib/parties/forms.js';
import { useCan } from '../lib/permissions.js';
import { api } from '../api.js';
import { useUi } from '../store.js';
import { PackageMinus, HomeIcon } from 'lucide-react';
import Dashboard from './home/Dashboard.js';

export default function Home() {
  return useCan('reports.view') ? <Dashboard /> : <Welcome />;
}

// For users without reports (a cashier): the till's own status and what they may follow up.
function Welcome() {
  const { session, sync } = useUi();
  const device = useQuery({ queryKey: ['device'], queryFn: () => api.device.getInfo({}) });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  const lowStock = useQuery({ queryKey: ['lowStock'], queryFn: () => api.inventory.listLowStock({}), retry: false });
  const canCustomers = useCan('customers.view');
  const canSuppliers = useCan('suppliers.view');
  const receivables = useQuery({ queryKey: ['outstanding', 'customer'], queryFn: () => api.customers.getOutstanding({}), enabled: canCustomers, retry: false });
  const payables = useQuery({ queryKey: ['outstanding', 'supplier'], queryFn: () => api.suppliers.getOutstanding({}), enabled: canSuppliers, retry: false });
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><HomeIcon size={22} className="text-primary" aria-hidden />Welcome, {session?.user.name}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card"><p className="text-xs text-muted-foreground">Branches</p><p className="text-2xl font-semibold">{branches.data?.length ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-muted-foreground">Waiting to sync</p><p className="text-2xl font-semibold">{sync?.pending ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-muted-foreground">Device</p><p className="text-sm font-mono break-all">{device.data?.registered ? device.data.deviceId : 'not registered yet'}</p></div>
      </div>
      {(receivables.data || payables.data) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {receivables.data && (
            <Link to="/parties/outstanding" className="card block">
              <p className="text-xs text-muted-foreground">Customers owe</p><p className="text-2xl font-semibold">{formatPaise(receivables.data.totals.netPaise)}</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{formatPaise(overdueOver30(receivables.data.totals))} over 30 days</p>
            </Link>
          )}
          {payables.data && (
            <Link to="/parties/outstanding" className="card block">
              <p className="text-xs text-muted-foreground">We owe suppliers</p><p className="text-2xl font-semibold">{formatPaise(payables.data.totals.netPaise)}</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{formatPaise(payables.data.totals.days0to30Paise + overdueOver30(payables.data.totals))} overdue</p>
            </Link>
          )}
        </div>
      )}
      {lowStock.data && lowStock.data.length > 0 && (
        <div className="card">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><PackageMinus size={16} className="text-amber-700 dark:text-amber-300" aria-hidden /> Low stock <span className="text-sm font-normal text-muted-foreground">({lowStock.data.length})</span></h2>
          <ul className="text-sm">
            {lowStock.data.slice(0, 8).map((r) => <li key={r.productId}><Link to={`/inventory/product/${r.productId}`} className="text-primary">{r.name}</Link> — {scaledToText(r.qtyMilli, 3)} {r.uomCode} left</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
