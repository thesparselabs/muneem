import Reveal, { RevealItem } from './Reveal.tsx';
import NumberTicker from './NumberTicker.tsx';
import { WHY } from '../site.ts';

const STATS = [
  { value: 500000, suffix: '+', label: 'invoices, still instant' },
  { value: 60, prefix: '<', suffix: ' ms', label: 'to save a sale' },
  { value: 4, suffix: ' GB', label: 'RAM is plenty' },
  { value: 0, label: 'lost transactions' },
];

export default function Why() {
  return (
    <section id="why" className="bg-surface py-20 sm:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Why shops choose it</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Built to be fast, private and honest</h2>
        </Reveal>

        <Reveal group className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <RevealItem key={s.label}>
              <div className="card-surface h-full p-5 text-center">
                <p className="text-3xl font-extrabold tracking-tight text-primary">
                  {s.prefix}<NumberTicker value={s.value} format={(n) => Math.round(n).toLocaleString('en-IN')} />{s.suffix}
                </p>
                <p className="mt-1 text-xs text-ink-soft">{s.label}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>

        <Reveal group className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {WHY.map((w) => (
            <RevealItem key={w.title}>
              <div className="card-surface lift h-full p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent"><w.icon size={20} /></span>
                <h3 className="mt-4 text-lg font-semibold">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{w.body}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
