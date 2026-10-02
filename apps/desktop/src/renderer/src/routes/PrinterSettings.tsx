import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PrinterConfig } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import Field from '../components/Field.js';

type Form = { kind: PrinterConfig['kind']; host: string; port: string; widthChars: PrinterConfig['widthChars']; openDrawer: boolean };

export default function PrinterSettings() {
  const config = useQuery({ queryKey: ['printerConfig'], queryFn: () => api.printer.getConfig({}) });
  const [f, setF] = useState<Form | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (config.data && !f) setF({ ...config.data, host: config.data.host ?? '', port: String(config.data.port) });
  }, [config.data, f]);
  if (!f) return <p className="text-sm text-slate-500">Loading…</p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = PrinterConfig.safeParse({ kind: f!.kind, ...(f!.host && { host: f!.host }), port: Number(f!.port), widthChars: f!.widthChars, openDrawer: f!.openDrawer });
    if (!parsed.success) { setMessage(parsed.error.issues.map((i) => i.message).join('; ')); return; }
    try { await api.printer.setConfig(parsed.data); setMessage('Saved.'); } catch (err) { setMessage(errorMessage(err)); }
  }
  async function run(fn: () => Promise<unknown>, done: string) {
    try { await fn(); setMessage(done); } catch (err) { setMessage(errorMessage(err)); }
  }

  return (
    <form onSubmit={save} className="card max-w-xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">Receipt printer</h1><Link to="/pos" className="btn-secondary">Back to billing</Link></div>
      <fieldset className="space-y-1">
        <legend className="label">Printer</legend>
        {([['simulator', 'No printer yet: save receipts as files (for checking)'], ['network', 'Network printer (LAN / Wi-Fi, port 9100)'], ['none', 'Do not print']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="kind" checked={f.kind === k} onChange={() => setF({ ...f, kind: k })} />{label}</label>
        ))}
      </fieldset>
      {f.kind === 'network' && (
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Printer address" htmlFor="host" hint="e.g. 192.168.1.50"><input id="host" className="input" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} /></Field>
          <Field label="Port" htmlFor="port"><input id="port" className="input" inputMode="numeric" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} /></Field>
        </div>
      )}
      <Field label="Paper width" htmlFor="width">
        <select id="width" className="input" value={f.widthChars} onChange={(e) => setF({ ...f, widthChars: Number(e.target.value) as Form['widthChars'] })}>
          <option value={32}>58 mm (32 characters)</option><option value={42}>80 mm (42 characters)</option><option value={48}>80 mm (48 characters)</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.openDrawer} onChange={(e) => setF({ ...f, openDrawer: e.target.checked })} />Open the cash drawer after cash sales</label>
      {message && <p className="text-sm" role="status">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Save</button>
        <button type="button" className="btn-secondary" onClick={() => void run(() => api.printer.testPrint({}), 'Test page sent.')}>Print test page</button>
        <button type="button" className="btn-secondary" onClick={() => void run(() => api.drawer.open({}), 'Drawer opened.')}>Open drawer</button>
      </div>
    </form>
  );
}
