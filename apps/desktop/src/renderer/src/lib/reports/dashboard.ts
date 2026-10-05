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
