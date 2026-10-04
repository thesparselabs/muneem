import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useUi } from '../store.js';
import SyncBadge from '../components/SyncBadge.js';
import type { Permission } from '@muneem/contracts';
import { can } from '../lib/permissions.js';

// `need` hides an item from users who could not use it; main still checks every call (5f details).
const NAV: { to: string; label: string; enabled: boolean; stage?: string; need?: Permission }[] = [
  { to: '/', label: 'Home', enabled: true },
  { to: '/pos', label: 'POS · Billing', enabled: true },
  { to: '/sales', label: 'Sales · Returns', enabled: true, need: 'sales.view' },
  { to: '/products', label: 'Products', enabled: true },
  { to: '/inventory', label: 'Inventory', enabled: true },
  { to: '/purchases', label: 'Purchases', enabled: true, need: 'purchases.view' },
  { to: '/parties', label: 'Parties', enabled: true, need: 'customers.view' },
  { to: '/payments', label: 'Payments', enabled: true, need: 'payments.view' },
  { to: '/expenses', label: 'Expenses', enabled: true, need: 'expenses.view' },
  { to: '/accounts', label: 'Accounts', enabled: true, need: 'accounting.view' },
  { to: '/reports', label: 'Reports', enabled: false, stage: 'Stage 8' },
  { to: '/settings/review', label: 'Review items', enabled: true, need: 'sync.view' },
  { to: '/diagnostics', label: 'Diagnostics', enabled: true },
];

export default function Shell() {
  const nav = useNavigate();
  const { session, online } = useUi();
  const business = useQuery({ queryKey: ['business'], queryFn: () => api.business.get({}) });
  const terminals = useQuery({ queryKey: ['terminals'], queryFn: () => api.business.getTerminals({}) });
  const terminal = terminals.data?.find((t) => t.id === session?.terminalId);
  return (
    <div className="h-screen grid grid-cols-[220px_1fr] grid-rows-[56px_1fr]">
      <header className="col-span-2 flex items-center justify-between border-b bg-white px-5">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-lg">Muneem</span>
          <span className="text-slate-700">{business.data?.name ?? '…'}</span>
          {terminal && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">Terminal {terminal.code}</span>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`text-xs ${online ? 'text-green-700' : 'text-amber-700'}`}>{online ? '● Online' : '● Offline'}</span>
          <SyncBadge />
          <span className="text-slate-700">{session?.user.name}{session?.mode === 'offline' && <span className="text-xs text-amber-700"> (offline{session.offlineDaysRemaining !== null ? `, ${session.offlineDaysRemaining}d left` : ''})</span>}</span>
          <button className="btn-secondary py-1" onClick={() => nav('/switch')}>Switch user</button>
          <button className="btn-secondary py-1" onClick={async () => { await api.auth.logout({}); nav('/login'); }}>Sign out</button>
        </div>
      </header>
      <nav className="border-r bg-white py-3" aria-label="Main">
        <ul>
          {NAV.filter((n) => !n.need || can(session, n.need)).map((n) => (
            <li key={n.to}>
              {n.enabled ? (
                <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => `block px-5 py-2 text-sm ${isActive ? 'bg-blue-50 text-blue-800 font-medium' : 'hover:bg-slate-50'}`}>{n.label}</NavLink>
              ) : (
                <span className="block px-5 py-2 text-sm text-slate-400" aria-disabled="true" title={`Coming in ${n.stage}`}>{n.label} <span className="text-xs">({n.stage})</span></span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <main className="overflow-auto p-6"><Outlet /></main>
    </div>
  );
}
