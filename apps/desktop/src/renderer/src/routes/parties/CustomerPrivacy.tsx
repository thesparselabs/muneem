import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CONSENT_METHODS, type Customer, type CustomerConsent } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import Field from '../../components/Field.js';
import { CHANNEL_LABEL, METHOD_LABEL, channelsToAsk, consentRows, eraseBlocker } from '../../lib/parties/consent.js';
import { useCan } from '../../lib/permissions.js';

// FR-104 / ADR-0050: consent to be messaged, a copy of what is held, and erasure of the profile.
export default function CustomerPrivacy({ customer, balancePaise }: { customer: Customer; balancePaise: number | undefined }) {
  const qc = useQueryClient();
  const canRecord = useCan('customers.create');
  const canManage = useCan('customers.approve');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const ask = channelsToAsk(customer.consents);
  const [form, setForm] = useState<{ channel: CustomerConsent['channel'] | ''; method: CustomerConsent['method'] }>({ channel: '', method: 'in_person' });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['party', 'customer', customer.id] });
  const run = async (f: () => Promise<unknown>) => {
    try { await f(); setError(null); refresh(); } catch (e) { setError(errorMessage(e)); }
  };
  async function record(e: FormEvent) {
    e.preventDefault();
    const channel = form.channel || ask[0];
    if (!channel) return;
    await run(() => api.customers.setConsent({ customerId: customer.id, channel, method: form.method }));
  }
  async function exportAs(format: 'json' | 'csv') {
    try {
      const r = await api.customers.exportProfile({ customerId: customer.id, format });
      setNote(r.saved ? `Saved ${r.fileName}` : null);
    } catch (e) { setError(errorMessage(e)); }
  }
  if (customer.erasedAt) {
    return <div className="card text-sm text-slate-700">This customer's profile was erased on {customer.erasedAt.slice(0, 10)} at their request. Their invoices are kept as the law requires.</div>;
  }
  const rows = consentRows(customer.consents);
  const blocker = eraseBlocker(balancePaise);
  return (
    <section className="card space-y-3" aria-labelledby="privacy-h">
      <div className="flex items-center justify-between">
        <h2 id="privacy-h" className="font-semibold">Consent and privacy</h2>
        {canManage && (
          <div className="flex gap-2 text-sm">
            <button type="button" className="btn-secondary py-1" onClick={() => void exportAs('json')}>Export profile (JSON)</button>
            <button type="button" className="btn-secondary py-1" onClick={() => void exportAs('csv')}>Export (CSV)</button>
            <button type="button" className="btn-secondary py-1 text-red-700" onClick={() => setErasing(true)}>Erase profile…</button>
          </div>
        )}
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No consent to send payment reminders has been recorded.</p> : (
        <ul className="text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-t py-1">
              <span className={r.active ? '' : 'text-slate-500'}>{r.text} <span className="text-xs text-slate-500">({r.when})</span></span>
              {r.active && canRecord && <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => void run(() => api.customers.withdrawConsent({ customerId: customer.id, consentId: r.id }))}>Withdraw</button>}
            </li>
          ))}
        </ul>
      )}
      {canRecord && ask.length > 0 && (
        <form onSubmit={record} className="flex items-end gap-2 text-sm">
          <Field label="Channel" htmlFor="consent-channel">
            <select id="consent-channel" className="input" value={form.channel || ask[0]} onChange={(e) => setForm({ ...form, channel: e.target.value as CustomerConsent['channel'] })}>
              {ask.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="How it was given" htmlFor="consent-method">
            <select id="consent-method" className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as CustomerConsent['method'] })}>
              {CONSENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
          <button type="submit" className="btn-primary">Record consent</button>
        </form>
      )}
      {note && <p className="text-sm text-green-800" role="status">{note}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      {erasing && <EraseDialog customer={customer} blocker={blocker} onClose={() => setErasing(false)} onDone={() => { setErasing(false); refresh(); }} />}
    </section>
  );
}

function EraseDialog({ customer, blocker, onClose, onDone }: { customer: Customer; blocker: string | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.customers.erase({ customerId: customer.id, version: customer.version, reason }); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title={`Erase ${customer.name}'s profile`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <p>The name, phone, email, address and GSTIN are removed on every device and every consent is withdrawn. Invoices, receipts and the books keep the details they were issued with, as GST law requires. This cannot be undone.</p>
        {blocker && <p className="err" role="alert">{blocker}</p>}
        <Field label="Reason" htmlFor="erase-reason" hint="For the audit trail, e.g. “customer asked by phone on 5 Oct”">
          <input id="erase-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary bg-red-700" disabled={!!blocker || reason.trim().length < 3}>Erase profile</button>
      </form>
    </Dialog>
  );
}
