import { useEffect, useState, type FormEvent } from 'react';
import { CASH_MOVEMENT_KINDS, type RegisterReport } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import Field from '../../components/Field.js';
import { formatPaise, parseOptional } from '../../lib/money.js';
import { Lock, LockOpen, Save } from 'lucide-react';

function useAmount(initial = '') {
  const [text, setText] = useState(initial);
  const paise = parseOptional(text, 2);
  return { text, setText, paise: paise ?? (text.trim() === '' ? 0 : null) };
}

export function OpenRegister({ onOpened }: { onOpened: () => void }) {
  const float = useAmount('0');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (float.paise === null) { setError('Enter the opening cash, e.g. 2000'); return; }
    try { await api.pos.openRegister({ openingCashPaise: float.paise }); onOpened(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <form onSubmit={submit} className="card max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Open the register</h1>
      <p className="text-sm text-muted-foreground">Count the cash in the drawer and enter it as the opening float.</p>
      <Field label="Opening cash (₹)" htmlFor="float"><input id="float" className="input" inputMode="decimal" value={float.text} onChange={(e) => float.setText(e.target.value)} autoFocus /></Field>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn-primary"><LockOpen size={16} aria-hidden />Open register</button>
    </form>
  );
}

const KIND_LABEL: Record<(typeof CASH_MOVEMENT_KINDS)[number], string> = { cash_in: 'Cash in', cash_out: 'Cash out', safe_drop: 'Safe drop' };

export function CashMovementDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<(typeof CASH_MOVEMENT_KINDS)[number]>('cash_out');
  const amount = useAmount();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!amount.paise) { setError('Enter an amount'); return; }
    try { await api.pos.cashMovement({ kind, amountPaise: amount.paise, reason }); onClose(); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title="Cash in / out" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <fieldset className="flex gap-4">
          <legend className="label">Type</legend>
          {CASH_MOVEMENT_KINDS.map((k) => <label key={k} className="flex items-center gap-1 text-sm"><input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{KIND_LABEL[k]}</label>)}
        </fieldset>
        <Field label="Amount (₹)" htmlFor="cm-amount"><input id="cm-amount" className="input" inputMode="decimal" value={amount.text} onChange={(e) => amount.setText(e.target.value)} /></Field>
        <Field label="Reason" htmlFor="cm-reason"><input id="cm-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={200} /></Field>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save</button>
      </form>
    </Dialog>
  );
}

export function ReportView({ report }: { report: RegisterReport }) {
  const row = (label: string, value: string, strong = false) => (
    <tr className={strong ? 'font-semibold' : ''}><td className="py-1 pr-4 text-muted-foreground">{label}</td><td className="py-1 text-right tabular-nums">{value}</td></tr>
  );
  return (
    <table className="w-full text-sm"><tbody>
      {row(report.final ? `Z report #${report.sessionNo}` : `X report (session ${report.sessionNo})`, report.final ? 'final' : 'live', true)}
      {row('Opened', new Date(report.openedAt).toLocaleString('en-IN'))}
      {report.closedAt && row('Closed', new Date(report.closedAt).toLocaleString('en-IN'))}
      {row('Sales', `${report.salesCount} · ${formatPaise(report.salesTotalPaise)}`)}
      {row('Tax collected', formatPaise(report.taxPaise))}
      {report.byTender.map((t) => row(`  ${t.method.toUpperCase()}`, formatPaise(t.amountPaise)))}
      {row('Opening cash', formatPaise(report.openingCashPaise))}
      {row('Cash in', formatPaise(report.cashInPaise))}
      {row('Cash out', formatPaise(report.cashOutPaise))}
      {row('Safe drops', formatPaise(report.safeDropPaise))}
      {!!report.returnsCount && row(`Credit notes (${report.returnsCount})`, formatPaise(report.returnsTotalPaise ?? 0))}
      {!!report.cashRefundPaise && row('Cash refunded', formatPaise(report.cashRefundPaise))}
      {row('Expected cash', report.expectedCashPaise === null ? 'hidden (blind close)' : formatPaise(report.expectedCashPaise), true)}
      {report.countedCashPaise !== undefined && row('Counted cash', formatPaise(report.countedCashPaise), true)}
      {report.variancePaise !== undefined && row('Variance', formatPaise(report.variancePaise), true)}
    </tbody></table>
  );
}

export function XReportDialog({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<RegisterReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.pos.xReport({}).then(setReport, (e) => setError(errorMessage(e))); }, []);
  return <Dialog title="X report" onClose={onClose}>{error ? <p className="err">{error}</p> : report ? <ReportView report={report} /> : <p>Loading…</p>}</Dialog>;
}

export function CloseRegisterDialog({ onClose, onClosed }: { onClose: () => void; onClosed: (z: RegisterReport) => void }) {
  const counted = useAmount();
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (counted.paise === null || counted.text.trim() === '') { setError('Count the cash and enter the total'); return; }
    try { onClosed(await api.pos.closeRegister({ countedCashPaise: counted.paise })); } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Dialog title="Close register" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Counted cash (₹)" htmlFor="counted" hint="All cash in the drawer, including the opening float">
          <input id="counted" className="input" inputMode="decimal" value={counted.text} onChange={(e) => counted.setText(e.target.value)} />
        </Field>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn-primary"><Lock size={16} aria-hidden />Close and print Z report</button>
      </form>
    </Dialog>
  );
}
