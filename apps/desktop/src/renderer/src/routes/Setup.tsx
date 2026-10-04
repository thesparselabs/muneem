import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { BusinessInput, BranchInput, TerminalInput } from '@muneem/contracts';
type BusinessInputT = z.infer<typeof BusinessInput>;
type BranchInputT = z.infer<typeof BranchInput>;
type TerminalInputT = z.infer<typeof TerminalInput>;
import { api, errorMessage } from '../api.js';
import { useUi } from '../store.js';
import Field from '../components/Field.js';
import { GST_STATES } from '../states.js';
import SetupAddDevice from './SetupAddDevice.js';

type Step = 1 | 2 | 3;

export default function Setup() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { session } = useUi();
  const hydration = useQuery({ queryKey: ['hydration', session?.businessId], queryFn: () => api.sync.hydrationStatus({}), enabled: !!session });
  const [addDevice, setAddDevice] = useState(false);
  const held = !!hydration.data?.held;
  const business = useQuery({ queryKey: ['business'], queryFn: () => api.business.get({}), enabled: !!session?.businessId && !held });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}), enabled: !!session?.businessId && !held });
  const terminals = useQuery({ queryKey: ['terminals'], queryFn: () => api.business.getTerminals({}), enabled: !!session?.businessId && !held });
  const step: Step = !session?.businessId ? 1 : !branches.data?.length ? 2 : 3;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await qc.invalidateQueries(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center py-8">
      <div className="card w-[720px]">
        <ol className="flex gap-6 text-sm mb-6" aria-label="Setup progress">
          {(['Business', 'Branch', 'Terminal'] as const).map((t, i) => (
            <li key={t} className={`flex items-center gap-2 ${step === i + 1 ? 'font-semibold text-blue-700' : step > i + 1 ? 'text-green-700' : 'text-slate-400'}`} aria-current={step === i + 1 ? 'step' : undefined}>
              <span className="w-6 h-6 rounded-full border grid place-items-center text-xs">{step > i + 1 ? '✓' : i + 1}</span>{t}
            </li>
          ))}
        </ol>
        {error && <p className="err mb-3" role="alert">{error}</p>}
        {(held || addDevice) && <SetupAddDevice onReady={() => { setAddDevice(false); void qc.invalidateQueries(); }} {...(!held && { onCancel: () => setAddDevice(false) })} />}
        {!held && !addDevice && step === 1 && (
          <button type="button" className="btn-secondary mb-4" onClick={() => setAddDevice(true)}>Add this device to an existing business</button>
        )}
        {!held && !addDevice && step === 1 && <BusinessForm busy={busy} onSubmit={(v) => run(() => api.business.create(v))} />}
        {!held && !addDevice && step === 2 && <BranchForm busy={busy} businessState={business.data?.stateCode ?? '07'} gstin={business.data?.gstin} onSubmit={(v) => run(() => api.business.createBranch(v))} />}
        {!held && !addDevice && step === 3 && (
          <TerminalForm busy={busy} branchId={branches.data![0]!.id} existing={terminals.data ?? []}
            onCreate={(v) => run(() => api.business.createTerminal(v))}
            onSelect={(terminalId) => run(async () => { await api.business.selectTerminal({ terminalId }); nav('/'); })} />
        )}
      </div>
    </main>
  );
}

function BusinessForm({ onSubmit, busy }: { onSubmit: (v: BusinessInputT) => void; busy: boolean }) {
  const [f, setF] = useState({ name: '', legalName: '', businessType: 'retail', stateCode: '07', city: '', pinCode: '', phone: '', gstin: '', pan: '', taxScheme: 'regular' });
  const [err, setErr] = useState<Record<string, string>>({});
  function submit(e: FormEvent) {
    e.preventDefault();
    const raw = { ...f, legalName: f.legalName || undefined, city: f.city || undefined, pinCode: f.pinCode || undefined, phone: f.phone || undefined, gstin: f.gstin.toUpperCase() || undefined, pan: f.pan.toUpperCase() || undefined };
    const r = BusinessInput.safeParse(raw);
    if (!r.success) { setErr(Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))); return; }
    setErr({}); onSubmit(r.data);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-4">
      <h2 className="col-span-2 text-lg font-semibold">Your business</h2>
      <Field label="Business name" htmlFor="name"><input id="name" className="input" value={f.name} onChange={set('name')} required autoFocus />{err.name && <p className="err">{err.name}</p>}</Field>
      <Field label="Legal name (optional)" htmlFor="legalName"><input id="legalName" className="input" value={f.legalName} onChange={set('legalName')} /></Field>
      <Field label="Business type" htmlFor="businessType">
        <select id="businessType" className="input" value={f.businessType} onChange={set('businessType')}>
          {['retail', 'wholesale', 'distribution', 'service', 'restaurant', 'trading', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="State" htmlFor="stateCode">
        <select id="stateCode" className="input" value={f.stateCode} onChange={set('stateCode')}>{GST_STATES.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select>
      </Field>
      <Field label="City" htmlFor="city"><input id="city" className="input" value={f.city} onChange={set('city')} /></Field>
      <Field label="PIN code" htmlFor="pinCode"><input id="pinCode" className="input" value={f.pinCode} onChange={set('pinCode')} inputMode="numeric" />{err.pinCode && <p className="err">{err.pinCode}</p>}</Field>
      <Field label="Phone" htmlFor="phone"><input id="phone" className="input" value={f.phone} onChange={set('phone')} /></Field>
      <fieldset className="col-span-2">
        <legend className="label">GST scheme</legend>
        <div className="flex gap-6">
          {([['regular', 'Regular (tax invoice)'], ['composition', 'Composition (bill of supply)'], ['unregistered', 'Not GST registered']] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-sm"><input type="radio" name="taxScheme" value={v} checked={f.taxScheme === v} onChange={set('taxScheme')} />{l}</label>
          ))}
        </div>
      </fieldset>
      {f.taxScheme !== 'unregistered' && (
        <Field label="GSTIN" htmlFor="gstin" hint="15 characters, e.g. 07AAAAA0000A1Z5"><input id="gstin" className="input uppercase" value={f.gstin} onChange={set('gstin')} maxLength={15} />{err.gstin && <p className="err">{err.gstin}</p>}</Field>
      )}
      <Field label="PAN (optional)" htmlFor="pan"><input id="pan" className="input uppercase" value={f.pan} onChange={set('pan')} maxLength={10} />{err.pan && <p className="err">{err.pan}</p>}</Field>
      <div className="col-span-2 flex justify-end"><button type="submit" className="btn-primary" disabled={busy}>Save and continue</button></div>
    </form>
  );
}

function BranchForm({ onSubmit, busy, businessState, gstin }: { onSubmit: (v: BranchInputT) => void; busy: boolean; businessState: string; gstin?: string | undefined }) {
  const [f, setF] = useState({ code: 'MAIN', name: 'Main store', stateCode: businessState, city: '', addressLine1: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = BranchInput.safeParse({ ...f, code: f.code.toUpperCase(), city: f.city || undefined, addressLine1: f.addressLine1 || undefined, gstin, isDefault: true });
    if (!r.success) { setErr(Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))); return; }
    onSubmit(r.data);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-4">
      <h2 className="col-span-2 text-lg font-semibold">First branch (store)</h2>
      <Field label="Branch code" htmlFor="code" hint="2–8 letters/digits; appears in invoice numbers"><input id="code" className="input uppercase" value={f.code} onChange={set('code')} required autoFocus />{err.code && <p className="err">{err.code}</p>}</Field>
      <Field label="Branch name" htmlFor="bname"><input id="bname" className="input" value={f.name} onChange={set('name')} required /></Field>
      <Field label="Address" htmlFor="addr"><input id="addr" className="input" value={f.addressLine1} onChange={set('addressLine1')} /></Field>
      <Field label="City" htmlFor="bcity"><input id="bcity" className="input" value={f.city} onChange={set('city')} /></Field>
      <Field label="State" htmlFor="bstate"><select id="bstate" className="input" value={f.stateCode} onChange={set('stateCode')}>{GST_STATES.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select></Field>
      <div className="col-span-2 flex justify-end"><button type="submit" className="btn-primary" disabled={busy}>Save and continue</button></div>
    </form>
  );
}

function TerminalForm({ branchId, existing, onCreate, onSelect, busy }: { branchId: string; existing: { id: string; code: string; name: string; invoicePrefix: string; deviceId: string | null }[]; onCreate: (v: TerminalInputT) => void; onSelect: (id: string) => void; busy: boolean }) {
  const [f, setF] = useState({ code: `T${String(existing.length + 1).padStart(2, '0')}`, name: `Counter ${existing.length + 1}`, invoicePrefix: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = TerminalInput.safeParse({ branchId, code: f.code.toUpperCase(), name: f.name, ...(f.invoicePrefix && { invoicePrefix: f.invoicePrefix.toUpperCase() }) });
    if (!r.success) { setErr(Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))); return; }
    onCreate(r.data);
  }
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">This computer’s till (terminal)</h2>
      {existing.length > 0 && (
        <div>
          <p className="text-sm text-slate-600 mb-2">Use an existing terminal on this computer:</p>
          <ul className="divide-y border rounded-md">
            {existing.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><b>{t.code}</b> · {t.name} · invoices {t.invoicePrefix}/…{t.deviceId && <span className="ml-2 text-xs text-slate-500">(bound to a device)</span>}</span>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => onSelect(t.id)}>Use this terminal</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <p className="col-span-2 text-sm text-slate-600">Or create a new one. Each terminal keeps its own invoice series, so two tills never clash — even offline.</p>
        <Field label="Terminal code" htmlFor="tcode"><input id="tcode" className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required autoFocus />{err.code && <p className="err">{err.code}</p>}</Field>
        <Field label="Terminal name" htmlFor="tname"><input id="tname" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Invoice prefix (optional)" htmlFor="tprefix" hint="1–4 letters or digits, e.g. D1. Bills are numbered D1/2627/000001. Leave empty to have one suggested.">
          <input id="tprefix" className="input uppercase" maxLength={4} value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} />{err.invoicePrefix && <p className="err">{err.invoicePrefix}</p>}
        </Field>
        <div className="col-span-2 flex justify-end"><button type="submit" className="btn-primary" disabled={busy}>Create terminal</button></div>
      </form>
    </div>
  );
}
