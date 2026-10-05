export interface Bar { x: number; y: number; width: number; height: number; day: string; valuePaise: number }

// Bars on a shared zero line so a day of net returns dips below it; heights are in the chart's own units.
export function trendBars(points: readonly { day: string; netSalesPaise: number }[], width: number, height: number, gap = 2): Bar[] {
  if (points.length === 0) return [];
  const max = Math.max(0, ...points.map((p) => p.netSalesPaise));
  const min = Math.min(0, ...points.map((p) => p.netSalesPaise));
  const span = max - min || 1;
  const zero = (max / span) * height;
  const slot = width / points.length;
  return points.map((p, i) => {
    const h = (Math.abs(p.netSalesPaise) / span) * height;
    return { x: i * slot + gap / 2, y: p.netSalesPaise >= 0 ? zero - h : zero, width: Math.max(slot - gap, 1), height: h, day: p.day, valuePaise: p.netSalesPaise };
  });
}

export interface Share { method: string; label: string; amountPaise: number; percent: number }

const METHOD_LABELS: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit', bank: 'Bank', wallet: 'Wallet', other: 'Other' };
export const methodLabel = (m: string): string => METHOD_LABELS[m] ?? m;

// Whole-number shares that add up to 100 (largest remainder), ignoring methods that netted to nothing or less.
export function paymentShares(split: readonly { method: string; amountPaise: number }[]): Share[] {
  const positive = split.filter((s) => s.amountPaise > 0);
  const total = positive.reduce((s, x) => s + x.amountPaise, 0);
  if (total === 0) return [];
  const raw = positive.map((s) => (s.amountPaise * 100) / total);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floors[i]!, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left-- <= 0) break; floors[i]! += 1; }
  return positive.map((s, i) => ({ method: s.method, label: methodLabel(s.method), amountPaise: s.amountPaise, percent: floors[i]! }));
}

export const amountOf = (split: readonly { method: string; amountPaise: number }[], method: string): number =>
  split.find((s) => s.method === method)?.amountPaise ?? 0;

// Gross margin on net sales before GST, in whole percent; null when nothing was sold.
export const marginPercent = (grossProfitPaise: number, netTaxablePaise: number): number | null =>
  netTaxablePaise === 0 ? null : Math.round((grossProfitPaise * 100) / netTaxablePaise);

export type DashboardPeriodKey = 'today' | 'week' | 'month';
export const PERIOD_LABELS: Record<DashboardPeriodKey, { tab: string; title: string; range: string; vs: string }> = {
  today: { tab: 'Today', title: 'Today', range: 'today', vs: 'vs yesterday' },
  week: { tab: 'This week', title: 'Last 7 days', range: 'in the last 7 days', vs: 'vs the 7 days before' },
  month: { tab: 'This month', title: 'Last 30 days', range: 'in the last 30 days', vs: 'vs the 30 days before' },
};

// Whole-percent change against the previous period; null when there is nothing to compare with.
export const percentChange = (now: number, before: number): number | null =>
  before === 0 ? null : Math.round(((now - before) * 100) / Math.abs(before));

export interface Arc { key: string; length: number; offset: number; fraction: number }

// Segments of a circle of the given circumference; offsets are cumulative, from 12 o'clock.
export function donutArcs(values: readonly { key: string; value: number }[], circumference: number): Arc[] {
  const total = values.reduce((s, v) => s + Math.max(v.value, 0), 0);
  if (total === 0) return [];
  let start = 0;
  return values.filter((v) => v.value > 0).map((v) => {
    const fraction = v.value / total;
    const arc = { key: v.key, length: fraction * circumference, offset: start, fraction };
    start += arc.length;
    return arc;
  });
}

export interface SeriesPoint { x: number; y: number; day: string; value: number }

// Points on a shared vertical scale so two series (sales, profit) line up; `zeroY` is the baseline.
export function seriesPoints(points: readonly { day: string; value: number }[], width: number, height: number, bounds: { min: number; max: number }, pad = 6): SeriesPoint[] {
  const span = bounds.max - bounds.min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points.map((p, i) => ({ x: points.length > 1 ? i * step : width / 2, y: pad + ((bounds.max - p.value) / span) * (height - pad * 2), day: p.day, value: p.value }));
}

export function seriesBounds(...series: readonly (readonly number[])[]): { min: number; max: number } {
  const all = series.flat();
  return { min: Math.min(0, ...all), max: Math.max(0, ...all) };
}

export const linePath = (pts: readonly { x: number; y: number }[]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export function areaPath(pts: readonly { x: number; y: number }[], baselineY: number): string {
  const first = pts[0];
  const last = pts[pts.length - 1];
  return first && last ? `${linePath(pts)} L${last.x.toFixed(1)} ${baselineY.toFixed(1)} L${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z` : '';
}

export const DIGITAL_METHODS = ['upi', 'card', 'bank', 'wallet'];
