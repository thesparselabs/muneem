import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { DIGITAL_METHODS, PERIOD_LABELS, amountOf, marginPercent, methodLabel, paymentShares, percentChange, type DashboardPeriodKey } from '../../lib/reports/dashboard.js';
import { attentionNote } from '../../lib/notifications.js';
import { useNotificationCounts } from '../../components/NotificationBell.js';
import NumberTicker from '../../components/NumberTicker.js';
import Skeleton from '../../components/Skeleton.js';
import { AreaTrend, Donut, HBars, type Slice } from '../../components/charts/Charts.js';
import { ArrowDown, ArrowRight, ArrowUp, Banknote, Bell, CreditCard, Layers, IndianRupee, LayoutDashboard, PackageMinus, PieChart, Receipt, Scale, ShoppingBasket, Smartphone, Tags, TrendingDown, TrendingUp, Trophy, Truck, UserPlus, Users, Wallet, type LucideIcon } from 'lucide-react';

// A KPI reads either a rupee figure (paise) or a count; both count up. Static strings still go through `value`.
interface Delta { pct: number | null; versus: string; upIsGood?: boolean }

function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.pct === null) return null;
  const up = delta.pct >= 0;
  const good = up === (delta.upIsGood ?? true);
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <p className={`flex items-center gap-1 text-xs font-medium ${delta.pct === 0 ? 'text-muted-foreground' : good ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
      <Arrow size={12} aria-hidden /><span>{Math.abs(delta.pct)}%</span><span className="font-normal text-muted-foreground">{delta.versus}</span>
      <span className="sr-only">{up ? 'up' : 'down'}</span>
    </p>
  );
}

function Card({ label, value, paise, count, note, to, icon: Icon, delta }:
  { label: string; value?: string; paise?: number; count?: number; note?: string | undefined; to?: string; icon?: LucideIcon | undefined; delta?: Delta | undefined }) {
  const headline = paise !== undefined
    ? <NumberTicker className="text-2xl font-semibold tabular-nums" value={paise} format={(n) => formatPaise(Math.round(n))} />
    : count !== undefined
      ? <NumberTicker className="text-2xl font-semibold tabular-nums" value={count} format={(n) => String(Math.round(n))} />
      : <span className="text-2xl font-semibold tabular-nums">{value}</span>;
  const body = <><p className="flex items-center gap-1.5 text-xs text-muted-foreground">{Icon && <Icon size={14} aria-hidden />}{label}</p><p>{headline}</p>{note && <p className="text-xs text-muted-foreground">{note}</p>}{delta && <DeltaBadge delta={delta} />}</>;
  return to ? <Link to={to} className="card block hover:border-primary/50">{body}</Link> : <div className="card">{body}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="card space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-24" /></div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
    </div>
  );
}

function Panel({ icon: Icon, title, children, className = '' }: { icon: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`} aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><Icon size={16} className="text-primary" aria-hidden /> {title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => (
  <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground"><span>{text}</span></div>
);

function PeriodToggle({ value, onChange }: { value: DashboardPeriodKey; onChange: (p: DashboardPeriodKey) => void }) {
  return (
    <div role="tablist" aria-label="Dashboard period" className="inline-flex overflow-hidden rounded-lg border border-border bg-card text-sm">
      {(Object.keys(PERIOD_LABELS) as DashboardPeriodKey[]).map((p) => (
        <button key={p} type="button" role="tab" aria-selected={value === p} onClick={() => onChange(p)}
          className={`px-3 py-1.5 transition-colors ${value === p ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{PERIOD_LABELS[p].tab}</button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriodKey>('today');
  const q = useQuery({ queryKey: ['dashboard', period], queryFn: () => api.reports.dashboard({ period }), refetchInterval: 60_000, placeholderData: (prev) => prev });
  const alerts = useNotificationCounts();
  if (q.error) return <p className="err" role="alert">{errorMessage(q.error)}</p>;
  const d = q.data;
  if (!d) return <DashboardSkeleton />;
  const L = PERIOD_LABELS[period];
  const margin = marginPercent(d.sales.grossProfitPaise, d.sales.netTaxablePaise);
  const prev = d.previous;
  const versus = (now: number, before: number | undefined, upIsGood = true): Delta | undefined =>
    before === undefined ? undefined : { pct: percentChange(now, before), versus: L.vs, upIsGood };
  const bills = d.sales.saleCount;
  const avgBill = bills === 0 ? 0 : Math.round(d.sales.netSalesPaise / bills);
  const prevAvg = prev && prev.saleCount > 0 ? Math.round(prev.netSalesPaise / prev.saleCount) : undefined;
  const cash = amountOf(d.todayTenders, 'cash');
  const digital = DIGITAL_METHODS.reduce((s, m) => s + amountOf(d.todayTenders, m), 0);
  const credit = amountOf(d.todayTenders, 'credit');
  const shares = paymentShares(d.paymentSplit);
  const paidTotal = shares.reduce((s, x) => s + x.amountPaise, 0);
  const slices: Slice[] = shares.map((s) => ({ key: s.method, label: s.label, value: s.amountPaise, display: formatPaise(s.amountPaise), note: `${s.percent}%` }));
  const categories: Slice[] = (d.topCategories ?? []).map((c) => ({ key: c.id ?? 'none', label: c.name, value: c.amountPaise, display: formatPaise(c.amountPaise) }));
  const expenseTotal = (d.expenseBreakdown ?? []).reduce((s, x) => s + x.amountPaise, 0);
  const expenses: Slice[] = (d.expenseBreakdown ?? []).map((c) => ({ key: c.id ?? 'none', label: c.name, value: c.amountPaise, display: formatPaise(c.amountPaise), note: expenseTotal ? `${Math.round((c.amountPaise * 100) / expenseTotal)}%` : '' }));
  const balances: Slice[] = [
    { key: 'recv', label: 'Customers owe us', value: Math.max(d.receivablePaise, 0), display: formatPaise(d.receivablePaise) },
    { key: 'pay', label: 'We owe suppliers', value: Math.max(d.payablePaise, 0), display: formatPaise(d.payablePaise) },
  ];
  const net = d.receivablePaise - d.payablePaise;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutDashboard size={22} className="text-primary" aria-hidden /> {L.title}</h1>
          {d.from && d.to && d.from !== d.to && <p className="text-xs text-muted-foreground">{d.from} to {d.to}</p>}
        </div>
        <div className="flex items-center gap-4">
          <PeriodToggle value={period} onChange={setPeriod} />
          <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-primary">All reports <ArrowRight size={14} aria-hidden /></Link>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        <Card icon={IndianRupee} label={period === 'today' ? "Today's sales" : `Net sales, ${L.title.toLowerCase()}`} paise={d.sales.netSalesPaise} delta={versus(d.sales.netSalesPaise, prev?.netSalesPaise)}
          note={`${d.sales.saleCount} bills${d.sales.returnCount ? ` · ${formatPaise(d.sales.returnsPaise)} returned` : ''}`} />
        <Card icon={Receipt} label="Bills" count={bills} delta={versus(bills, prev?.saleCount)} />
        <Card icon={Scale} label="Average bill" paise={avgBill} delta={prevAvg === undefined ? undefined : versus(avgBill, prevAvg)} />
        <Card icon={TrendingUp} label="Gross profit" paise={d.sales.grossProfitPaise} delta={versus(d.sales.grossProfitPaise, prev?.grossProfitPaise)}
          note={margin === null ? undefined : `${margin}% of sales before GST`} />
        <Card icon={Banknote} label="Cash" paise={cash} />
        <Card icon={Smartphone} label="UPI" paise={amountOf(d.todayTenders, 'upi')} note={digital > 0 ? `${formatPaise(digital)} digital in all` : undefined} />
        <Card icon={CreditCard} label="Credit sales" paise={credit} />
        {d.productsSold !== undefined && <Card icon={ShoppingBasket} label="Products sold" count={d.productsSold} note="distinct items" />}
        {d.newCustomers !== undefined && <Card icon={UserPlus} label="New customers" count={d.newCustomers} />}
        <Card icon={Truck} label="Purchases" paise={d.purchasesPaise} to="/purchases" delta={versus(d.purchasesPaise, prev?.purchasesPaise, false)} />
        <Card icon={TrendingDown} label="Expenses" paise={d.expensesPaise} to="/expenses" delta={versus(d.expensesPaise, prev?.expensesPaise, false)} />
        <Card icon={PackageMinus} label="Low stock" count={d.lowStock.count} to="/inventory" />
        <Card icon={Users} label="Customers owe" paise={d.receivablePaise} to="/parties/outstanding" />
        <Card icon={Wallet} label="We owe suppliers" paise={d.payablePaise} to="/parties/outstanding" />
        <Card icon={Bell} label="Needs attention" count={alerts.data?.open ?? 0} note={attentionNote(alerts.data)} to="/notifications" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel icon={TrendingUp} title={`Net sales and profit, last ${d.trend.length} days`}>
          {d.trend.every((t) => t.netSalesPaise === 0 && t.grossProfitPaise === 0)
            ? <Empty text="No sales yet in this period." />
            : <AreaTrend data={d.trend.map((t) => ({ day: t.day, sales: t.netSalesPaise, profit: t.grossProfitPaise }))} label={`Net sales and gross profit by day for the last ${d.trend.length} days`} format={formatPaise} />}
        </Panel>
        <Panel icon={PieChart} title={`How customers paid, ${L.range}`}>
          {slices.length === 0 ? <Empty text="No sales yet in this period." />
            : <Donut slices={slices} label={shares.map((s) => `${s.label} ${s.percent}%`).join(', ')} centre={{ top: formatPaise(paidTotal), bottom: 'collected' }} />}
        </Panel>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel icon={Tags} title={`Top categories, ${L.range}`}>
          {categories.length === 0 ? <Empty text="No category sales yet in this period." /> : <HBars rows={categories} label="Net sales by product category" />}
        </Panel>
        <Panel icon={Layers} title={`Expenses by category, ${L.range}`}>
          {expenses.length === 0 ? <Empty text="No expenses recorded in this period." /> : <HBars rows={expenses} label="Expenses by category" colour="#b45309" />}
        </Panel>
        <Panel icon={Scale} title="Receivables vs payables">
          {d.receivablePaise <= 0 && d.payablePaise <= 0 ? <Empty text="Nothing outstanding either way." /> : (
            <>
              <HBars rows={balances} label="Receivables against payables" colour="#0f766e" />
              <p className="mt-3 text-xs text-muted-foreground">{net >= 0 ? 'Net, others owe you ' : 'Net, you owe '}<span className="font-medium text-foreground tabular-nums">{formatPaise(Math.abs(net))}</span></p>
            </>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel icon={Trophy} title={`Top sellers, ${L.range}`}>
          {d.topProducts.length === 0 ? <Empty text="No sales yet in this period." /> : (
            <table className="w-full text-sm"><tbody>
              {d.topProducts.map((p) => (
                <tr key={p.productId} className="border-t border-border"><td className="p-1">{p.name}</td><td className="p-1 text-right tabular-nums">{scaledToText(Math.max(p.qtyMilli, 0), 3)} {p.uomCode}</td>
                  <td className="p-1 text-right tabular-nums">{formatPaise(p.netSalesPaise)}</td></tr>
              ))}
            </tbody></table>
          )}
        </Panel>
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
