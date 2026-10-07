import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api.js';
import Field from '../components/Field.js';
import { configToForm, formToConfig, type PrinterForm } from '../lib/printerForm.js';
import { Printer, ArrowLeft, Save, RefreshCw } from 'lucide-react';

const KINDS = [
  ['simulator', 'No printer yet: save receipts as files (for checking)'],
  ['spooler', 'Printer installed in Windows (USB / driver)'],
  ['network', 'Network printer (LAN / Wi-Fi, port 9100)'],
  ['none', 'Do not print'],
] as const;

export default function PrinterSettings() {
  const config = useQuery({ queryKey: ['printerConfig'], queryFn: () => api.printer.getConfig({}) });
  const [f, setF] = useState<PrinterForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const installed = useQuery({ queryKey: ['installedPrinters'], queryFn: () => api.printer.listInstalled({}), enabled: f?.kind === 'spooler' });
  useEffect(() => {
    if (config.data && !f) setF(configToForm(config.data));
  }, [config.data, f]);
  if (!f) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    const r = formToConfig(f!);
    if (!r.ok) { setMessage(r.message); return; }
    try { await api.printer.setConfig(r.config); setMessage('Saved.'); } catch (err) { setMessage(errorMessage(err)); }
  }
  async function run(fn: () => Promise<unknown>, done: string) {
    try { await fn(); setMessage(done); } catch (err) { setMessage(errorMessage(err)); }
  }
  const printers = installed.data ?? [];
  const missing = f.printerName && installed.isSuccess && !printers.some((p) => p.name === f.printerName);

  return (
    <form onSubmit={save} className="card max-w-xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-xl font-semibold"><Printer size={20} className="text-primary" aria-hidden />Receipt printer</h1><Link to="/pos" className="btn-secondary px-2.5" aria-label="Back to billing" title="Back to billing"><ArrowLeft size={16} aria-hidden /></Link></div>
      <fieldset className="space-y-1">
        <legend className="label">Printer</legend>
        {KINDS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="kind" checked={f.kind === k} onChange={() => setF({ ...f, kind: k })} />{label}</label>
        ))}
      </fieldset>
      {f.kind === 'network' && (
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Printer address" htmlFor="host" hint="e.g. 192.168.1.50"><input id="host" className="input" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} /></Field>
          <Field label="Port" htmlFor="port"><input id="port" className="input" inputMode="numeric" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} /></Field>
        </div>
      )}
      {f.kind === 'spooler' && (
        <>
          <Field label="Windows printer" htmlFor="printerName" {...(installed.isSuccess && printers.length === 0 && { hint: 'Windows lists no printers on this computer. Install the printer driver first.' })}>
            <div className="flex gap-2">
              <select id="printerName" className="input" value={f.printerName} onChange={(e) => setF({ ...f, printerName: e.target.value })}>
                <option value="">{installed.isLoading ? 'Looking for printers…' : 'Choose a printer'}</option>
                {missing && <option value={f.printerName}>{f.printerName} (not found)</option>}
                {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}</option>)}
              </select>
              <button type="button" className="btn-secondary px-2.5" aria-label="Refresh printer list" title="Refresh printer list" onClick={() => void installed.refetch()}><RefreshCw size={16} aria-hidden /></button>
            </div>
          </Field>
          {installed.isError && <p className="text-sm text-destructive" role="alert">{errorMessage(installed.error)}</p>}
          <fieldset className="space-y-1">
            <legend className="label">How to send receipts</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={f.mode === 'escpos'} onChange={() => setF({ ...f, mode: 'escpos' })} />Receipt printer commands (ESC/POS) — fastest; most thermal printers</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={f.mode === 'image'} onChange={() => setF({ ...f, mode: 'image' })} />As a picture through the Windows driver — for printers that print garbage with the first option</label>
          </fieldset>
        </>
      )}
      <Field label="Paper width" htmlFor="width">
        <select id="width" className="input" value={f.widthChars} onChange={(e) => setF({ ...f, widthChars: Number(e.target.value) as PrinterForm['widthChars'] })}>
          <option value={32}>58 mm (32 characters)</option><option value={42}>80 mm (42 characters)</option><option value={48}>80 mm (48 characters)</option>
        </select>
      </Field>
      <fieldset className="space-y-1">
        <legend className="label">Rupee sign on the total</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="rupee" checked={f.rupee === 'symbol'} onChange={() => setF({ ...f, rupee: 'symbol' })} />₹</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="rupee" checked={f.rupee === 'Rs'} onChange={() => setF({ ...f, rupee: 'Rs' })} />Rs (plain text)</label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.openDrawer} onChange={(e) => setF({ ...f, openDrawer: e.target.checked })} />Open the cash drawer after cash sales</label>
      {message && <p className="text-sm" role="status">{message}</p>}
      <p className="text-xs text-muted-foreground">Save first, then print a test page: it shows ₹, Hindi and Tamil so you can check them on paper.</p>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary"><Save size={16} aria-hidden />Save</button>
        <button type="button" className="btn-secondary" onClick={() => void run(() => api.printer.testPrint({}), 'Test page sent.')}>Print test page</button>
        <button type="button" className="btn-secondary" onClick={() => void run(() => api.drawer.open({}), 'Drawer opened.')}>Open drawer</button>
      </div>
    </form>
  );
}
