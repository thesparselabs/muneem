import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useUi } from '../store.js';

export default function Home() {
  const { session, sync } = useUi();
  const device = useQuery({ queryKey: ['device'], queryFn: () => api.device.getInfo({}) });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Welcome, {session?.user.name}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-slate-500">Branches</p><p className="text-2xl font-semibold">{branches.data?.length ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Waiting to sync</p><p className="text-2xl font-semibold">{sync?.pending ?? '…'}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Device</p><p className="text-sm font-mono break-all">{device.data?.registered ? device.data.deviceId : 'not registered yet'}</p></div>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Catalog stage</h2>
        <p className="text-sm text-slate-700">Add products one by one or import them from a CSV or Excel file, with barcodes, units, GST and price lists. Billing and inventory arrive in the next stages.</p>
      </div>
    </div>
  );
}
