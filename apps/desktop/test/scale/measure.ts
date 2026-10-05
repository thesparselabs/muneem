export interface Sample { median: number; p95: number; max: number; n: number }
export interface BudgetRow { path: string; budgetMs: number; stat: 'median' | 'p95'; sample: Sample; note?: string }

export function summarise(xs: readonly number[]): Sample {
  const s = [...xs].sort((a, b) => a - b);
  return { median: s[Math.floor(s.length / 2)]!, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]!, max: s.at(-1)!, n: s.length };
}

export async function time<T>(fn: () => T | Promise<T>): Promise<{ ms: number; value: T }> {
  const t = performance.now();
  const value = await fn();
  return { ms: performance.now() - t, value };
}

// Calls are spaced to stay inside each IPC channel's rate limit; only the call itself is timed.
export async function sampled(n: number, perSec: number, fn: (i: number) => unknown): Promise<Sample> {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push((await time(() => fn(i))).ms);
    await new Promise((r) => setTimeout(r, Math.ceil(1000 / perSec)));
  }
  return summarise(xs);
}

export const within = (r: BudgetRow) => r.sample[r.stat] < r.budgetMs;

export function table(rows: readonly BudgetRow[]): string {
  const f = (x: number) => x.toFixed(1);
  return ['| Path | Budget | Median | p95 | Max | n | Result |', '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.path} | < ${r.budgetMs} ms ${r.stat} | ${f(r.sample.median)} | ${f(r.sample.p95)} | ${f(r.sample.max)} | ${r.sample.n} | ${within(r) ? 'pass' : 'FAIL'}${r.note ? ` (${r.note})` : ''} |`)].join('\n');
}

export const rssMb = () => Math.round(process.memoryUsage().rss / 1024 / 1024);
