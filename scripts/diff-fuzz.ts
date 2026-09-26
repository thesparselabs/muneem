/**
 * Differential fuzz: random invoices → TypeScript engine vs Go port (cloud/cmd/verify-fixture).
 * Any difference in a single paise, bucket or error code fails. Run nightly in CI and on demand:
 *   pnpm diff-fuzz --n 5000 --seed 42
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { computeInvoice, DomainError, type GstInvoiceInput, type TaxTreatment } from '../packages/domain/dist/index.js';

const args = new Map(process.argv.slice(2).flatMap((a, i, all) => (a.startsWith('--') ? [[a.slice(2), all[i + 1] ?? '']] : [])));
const N = Number(args.get('n') ?? 2000);
let seed = Number(args.get('seed') ?? Date.now() % 1_000_000);
const seedUsed = seed;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T,>(xs: readonly T[]): T => xs[int(0, xs.length - 1)]!;

const RATES = [0, 25, 150, 300, 500, 1200, 1800, 2800];
const TREATMENTS: TaxTreatment[] = ['taxable', 'taxable', 'taxable', 'exempt', 'nil_rated', 'non_gst', 'zero_rated'];
const disc = () => (rnd() < 0.5 ? { kind: 'amount' as const, value: rnd() < 0.7 ? 0 : int(0, 500) } : { kind: 'percent' as const, value: int(0, 5000) });

function gen(): GstInvoiceInput {
  const lines = Array.from({ length: int(1, 30) }, () => ({
    qtyMilli: rnd() < 0.7 ? int(1, 24) * 1000 : int(1, 5_000_000),
    unitPricePaise: rnd() < 0.1 ? int(0, 99) : int(0, 20_000_000),
    priceIsInclusive: rnd() < 0.5,
    lineDiscount: disc(),
    gstRateBp: pick(RATES),
    cessRateBp: pick([0, 0, 0, 100, 1200, 2200]),
    cessPerUnitPaise: pick([0, 0, 0, 400]),
    taxTreatment: pick(TREATMENTS),
  }));
  return {
    docType: pick(['tax_invoice', 'credit_note', 'bill_of_supply'] as const),
    supplierStateCode: '07',
    placeOfSupplyStateCode: pick(['07', '06', '27', '04']),
    isUnionTerritoryWithoutLegislature: rnd() < 0.1,
    taxScheme: pick(['regular', 'regular', 'regular', 'composition', 'unregistered'] as const),
    ...(rnd() < 0.3 ? { customerGstin: '07AAAAA0000A1Z5' } : {}),
    billDiscount: disc(),
    roundToRupee: rnd() < 0.5,
    b2clThresholdPaise: 10_000_000,
    lines,
  };
}

const cases = Array.from({ length: N }, (_, i) => ({ name: `fuzz-${i}`, input: gen() }));
const tsResults = cases.map((c) => {
  try { return computeInvoice(c.input); } catch (e) { if (e instanceof DomainError) return { error: { code: e.code } }; throw e; }
});

if (!existsSync('cloud/cmd/verify-fixture/main.go')) {
  console.error('diff-fuzz: cloud/cmd/verify-fixture not present; nothing to compare against');
  process.exit(2);
}
const go = spawnSync('go', ['run', './cmd/verify-fixture'], { cwd: 'cloud', input: JSON.stringify({ version: 1, cases }), encoding: 'utf8', maxBuffer: 1 << 30 });
if (go.status !== 0) { console.error(go.stderr); process.exit(1); }
const goResults = (JSON.parse(go.stdout) as { results: unknown[] }).results;
if (goResults.length !== N) { console.error(`diff-fuzz: Go returned ${goResults.length} results for ${N} cases`); process.exit(1); }

// Errors compare by code only: the message text is implementation-specific, the code is the contract.
const normalize = (v: unknown) => (v && typeof v === 'object' && 'error' in v ? { error: { code: (v as { error: { code: string } }).error.code } } : v);
const canon = (v: unknown) => JSON.stringify(normalize(v), (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as object).sort()) : x));
let diffs = 0;
for (let i = 0; i < N; i++) {
  const a = canon(tsResults[i]), b = canon(goResults[i]);
  if (a !== b) {
    diffs++;
    if (diffs <= 5) console.error(`DIFF ${cases[i]!.name} (seed ${seedUsed})\n  input: ${JSON.stringify(cases[i]!.input).slice(0, 600)}…\n  ts: ${a.slice(0, 400)}\n  go: ${b.slice(0, 400)}`);
  }
}
if (diffs) { console.error(`diff-fuzz: ${diffs}/${N} cases differ (seed ${seedUsed})`); process.exit(1); }
console.log(`diff-fuzz: ${N} cases identical between TypeScript and Go (seed ${seedUsed})`);
