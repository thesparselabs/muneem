import { motion } from 'motion/react';
import { BarChart3, Boxes, FileText, Home, Receipt, ShoppingCart, Users, Wallet } from 'lucide-react';
import NumberTicker from './NumberTicker.tsx';
import type { TabId } from '../site.ts';
import { EASE } from '../lib/motion.ts';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// The faux desktop-app frame. The product UI is the page's main visual, so the chrome stays quiet.
export function AppWindow({ active, children }: { active: TabId; children: React.ReactNode }) {
  const NAV = [Home, ShoppingCart, Receipt, Boxes, Users, Wallet, FileText, BarChart3];
  const activeIndex = { dashboard: 0, billing: 1, gst: 6, reports: 7 }[active];
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_30px_80px_-40px_rgba(14,15,26,0.45)]">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-xs font-medium text-muted">Muneem — Sharma Kirana · Terminal T01</span>
      </div>
      <div className="flex min-h-[340px]">
        <div className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-card py-3 sm:flex">
          {NAV.map((Icon, i) => (
            <span key={i} className={`grid h-8 w-8 place-items-center rounded-lg ${i === activeIndex ? 'bg-primary/10 text-primary' : 'text-muted'}`}><Icon size={16} /></span>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-surface p-4">{children}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, format, note }: { label: string; value: number; format?: (n: number) => string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="text-xl font-bold tracking-tight"><NumberTicker value={value} format={format ?? ((n) => String(Math.round(n)))} /></p>
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </div>
  );
}

function Bars() {
  const data = [38, 52, 44, 61, 70, 58, 82, 74, 90, 66, 78, 96];
  const max = Math.max(...data);
  return (
    <div className="flex h-24 items-end gap-1.5">
      {data.map((v, i) => (
        <motion.span key={i} className="h-full flex-1 rounded-t bg-gradient-to-t from-primary/70 to-primary"
          style={{ transformOrigin: 'bottom' }} initial={{ scaleY: 0 }} whileInView={{ scaleY: v / max }}
          viewport={{ once: true, margin: '-10% 0px' }} transition={{ duration: 0.6, delay: i * 0.04, ease: EASE }} />
      ))}
    </div>
  );
}

export function DashboardPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between"><h3 className="text-sm font-semibold">Today</h3><span className="text-[11px] text-muted">Updated just now</span></div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="Today's sales" value={4818650} format={inr} note="214 bills" />
        <Kpi label="Cash" value={1962000} format={inr} />
        <Kpi label="UPI" value={2411300} format={inr} />
        <Kpi label="Gross profit" value={742900} format={inr} note="18% margin" />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="mb-2 text-xs font-semibold">Net sales, last 12 days</p><Bars />
        </div>
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="mb-2 text-xs font-semibold">Needs attention</p>
          <ul className="space-y-1.5 text-[12px] text-ink-soft">
            <li className="flex justify-between"><span>Low stock</span><span className="font-semibold text-warm">7 items</span></li>
            <li className="flex justify-between"><span>Customers owe</span><span className="font-semibold">{inr(1286400)}</span></li>
            <li className="flex justify-between"><span>GST due this month</span><span className="font-semibold">{inr(318900)}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function BillingPanel() {
  const lines = [
    ['Amul Butter 100g', '2', '₹1,20'], ['Tata Salt 1kg', '1', '₹28'], ['Basmati Rice 5kg', '1', '₹620'], ['Parle-G ×10', '10', '₹50'],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
      <div className="space-y-2">
        <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs text-muted">Scan or search a product (F2)</div>
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <table className="w-full text-[12px]">
            <thead><tr className="bg-surface text-left text-[11px] uppercase tracking-wide text-muted"><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>{lines.map((l, i) => <tr key={i} className="border-t border-line"><td className="px-3 py-2">{l[0]}</td><td className="px-3 py-2">{l[1]}</td><td className="px-3 py-2 text-right tabular-nums">{l[2]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-line bg-card p-3 text-[12px]">
          <div className="flex justify-between text-muted"><span>Taxable</span><span className="tabular-nums">₹7,34</span></div>
          <div className="flex justify-between text-muted"><span>GST</span><span className="tabular-nums">₹84</span></div>
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2"><span className="font-semibold">Total</span><span className="text-xl font-bold tracking-tight"><NumberTicker value={81800} format={inr} /></span></div>
        </div>
        <button className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">
          <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <Wallet size={16} /> Pay (F5)
        </button>
      </div>
    </div>
  );
}

function GstPanel() {
  const rows = [['Outward taxable (B2B)', '₹8,42,100', '₹1,51,578'], ['Outward taxable (B2C)', '₹12,18,400', '₹2,19,312'], ['Input tax credit', '₹6,04,900', '₹1,08,882'], ['Net GST payable', '—', '₹2,62,008']];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">GSTR-3B summary · September</h3>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full text-[12px]">
          <thead><tr className="bg-surface text-left text-[11px] uppercase tracking-wide text-muted"><th className="px-3 py-2">Head</th><th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">Tax</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className={`border-t border-line ${i === rows.length - 1 ? 'font-semibold' : ''}`}><td className="px-3 py-2">{r[0]}</td><td className="px-3 py-2 text-right tabular-nums">{r[1]}</td><td className="px-3 py-2 text-right tabular-nums">{r[2]}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">Computed from your real invoices — ready to file.</p>
    </div>
  );
}

function ReportsPanel() {
  const rows = [['Sales', '₹24,60,500'], ['Cost of goods sold', '₹19,88,100'], ['Gross profit', '₹4,72,400'], ['Operating expenses', '₹1,36,900'], ['Net profit', '₹3,35,500']];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Profit & Loss · this quarter</h3>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full text-[12px]">
          <tbody>{rows.map((r, i) => <tr key={i} className={`border-t border-line first:border-t-0 ${i === rows.length - 1 ? 'bg-accent/5 font-semibold text-accent' : ''}`}><td className="px-3 py-2">{r[0]}</td><td className="px-3 py-2 text-right tabular-nums">{r[1]}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">Every figure traces back to a posted double-entry journal.</p>
    </div>
  );
}

export function Panel({ id }: { id: TabId }) {
  if (id === 'billing') return <BillingPanel />;
  if (id === 'gst') return <GstPanel />;
  if (id === 'reports') return <ReportsPanel />;
  return <DashboardPanel />;
}
