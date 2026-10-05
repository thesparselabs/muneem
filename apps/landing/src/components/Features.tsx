import Reveal, { RevealItem } from './Reveal.tsx';
import { FEATURES } from '../site.ts';

export default function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Everything the counter needs</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">One app, from the first bill to the balance sheet</h2>
          <p className="mt-3 text-ink-soft">No stitched-together tools. Billing, stock, parties, GST and real accounting share one set of books.</p>
        </Reveal>
        <Reveal group className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <RevealItem key={f.title}>
              <div className="card-surface lift h-full p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon size={20} /></span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
