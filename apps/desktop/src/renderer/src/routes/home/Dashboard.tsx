import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Dashboard as Figures } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise, scaledToText } from '../../lib/money.js';
import { amountOf, marginPercent, methodLabel, paymentShares, trendBars } from '../../lib/reports/dashboard.js';

const SHARE_COLOURS = ['#1d4ed8', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#15803d'];

function Card({ label, value, note, to }: { label: string; value: string; note?: string | undefined; to?: string }) {
  const body = <><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p>{note && <p className="text-xs text-slate-600">{note}</p>}</>;
  return to ? <Link to={to} className="card block hover:border-blue-300">{body}</Link> : <div className="card">{body}</div>;
}

function Trend({ d }: { d: Figures }) {
  const W = 600;
  const H = 120;
  const bars = trendBars(d.trend, W, H);
  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">Net sales, last 30 days</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label="Net sales by day for the last 30 days">
        {bars.map((b) => (
          <rect key={b.day} x={b.x} y={b.y} width={b.width} height={Math.max(b.height, 0.5)} fill={b.valuePaise < 0 ? '#be123c' : b.day === d.today ? '#1d4ed8' : '#93c5fd'}>
            <title>{`${b.day}: ${formatPaise(b.valuePaise)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-slate-500"><span>{d.trend[0]?.day}</span><span>{d.today}</span></div>
    </div>
  );
}

function PaymentSplit({ d }: { d: Figures }) {
  const shares = paymentShares(d.paymentSplit);
  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">How customers paid, last 30 days</h2>
      {shares.length === 0 ? <p className="text-sm text-slate-500">No sales yet.</p> : (
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
  if (q.error) return <p className="err" role="alert">{errorMessage(q.error)}</p>;
  const d = q.data;
  if (!d) return <p className="text-slate-500">Loading today's figures…</p>;
  const margin = marginPercent(d.sales.grossProfitPaise, d.sales.netTaxablePaise);
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Today</h1>
        <Link to="/reports" className="text-sm text-blue-800">All reports →</Link>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Card label="Today's sales" value={formatPaise(d.sales.netSalesPaise)}
          note={`${d.sales.saleCount} bills${d.sales.returnCount ? ` · ${formatPaise(d.sales.returnsPaise)} returned` : ''}`} />
        <Card label="Cash" value={formatPaise(amountOf(d.todayTenders, 'cash'))} />
        <Card label="UPI" value={formatPaise(amountOf(d.todayTenders, 'upi'))} />
        <Card label="Credit sales" value={formatPaise(amountOf(d.todayTenders, 'credit'))} />
        <Card label="Gross profit" value={formatPaise(d.sales.grossProfitPaise)} note={margin === null ? undefined : `${margin}% of sales before GST`} />
        <Card label="Purchases" value={formatPaise(d.purchasesPaise)} to="/purchases" />
        <Card label="Expenses" value={formatPaise(d.expensesPaise)} to="/expenses" />
        <Card label="Low stock" value={String(d.lowStock.count)} to="/inventory" />
        <Card label="Customers owe" value={formatPaise(d.receivablePaise)} to="/parties/outstanding" />
        <Card label="We owe suppliers" value={formatPaise(d.payablePaise)} to="/parties/outstanding" />
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Trend d={d} />
        <PaymentSplit d={d} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="mb-2 font-semibold">Top sellers, last 30 days</h2>
          {d.topProducts.length === 0 ? <p className="text-sm text-slate-500">No sales yet.</p> : (
            <table className="w-full text-sm"><tbody>
              {d.topProducts.map((p) => (
                <tr key={p.productId} className="border-t"><td className="p-1">{p.name}</td><td className="p-1 text-right tabular-nums">{scaledToText(Math.max(p.qtyMilli, 0), 3)} {p.uomCode}</td>
                  <td className="p-1 text-right tabular-nums">{formatPaise(p.netSalesPaise)}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">Low stock</h2>
          {d.lowStock.items.length === 0 ? <p className="text-sm text-slate-500">Nothing at or below its reorder level.</p> : (
            <ul className="text-sm">
              {d.lowStock.items.map((r) => <li key={r.productId}><Link to={`/inventory/product/${r.productId}`} className="text-blue-800">{r.name}</Link> — {r.qtyMilli < 0 ? '-' : ''}{scaledToText(Math.abs(r.qtyMilli), 3)} {r.uomCode} left</li>)}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">Sales are net of returns on the day the credit note was issued. {d.todayTenders.filter((t) => !['cash', 'upi', 'credit'].includes(t.method)).map((t) => `${methodLabel(t.method)} ${formatPaise(t.amountPaise)}`).join(' · ')}</p>
    </div>
  );
}
