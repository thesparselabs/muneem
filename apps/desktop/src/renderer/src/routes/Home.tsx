import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatPaise, scaledToText } from '../lib/money.js';
import { overdueOver30 } from '../lib/parties/forms.js';
import { useCan } from '../lib/permissions.js';
import { api } from '../api.js';
import { useUi } from '../store.js';

export default function Home() {
  const { session, sync } = useUi();
  const device = useQuery({ queryKey: ['device'], queryFn: () => api.device.getInfo({}) });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  const lowStock = useQuery({ queryKey: ['lowStock'], queryFn: () => api.inventory.listLowStock({}), retry: false });
  const canCustomers = useCan('customers.view');
  const canSuppliers = useCan('suppliers.view');
  const receivables = useQuery({ queryKey: ['outstanding', 'customer'], queryFn: () => api.customers.getOutstanding({}), enabled: canCustomers, retry: false });
  const payables = useQuery({ queryKey: ['outstanding', 'supplier'], queryFn: () => api.suppliers.getOutstanding({}), enabled: canSuppliers, retry: false });
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Welcome, {session?.user.name}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-slate-500">Branches</p><p className="text-2xl font-semibold">{branches.data?.length ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Waiting to sync</p><p className="text-2xl font-semibold">{sync?.pending ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Device</p><p className="text-sm font-mono break-all">{device.data?.registered ? device.data.deviceId : 'not registered yet'}</p></div>
      </div>
      {(receivables.data || payables.data) && (
        <div className="grid grid-cols-2 gap-4">
          {receivables.data && (
            <Link to="/parties/outstanding" className="card block">
              <p className="text-xs text-slate-500">Customers owe</p><p className="text-2xl font-semibold">{formatPaise(receivables.data.totals.netPaise)}</p>
              <p className="text-sm text-amber-800">{formatPaise(overdueOver30(receivables.data.totals))} over 30 days</p>
            </Link>
          )}
          {payables.data && (
            <Link to="/parties/outstanding" className="card block">
              <p className="text-xs text-slate-500">We owe suppliers</p><p className="text-2xl font-semibold">{formatPaise(payables.data.totals.netPaise)}</p>
              <p className="text-sm text-amber-800">{formatPaise(payables.data.totals.days0to30Paise + overdueOver30(payables.data.totals))} overdue</p>
            </Link>
          )}
        </div>
      )}
      {lowStock.data && lowStock.data.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Low stock <span className="text-sm font-normal text-slate-500">({lowStock.data.length})</span></h2>
          <ul className="text-sm">
            {lowStock.data.slice(0, 8).map((r) => <li key={r.productId}><Link to={`/inventory/product/${r.productId}`} className="text-blue-800">{r.name}</Link> — {scaledToText(r.qtyMilli, 3)} {r.uomCode} left</li>)}
          </ul>
        </div>
      )}
      <div className="card">
        <h2 className="font-semibold mb-2">New in Stage 5</h2>
        <p className="text-sm text-slate-700">Customers and suppliers with their ledgers and opening balances, payments that settle bills oldest first, credit sales at the POS within each customer's limit, purchases and expenses. Accounts arrive in Stage 6.</p>
      </div>
    </div>
  );
}
