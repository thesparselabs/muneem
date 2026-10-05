import { motion } from 'motion/react';
import { areaPath, donutArcs, linePath, seriesBounds, seriesPoints } from '../../lib/reports/dashboard.js';
import { usePrefersReducedMotion } from '../../lib/motion.js';

export const SERIES_COLOURS = ['var(--primary)', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#15803d'];
export const seriesColour = (i: number): string => SERIES_COLOURS[i % SERIES_COLOURS.length]!;

export interface Slice { key: string; label: string; value: number; display: string; note?: string }

const R = 42;
const CIRC = 2 * Math.PI * R;

export function Donut({ slices, label, centre }: { slices: readonly Slice[]; label: string; centre: { top: string; bottom: string } }) {
  const reduce = usePrefersReducedMotion();
  const arcs = donutArcs(slices.map((s) => ({ key: s.key, value: s.value })), CIRC);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={label}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" />
          {arcs.map((a) => {
            const i = slices.findIndex((s) => s.key === a.key);
            const gap = arcs.length > 1 ? 0.8 : 0;
            return (
              <motion.circle key={a.key} cx="50" cy="50" r={R} fill="none" stroke={seriesColour(i)} strokeWidth="12"
                strokeDasharray={`${Math.max(a.length - gap, 0.1)} ${CIRC}`} strokeDashoffset={-a.offset}
                initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.05 * i }}>
                <title>{`${slices[i]?.label}: ${slices[i]?.display}`}</title>
              </motion.circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold tabular-nums">{centre.top}</span>
          <span className="text-xs text-muted-foreground">{centre.bottom}</span>
        </div>
      </div>
      <ul className="min-w-40 flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: seriesColour(i) }} aria-hidden />{s.label}</span>
            <span className="tabular-nums">{s.display}{s.note ? <span className="text-muted-foreground"> · {s.note}</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ rows, label, colour = 'var(--primary)' }: { rows: readonly Slice[]; label: string; colour?: string }) {
  const reduce = usePrefersReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.key} title={`${r.label}: ${r.display}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{r.label}</span><span className="tabular-nums">{r.display}{r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full origin-left rounded-full" style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: colour }}
              initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.06 * i, ease: 'easeOut' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface TrendDatum { day: string; sales: number; profit: number }

export function AreaTrend({ data, label, format }: { data: readonly TrendDatum[]; label: string; format: (n: number) => string }) {
  const reduce = usePrefersReducedMotion();
  const W = 600;
  const H = 150;
  const bounds = seriesBounds(data.map((d) => d.sales), data.map((d) => d.profit));
  const sales = seriesPoints(data.map((d) => ({ day: d.day, value: d.sales })), W, H, bounds);
  const profit = seriesPoints(data.map((d) => ({ day: d.day, value: d.profit })), W, H, bounds);
  const zeroY = seriesPoints([{ day: '', value: 0 }], W, H, bounds)[0]!.y;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={label} preserveAspectRatio="none">
        <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
        <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <motion.g initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <path d={areaPath(sales, zeroY)} fill="url(#trend-fill)" />
          <path d={linePath(sales)} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <path d={linePath(profit)} fill="none" stroke="#b45309" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        </motion.g>
        {sales.map((p, i) => (
          <rect key={p.day} x={p.x - W / Math.max(sales.length, 1) / 2} y="0" width={W / Math.max(sales.length, 1)} height={H} fill="transparent">
            <title>{`${p.day}: sales ${format(p.value)}, profit ${format(profit[i]?.value ?? 0)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{data[0]?.day}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-primary" aria-hidden />Net sales</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: '#b45309' }} aria-hidden />Gross profit</span>
        </span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}
