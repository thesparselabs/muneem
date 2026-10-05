import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Dashboard as Figures } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { amountOf, marginPercent, methodLabel, paymentShares, trendBars } from '../../lib/reports/dashboard.js';
import { attentionNote } from '../../lib/notifications.js';
import { useNotificationCounts } from '../../components/NotificationBell.js';
import NumberTicker from '../../components/NumberTicker.js';
import Skeleton from '../../components/Skeleton.js';
import { ArrowRight, Banknote, Bell, CreditCard, IndianRupee, LayoutDashboard, PackageMinus, PieChart, Smartphone, TrendingDown, TrendingUp, Trophy, Truck, Users, Wallet, type LucideIcon } from 'lucide-react';

const SHARE_COLOURS = ['#1d4ed8', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#15803d'];

// A KPI reads either a rupee figure (paise) or a count; both count up. Static strings still go through `value`.
function Card({ label, value, paise, count, note, to, icon: Icon }:
  { label: string; value?: string; paise?: number; count?: number; note?: string | undefined; to?: string; icon?: LucideIcon }) {
  const headline = paise !== undefined
    ? <NumberTicker className="text-2xl font-semibold tabular-nums" value={paise} format={(n) => formatPaise(Math.round(n))} />
    : count !== undefined
      ? <NumberTicker className="text-2xl font-semibold tabular-nums" value={count} format={(n) => String(Math.round(n))} />
      : <span className="text-2xl font-semibold tabular-nums">{value}</span>;
  const body = <><p className="flex items-center gap-1.5 text-xs text-muted-foreground">{Icon && <Icon size={14} aria-hidden />}{label}</p><p>{headline}</p>{note && <p className="text-xs text-muted-foreground">{note}</p>}</>;
  return to ? <Link to={to} className="card block hover:border-primary/50">{body}</Link> : <div className="card">{body}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="card space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-24" /></div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
    </div>
  );
}

function Trend({ d }: { d: Figures }) {
  const W = 600;
  const H = 120;
  const bars = trendBars(d.trend, W, H);
  return (
    <div className="card">
      <h2 className="mb-2 flex items-center gap-2 font-semibold"><TrendingUp size={16} className="text-primary" aria-hidden /> Net sales, last 30 days</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label="Net sales by day for the last 30 days">
        {bars.map((b) => (
          <rect key={b.day} x={b.x} y={b.y} width={b.width} height={Math.max(b.height, 0.5)} fill={b.valuePaise < 0 ? '#be123c' : b.day === d.today ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 40%, transparent)'}>
            <title>{`${b.day}: ${formatPaise(b.valuePaise)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{d.trend[0]?.day}</span><span>{d.today}</span></div>
    </div>
  );
}

function PaymentSplit({ d }: { d: Figures }) {
  const shares = paymentShares(d.paymentSplit);
  return (
    <div className="card">
      <h2 className="mb-2 flex items-center gap-2 font-semibold"><PieChart size={16} className="text-primary" aria-hidden /> How customers paid, last 30 days</h2>
      {shares.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : (
        <>
          <div className="flex h-4 overflow-hidden rounded" role="img" aria-label={shares.map((s) => `${s.label} ${s.percent}%`).join(', ')}>
            {shares.map((s, i) => <div key={s.method} style={{ width: `${s.percent}%`, background: SHARE_COLOURS[i % SHARE_COLOURS.length] }} />)}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {shares.map((s, i) => (
              <li key={s.method} className="flex justify-between">
                <span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: SHARE_COLOURS[i % SHARE_COLOURS.length] }} />{s.label}</span>
                <span className="tabular-nums">{formatPaise(s.amountPaise)} · {s.percent}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.reports.dashboard({}), refetchInterval: 60_000 });
  const alerts = useNotificationCounts();
  if (q.error) return <p className="err" role="alert">{errorMessage(q.error)}</p>;
  const d = q.data;
  if (!d) return <DashboardSkeleton />;
  const margin = marginPercent(d.sales.grossProfitPaise, d.sales.netTaxablePaise);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard size={22} className="text-primary" aria-hidden /> Today</h1>
        <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-primary">All reports <ArrowRight size={14} aria-hidden /></Link>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        <Card icon={IndianRupee} label="Today's sales" paise={d.sales.netSalesPaise}
          note={`${d.sales.saleCount} bills${d.sales.returnCount ? ` · ${formatPaise(d.sales.returnsPaise)} returned` : ''}`} />
        <Card icon={Banknote} label="Cash" paise={amountOf(d.todayTenders, 'cash')} />
        <Card icon={Smartphone} label="UPI" paise={amountOf(d.todayTenders, 'upi')} />
        <Card icon={CreditCard} label="Credit sales" paise={amountOf(d.todayTenders, 'credit')} />
        <Card icon={TrendingUp} label="Gross profit" paise={d.sales.grossProfitPaise} note={margin === null ? undefined : `${margin}% of sales before GST`} />
        <Card icon={Truck} label="Purchases" paise={d.purchasesPaise} to="/purchases" />
        <Card icon={TrendingDown} label="Expenses" paise={d.expensesPaise} to="/expenses" />
        <Card icon={PackageMinus} label="Low stock" count={d.lowStock.count} to="/inventory" />
        <Card icon={Users} label="Customers owe" paise={d.receivablePaise} to="/parties/outstanding" />
        <Card icon={Wallet} label="We owe suppliers" paise={d.payablePaise} to="/parties/outstanding" />
        <Card icon={Bell} label="Needs attention" count={alerts.data?.open ?? 0} note={attentionNote(alerts.data)} to="/notifications" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <Trend d={d} />
        <PaymentSplit d={d} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><Trophy size={16} className="text-primary" aria-hidden /> Top sellers, last 30 days</h2>
          {d.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : (
            <table className="w-full text-sm"><tbody>
              {d.topProducts.map((p) => (
                <tr key={p.productId} className="border-t border-border"><td className="p-1">{p.name}</td><td className="p-1 text-right tabular-nums">{scaledToText(Math.max(p.qtyMilli, 0), 3)} {p.uomCode}</td>
                  <td className="p-1 text-right tabular-nums">{formatPaise(p.netSalesPaise)}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><PackageMinus size={16} className="text-amber-700 dark:text-amber-300" aria-hidden /> Low stock</h2>
          {d.lowStock.items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing at or below its reorder level.</p> : (
            <ul className="text-sm">
              {d.lowStock.items.map((r) => <li key={r.productId}><Link to={`/inventory/product/${r.productId}`} className="text-primary">{r.name}</Link> — {r.qtyMilli < 0 ? '-' : ''}{scaledToText(Math.abs(r.qtyMilli), 3)} {r.uomCode} left</li>)}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Sales are net of returns on the day the credit note was issued. {d.todayTenders.filter((t) => !['cash', 'upi', 'credit'].includes(t.method)).map((t) => `${methodLabel(t.method)} ${formatPaise(t.amountPaise)}`).join(' · ')}</p>
    </div>
  );
}
