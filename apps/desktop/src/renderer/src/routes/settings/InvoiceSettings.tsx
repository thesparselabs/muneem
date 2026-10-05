import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ImageUp, Palette, Save, ArrowLeft } from 'lucide-react';
import type { InvoiceBranding, InvoiceTemplateId, InvoiceTemplateMeta } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Field from '../../components/Field.js';
import { fileToBase64 } from '../../lib/fileToBase64.js';
import { useToasts } from '../../lib/toast.js';
import { cn } from '../../lib/cn.js';
import { MOTION_FAST, usePrefersReducedMotion } from '../../lib/motion.js';

const dataUrl = (b64: string) => (b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);

export default function InvoiceSettings() {
  const templates = useQuery({ queryKey: ['invoiceTemplates'], queryFn: () => api.invoice.listTemplates({}) });
  const sample = useQuery({ queryKey: ['invoiceSampleSale'], queryFn: () => api.sales.list({ limit: 1 }) });
  const branding = useQuery({ queryKey: ['invoiceBranding'], queryFn: () => api.invoice.getBranding({}) });
  const [form, setForm] = useState<InvoiceBranding | null>(null);
  const [saving, setSaving] = useState(false);
  const push = useToasts((s) => s.push);
  const saleId = sample.data?.items[0]?.id ?? null;

  useEffect(() => { if (branding.data && !form) setForm(branding.data); }, [branding.data, form]);
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const set = (patch: Partial<InvoiceBranding>) => setForm((f) => ({ ...f!, ...patch }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.invoice.setBranding(form!);
      setForm(saved);
      push('Invoice design saved', 'success');
    } catch (err) { push(errorMessage(err), 'error'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Palette size={22} aria-hidden /> Invoice design</h1>
        <Link to="/pos" className="btn-secondary"><ArrowLeft size={16} aria-hidden />Back to billing</Link>
      </div>

      <section className="space-y-3" aria-label="Templates">
        <h2 className="text-lg font-semibold">Template</h2>
        {templates.error && <p className="err" role="alert">{errorMessage(templates.error)}</p>}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {templates.data?.templates.map((t) => (
            <TemplateCard key={t.id} template={t} saleId={saleId}
              active={form.templateId === t.id} onSelect={() => set({ templateId: t.id })} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4" aria-label="Branding">
          <h2 className="text-lg font-semibold">Branding</h2>
          <ImageField label="Logo" value={form.logoBase64} onChange={(b64) => set({ logoBase64: b64 })} />
          <div>
            <label className="label" htmlFor="accent">Accent colour</label>
            <div className="flex items-center gap-3">
              <input id="accent" type="color" className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-card p-1"
                value={form.accentColor} onChange={(e) => set({ accentColor: e.target.value })} />
              <span className="font-mono text-sm text-muted-foreground">{form.accentColor}</span>
            </div>
          </div>
          <Field label="Page size" htmlFor="pagesize" hint="For A4-style templates; thermal rolls use their own width.">
            <select id="pagesize" className="select" value={form.pageSize} onChange={(e) => set({ pageSize: e.target.value as InvoiceBranding['pageSize'] })}>
              <option value="a4">A4</option>
              <option value="a5">A5</option>
              <option value="letter">Letter (US)</option>
            </select>
          </Field>
          <label className="flex items-center justify-between gap-3">
            <span className="label mb-0">Show signature</span>
            <Toggle checked={form.showSignature} onChange={(v) => set({ showSignature: v })} label="Show signature" />
          </label>
          {form.showSignature && (
            <>
              <ImageField label="Signature" value={form.signatureBase64} onChange={(b64) => set({ signatureBase64: b64 })} />
              <Field label="Signatory name" htmlFor="signatory">
                <input id="signatory" className="input" value={form.signatoryName ?? ''} onChange={(e) => set({ signatoryName: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Terms &amp; conditions" htmlFor="terms">
            <textarea id="terms" className="input min-h-20" value={form.terms ?? ''} onChange={(e) => set({ terms: e.target.value })} />
          </Field>
          <Field label="Bank details" htmlFor="bank">
            <textarea id="bank" className="input min-h-20" value={form.bankDetails ?? ''} onChange={(e) => set({ bankDetails: e.target.value })} />
          </Field>
          <Field label="Footer note" htmlFor="footer">
            <input id="footer" className="input" value={form.footerNote} onChange={(e) => set({ footerNote: e.target.value })} />
          </Field>
          <button type="submit" className="btn-primary gap-1.5" disabled={saving}><Save size={16} aria-hidden /> {saving ? 'Saving…' : 'Save design'}</button>
        </section>

        <section className="space-y-3" aria-label="Preview">
          <h2 className="text-lg font-semibold">Preview</h2>
          <PreviewPane saleId={saleId} templateId={form.templateId} />
        </section>
      </div>
    </form>
  );
}

// Magic-UI-style card: hover lift plus a shared-layout ring that glides to the active template.
function TemplateCard({ template, saleId, active, onSelect }:
  { template: InvoiceTemplateMeta; saleId: string | null; active: boolean; onSelect: () => void }) {
  const reduce = usePrefersReducedMotion();
  const doc = useQuery({
    queryKey: ['invoiceHtml', saleId, template.id],
    queryFn: () => api.invoice.renderHtml({ saleId: saleId!, templateId: template.id }),
    enabled: !!saleId,
  });
  return (
    <motion.button type="button" onClick={onSelect} aria-pressed={active}
      {...(reduce ? {} : { whileHover: { y: -4 } })} transition={{ duration: MOTION_FAST, ease: 'easeOut' }}
      className={cn('relative block w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md',
        active ? 'border-primary' : 'border-border')}>
      {active && <motion.span layoutId="tpl-ring" className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary" aria-hidden />}
      <div className="mb-2 aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted">
        {doc.data
          ? <iframe title={`${template.name} preview`} srcDoc={doc.data.html} tabIndex={-1} className="pointer-events-none h-full w-full origin-top-left scale-[0.5]" style={{ width: '200%', height: '200%' }} />
          : <div className="grid h-full place-items-center p-3 text-center text-xs text-muted-foreground">{saleId ? 'Loading…' : 'Make a sale to preview'}</div>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{template.name}</span>
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', template.kind === 'thermal' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-accent text-primary')}>{template.kind === 'thermal' ? template.size : 'A4'}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
    </motion.button>
  );
}

function PreviewPane({ saleId, templateId }: { saleId: string | null; templateId: InvoiceTemplateId }) {
  const doc = useQuery({
    queryKey: ['invoiceHtml', saleId, templateId],
    queryFn: () => api.invoice.renderHtml({ saleId: saleId!, templateId }),
    enabled: !!saleId,
  });
  if (!saleId) return <div className="grid h-[70vh] place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground">Make a sale to preview</div>;
  if (doc.error) return <p className="err" role="alert">{errorMessage(doc.error)}</p>;
  return <iframe title="Invoice preview" srcDoc={doc.data?.html ?? ''} className="h-[70vh] w-full rounded-xl border border-border bg-card" />;
}

// opensourceui-style upload: a styled trigger over a hidden file input, with a thumbnail and clear action.
function ImageField({ label, value, onChange }: { label: string; value: string | undefined; onChange: (b64: string) => void }) {
  const id = `upload-${label.toLowerCase()}`;
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange(await fileToBase64(file));
    e.target.value = '';
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {value
          ? <img src={dataUrl(value)} alt={`${label} preview`} className="h-12 w-12 rounded-lg border border-border object-contain" />
          : <div className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-input text-muted-foreground"><ImageUp size={18} aria-hidden /></div>}
        <label htmlFor={id} className="btn-secondary py-1">{value ? 'Replace' : 'Upload'}<input id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e)} /></label>
        {value && <button type="button" className="btn-ghost py-1" onClick={() => onChange('')}>Remove</button>}
      </div>
    </div>
  );
}

// opensourceui-style toggle.
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}
