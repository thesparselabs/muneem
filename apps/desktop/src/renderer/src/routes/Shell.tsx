import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useUi } from '../store.js';
import SyncBadge from '../components/SyncBadge.js';
import UpdateBanner from '../components/UpdateBanner.js';
import NotificationBell from '../components/NotificationBell.js';
import ToastViewport from '../components/ToastViewport.js';
import ThemeToggle from '../components/ThemeToggle.js';
import { LogoMark } from '../components/Logo.js';
import type { Permission } from '@muneem/contracts';
import { can } from '../lib/permissions.js';
import {
  Activity, BarChart3, Boxes, FileText, Home as HomeIcon, Inbox, Landmark, Package, Palette, RefreshCw,
  Receipt, ShoppingCart, Truck, Users, Wallet, TrendingDown, type LucideIcon,
} from 'lucide-react';

// `need` hides an item from users who could not use it; main still checks every call (5f details).
const NAV: { to: string; label: string; icon: LucideIcon; enabled: boolean; stage?: string; need?: Permission }[] = [
  { to: '/', label: 'Home', icon: HomeIcon, enabled: true },
  { to: '/pos', label: 'POS · Billing', icon: ShoppingCart, enabled: true },
  { to: '/sales', label: 'Sales · Returns', icon: Receipt, enabled: true, need: 'sales.view' },
  { to: '/products', label: 'Products', icon: Package, enabled: true },
  { to: '/inventory', label: 'Inventory', icon: Boxes, enabled: true },
  { to: '/purchases', label: 'Purchases', icon: Truck, enabled: true, need: 'purchases.view' },
  { to: '/parties', label: 'Parties', icon: Users, enabled: true, need: 'customers.view' },
  { to: '/payments', label: 'Payments', icon: Wallet, enabled: true, need: 'payments.view' },
  { to: '/expenses', label: 'Expenses', icon: TrendingDown, enabled: true, need: 'expenses.view' },
  { to: '/accounts', label: 'Accounts', icon: Landmark, enabled: true, need: 'accounting.view' },
  { to: '/gst', label: 'GST', icon: FileText, enabled: true, need: 'gst.view' },
  { to: '/reports', label: 'Reports', icon: BarChart3, enabled: true, need: 'reports.view' },
  { to: '/settings/review', label: 'Review items', icon: Inbox, enabled: true, need: 'sync.view' },
  { to: '/settings/invoice', label: 'Invoice design', icon: Palette, enabled: true, need: 'settings.view' },
  { to: '/settings/updates', label: 'Updates', icon: RefreshCw, enabled: true, need: 'settings.view' },
  { to: '/diagnostics', label: 'Diagnostics', icon: Activity, enabled: true },
];

export default function Shell() {
  const nav = useNavigate();
  const { session, online } = useUi();
  const business = useQuery({ queryKey: ['business'], queryFn: () => api.business.get({}) });
  const terminals = useQuery({ queryKey: ['terminals'], queryFn: () => api.business.getTerminals({}) });
  const terminal = terminals.data?.find((t) => t.id === session?.terminalId);
  return (
    <div className="h-screen grid grid-cols-[220px_1fr] grid-rows-[56px_1fr] print:block print:h-auto">
      <header className="col-span-2 flex print:hidden items-center justify-between border-b border-border bg-card px-5">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 font-semibold text-lg text-foreground"><LogoMark size={26} /> Muneem</span>
          <span className="text-muted-foreground">{business.data?.name ?? '…'}</span>
          {terminal && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Terminal {terminal.code}</span>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`text-xs ${online ? 'text-green-700' : 'text-amber-700'}`}>{online ? '● Online' : '● Offline'}</span>
          <SyncBadge />
          <ThemeToggle />
          <NotificationBell />
          <span className="text-muted-foreground">{session?.user.name}{session?.mode === 'offline' && <span className="text-xs text-amber-600"> (offline{session.offlineDaysRemaining !== null ? `, ${session.offlineDaysRemaining}d left` : ''})</span>}</span>
          <button className="btn-secondary py-1" onClick={() => nav('/switch')}>Switch user</button>
          <button className="btn-secondary py-1" onClick={async () => { await api.auth.logout({}); nav('/login'); }}>Sign out</button>
        </div>
      </header>
      <nav className="border-r border-border bg-sidebar text-sidebar-foreground py-3 print:hidden" aria-label="Main">
        <ul>
          {NAV.filter((n) => !n.need || can(session, n.need)).map((n) => (
            <li key={n.to}>
              {n.enabled ? (
                <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => `flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}><n.icon size={16} className="shrink-0" aria-hidden /><span>{n.label}</span></NavLink>
              ) : (
                <span className="flex items-center gap-2.5 px-5 py-2 text-sm text-muted-foreground/60" aria-disabled="true" title={`Coming in ${n.stage}`}><n.icon size={16} className="shrink-0" aria-hidden /><span>{n.label} <span className="text-xs">({n.stage})</span></span></span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <main className="overflow-auto p-6 print:overflow-visible print:p-0"><UpdateBanner /><Outlet /></main>
      <ToastViewport />
    </div>
  );
}
