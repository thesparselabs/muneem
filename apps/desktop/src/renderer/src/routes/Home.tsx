import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { scaledToText } from '../lib/money.js';
import { api } from '../api.js';
import { useUi } from '../store.js';

export default function Home() {
  const { session, sync } = useUi();
  const device = useQuery({ queryKey: ['device'], queryFn: () => api.device.getInfo({}) });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  const lowStock = useQuery({ queryKey: ['lowStock'], queryFn: () => api.inventory.listLowStock({}), retry: false });
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Welcome, {session?.user.name}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-slate-500">Branches</p><p className="text-2xl font-semibold">{branches.data?.length ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Waiting to sync</p><p className="text-2xl font-semibold">{sync?.pending ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Device</p><p className="text-sm font-mono break-all">{device.data?.registered ? device.data.deviceId : 'not registered yet'}</p></div>
      </div>
      {lowStock.data && lowStock.data.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Low stock <span className="text-sm font-normal text-slate-500">({lowStock.data.length})</span></h2>
          <ul className="text-sm">
            {lowStock.data.slice(0, 8).map((r) => <li key={r.productId}><Link to={`/inventory/product/${r.productId}`} className="text-blue-800">{r.name}</Link> — {scaledToText(r.qtyMilli, 3)} {r.uomCode} left</li>)}
          </ul>
        </div>
      )}
      <div className="card">
        <h2 className="font-semibold mb-2">Inventory stage</h2>
        <p className="text-sm text-slate-700">Enter opening stock under Inventory, then every sale reduces it at average cost. Adjust stock, run a stock take, and check the stock ledger and valuation. Purchases and accounts arrive in the next stages.</p>
      </div>
    </div>
  );
}
