import { useState, type FormEvent } from 'react';
import type { DiscountInput } from '@muneem/contracts';
import Dialog from '../../components/Dialog.js';
import Field from '../../components/Field.js';
import { scaledToText } from '../../lib/money.js';
import { parseDiscount } from '../../lib/pos/discount.js';
import { Check } from 'lucide-react';

// Percent is stored in basis points and amounts in paise, as the GST engine expects.
export default function DiscountDialog({ title, current, onApply, onClose }: { title: string; current: DiscountInput; onApply: (d: DiscountInput) => void; onClose: () => void }) {
  const [kind, setKind] = useState(current.kind);
  const [text, setText] = useState(current.value ? scaledToText(current.value, 2) : '');
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseDiscount(kind, text);
    if (!parsed.ok) { setError(parsed.error); return; }
    onApply(parsed.discount);
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <fieldset className="flex gap-4">
          <legend className="label">Discount as</legend>
          <label className="flex items-center gap-1 text-sm"><input type="radio" name="dk" checked={kind === 'percent'} onChange={() => setKind('percent')} />Percent</label>
          <label className="flex items-center gap-1 text-sm"><input type="radio" name="dk" checked={kind === 'amount'} onChange={() => setKind('amount')} />Amount (₹)</label>
        </fieldset>
        <Field label={kind === 'percent' ? 'Percent' : 'Amount (₹)'} htmlFor="disc"><input id="disc" className="input" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <p className="text-xs text-muted-foreground">Discounts are taken before GST. Your role may limit how much you can give.</p>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="flex gap-2"><button type="submit" className="btn-primary"><Check size={16} aria-hidden />Apply</button><button type="button" className="btn-secondary" onClick={() => onApply({ kind: 'amount', value: 0 })}>Remove discount</button></div>
      </form>
    </Dialog>
  );
}
