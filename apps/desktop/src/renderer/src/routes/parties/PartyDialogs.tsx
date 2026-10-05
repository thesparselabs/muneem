import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { newUlid } from '@muneem/domain';
import type { Customer, OpenItems, PartyType, Supplier } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import DatePicker from '../../components/DatePicker.js';
import Field from '../../components/Field.js';
import { formatPaise, parseOptional, paiseToText } from '../../lib/money.js';
import {
  creditLimitText, customerFormToInput, customerToForm, emptySupplierForm, parseCreditLimit, supplierFormToInput, supplierToForm, type SupplierForm,
} from '../../lib/parties/forms.js';
import { Eraser, Save } from 'lucide-react';

const today = () => new Date().toLocaleDateString('en-CA');

function Errors({ errors }: { errors: Record<string, string> | string | null }) {
  if (!errors) return null;
  const text = typeof errors === 'string' ? errors : Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; ');
  return text ? <p className="err" role="alert">{text}</p> : null;
}

export function SupplierDialog({ supplier, defaultState, onDone, onClose }: { supplier?: Supplier; defaultState: string; onDone: (s: Supplier) => void; onClose: () => void }) {
  const [f, setF] = useState<SupplierForm>(supplier ? supplierToForm(supplier) : emptySupplierForm(defaultState));
  const [errors, setErrors] = useState<Record<string, string> | string | null>(null);
  const set = (patch: Partial<SupplierForm>) => setF({ ...f, ...patch });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = supplierFormToInput(f);
    if (!r.ok) { setErrors(r.errors); return; }
    try {
      onDone(supplier ? await api.suppliers.update({ ...r.input, id: supplier.id, version: supplier.version }) : await api.suppliers.create(r.input));
    } catch (err) { setErrors(errorMessage(err)); }
  }
  return (
    <Dialog title={supplier ? `Edit ${supplier.name}` : 'New supplier'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="sp-name"><input id="sp-name" className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <Field label="GST scheme" htmlFor="sp-scheme">
          <select id="sp-scheme" className="select" value={f.taxScheme} onChange={(e) => set({ taxScheme: e.target.value as SupplierForm['taxScheme'] })}>
            <option value="regular">Regular (charges GST)</option><option value="composition">Composition</option><option value="unregistered">Unregistered</option>
          </select>
        </Field>
        <Field label="GSTIN" htmlFor="sp-gstin" hint="Sets the state"><input id="sp-gstin" className="input uppercase" maxLength={15} value={f.gstin} onChange={(e) => set({ gstin: e.target.value })} disabled={f.taxScheme === 'unregistered'} /></Field>
        <Field label="State code" htmlFor="sp-state"><input id="sp-state" className="input" maxLength={2} value={f.gstin.trim() ? f.gstin.trim().slice(0, 2) : f.stateCode} onChange={(e) => set({ stateCode: e.target.value })} disabled={!!f.gstin.trim()} /></Field>
        <Field label="Phone" htmlFor="sp-phone"><input id="sp-phone" className="input" inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Credit days" htmlFor="sp-days" hint="Bills fall due this many days after their date"><input id="sp-days" className="input" inputMode="numeric" value={f.creditDays} onChange={(e) => set({ creditDays: e.target.value })} /></Field>
        <Field label="Address" htmlFor="sp-addr"><input id="sp-addr" className="input" value={f.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} /></Field>
        <Field label="City" htmlFor="sp-city"><input id="sp-city" className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <div className="col-span-2 space-y-2"><Errors errors={errors} /><button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save supplier</button></div>
      </form>
    </Dialog>
  );
}

export function CustomerEditDialog({ customer, onDone, onClose }: { customer?: Customer; onDone: (c: Customer) => void; onClose: () => void }) {
  const [f, setF] = useState(customerToForm(customer));
  const [errors, setErrors] = useState<Record<string, string> | string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = customerFormToInput(f);
    if (!r.ok) { setErrors(r.errors); return; }
    try {
      onDone(customer ? await api.customers.update({ ...r.input, id: customer.id, version: customer.version }) : await api.customers.create(r.input));
    } catch (err) { setErrors(errorMessage(err)); }
  }
  return (
    <Dialog title={customer ? `Edit ${customer.name}` : 'New customer'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" htmlFor="cu-name"><input id="cu-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Phone" htmlFor="cu-phone"><input id="cu-phone" className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="GSTIN" htmlFor="cu-gstin"><input id="cu-gstin" className="input uppercase" maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} /></Field>
        {!f.gstin.trim() && <Field label="State code" htmlFor="cu-state" hint="For the place of supply on their bills"><input id="cu-state" className="input" maxLength={2} value={f.stateCode} onChange={(e) => setF({ ...f, stateCode: e.target.value })} /></Field>}
        <Field label="Email" htmlFor="cu-email"><input id="cu-email" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Address" htmlFor="cu-addr"><input id="cu-addr" className="input" value={f.addressLine1} onChange={(e) => setF({ ...f, addressLine1: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" htmlFor="cu-city"><input id="cu-city" className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="PIN code" htmlFor="cu-pin"><input id="cu-pin" className="input" inputMode="numeric" maxLength={6} value={f.pinCode} onChange={(e) => setF({ ...f, pinCode: e.target.value })} /></Field>
        </div>
        <Field label="Credit days" htmlFor="cu-days"><input id="cu-days" className="input" inputMode="numeric" value={f.creditDays} onChange={(e) => setF({ ...f, creditDays: e.target.value })} /></Field>
        <Errors errors={errors} />
        <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save customer</button>
      </form>
    </Dialog>
  );
}

export function CreditLimitDialog({ customer, onDone, onClose }: { customer: Customer; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState(creditLimitText(customer.creditLimitPaise));
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = parseCreditLimit(text);
    if (!r.ok) { setError(r.error); return; }
    try { await api.customers.setCreditLimit({ id: customer.id, version: customer.version, limitPaise: r.limitPaise }); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title={`Credit limit · ${customer.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Limit (₹)" htmlFor="cl-amount" hint="Empty = no limit set: credit then needs a manager every time">
          <input id="cl-amount" className="input" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Errors errors={error} />
        <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save limit</button>
      </form>
    </Dialog>
  );
}

export function OpeningDialog({ partyType, partyId, onDone, onClose }: { partyType: PartyType; partyId: string; onDone: () => void; onClose: () => void }) {
  const usual = partyType === 'customer' ? 'receivable' : 'payable';
  const [f, setF] = useState({ side: usual as 'receivable' | 'payable', amount: '', asOf: today() });
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const amountPaise = parseOptional(f.amount, 2);
    if (!amountPaise || amountPaise <= 0) { setError('Enter the amount'); return; }
    const input = { partyId, side: f.side, amountPaise, asOfDate: f.asOf };
    try { await (partyType === 'customer' ? api.customers.setOpening(input) : api.suppliers.setOpening(input)); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title="Opening balance" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">Entering a new opening replaces the current one.</p>
        <Field label="Who owes whom" htmlFor="op-side">
          <select id="op-side" className="select" value={f.side} onChange={(e) => setF({ ...f, side: e.target.value as typeof f.side })}>
            <option value="receivable">They owe us</option><option value="payable">We owe them</option>
          </select>
        </Field>
        <Field label="Amount (₹)" htmlFor="op-amount"><input id="op-amount" className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="As of" htmlFor="op-date"><DatePicker id="op-date" value={f.asOf} onChange={(v) => setF({ ...f, asOf: v })} /></Field>
        <Errors errors={error} />
        <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save opening balance</button>
      </form>
    </Dialog>
  );
}

// ADR-0025: writes off exactly the amounts typed against the customer's open items.
export function WriteOffDialog({ customer, items, onDone, onClose }: { customer: Customer; items: OpenItems['charges']; onDone: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, paiseToText(i.openPaise)])));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [commandId] = useState(newUlid);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const chosen = [];
    for (const i of items) {
      const v = parseOptional(amounts[i.id] ?? '', 2);
      if (v === undefined || v === 0) continue;
      if (v === null || v < 0 || v > i.openPaise) { setError(`Check the amount for ${i.docNumber ?? i.type}`); return; }
      chosen.push({ type: i.type as 'sale' | 'opening', id: i.id, amountPaise: v });
    }
    if (chosen.length === 0) { setError('Nothing to write off'); return; }
    try { await api.payments.writeOff({ customerId: customer.id, items: chosen, reason, commandId }); await qc.invalidateQueries(); onDone(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title={`Write off · ${customer.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <table className="table-modern">
          <thead><tr><th>Document</th><th>Due</th><th className="text-right">Open</th><th>Write off (₹)</th></tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id}><td>{i.docNumber ?? i.type}</td><td>{i.dueDate}</td><td className="text-right">{formatPaise(i.openPaise)}</td>
              <td><input aria-label={`Write off ${i.docNumber ?? i.type}`} className="input py-1" inputMode="decimal" value={amounts[i.id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [i.id]: e.target.value })} /></td></tr>
          ))}</tbody>
        </table>
        <Field label="Reason" htmlFor="wo-reason"><input id="wo-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
        <Errors errors={error} />
        <button type="submit" className="btn-primary"><Eraser size={16} aria-hidden />Write off</button>
      </form>
    </Dialog>
  );
}
