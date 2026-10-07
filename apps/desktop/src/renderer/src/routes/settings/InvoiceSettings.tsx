import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Eye, ImageUp, Palette, Save, ArrowLeft, Trash2 } from 'lucide-react';
import type { InvoiceBranding, InvoiceTemplateId, InvoiceTemplateMeta } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Field from '../../components/Field.js';
import InvoicePreview from '../../components/InvoicePreview.js';
import ScaledInvoiceFrame from '../../components/ScaledInvoiceFrame.js';
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
  const [previewing, setPreviewing] = useState<InvoiceTemplateMeta | null>(null);
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
        <Link to="/pos" className="btn-secondary px-2.5" aria-label="Back to billing" title="Back to billing"><ArrowLeft size={16} aria-hidden /></Link>
      </div>

      <section className="space-y-3" aria-label="Templates">
        <h2 className="text-lg font-semibold">Template</h2>
        {templates.error && <p className="err" role="alert">{errorMessage(templates.error)}</p>}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {templates.data?.templates.map((t) => (
            <TemplateCard key={t.id} template={t} saleId={saleId}
              active={form.templateId === t.id} onSelect={() => set({ templateId: t.id })} onPreview={() => setPreviewing(t)} />
          ))}
        </div>
        {previewing && saleId && <InvoicePreview saleId={saleId} templateId={previewing.id} title={`${previewing.name} preview`} onClose={() => setPreviewing(null)} />}
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

const A4_WIDTH_PX = 794;
const THERMAL_WIDTH_PX = 340;

// Magic-UI-style card: hover lift plus a shared-layout ring that glides to the active template.
function TemplateCard({ template, saleId, active, onSelect, onPreview }:
  { template: InvoiceTemplateMeta; saleId: string | null; active: boolean; onSelect: () => void; onPreview: () => void }) {
  const reduce = usePrefersReducedMotion();
  const doc = useQuery({
    queryKey: ['invoiceHtml', saleId, template.id],
    queryFn: () => api.invoice.renderHtml({ saleId: saleId!, templateId: template.id }),
    enabled: !!saleId,
  });
  return (
    <motion.div {...(reduce ? {} : { whileHover: { y: -4 } })} transition={{ duration: MOTION_FAST, ease: 'easeOut' }}
      className={cn('relative rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md', active ? 'border-primary' : 'border-border')}>
      {active && <motion.span layoutId="tpl-ring" className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary" aria-hidden />}
      <button type="button" onClick={onSelect} aria-pressed={active} className="block w-full rounded-xl p-3 text-left">
        <div className="mb-2 aspect-[210/297] overflow-hidden rounded-lg border border-border bg-muted">
          {doc.data
            ? <ScaledInvoiceFrame html={doc.data.html} title={`${template.name} preview`} pageWidth={template.kind === 'thermal' ? THERMAL_WIDTH_PX : A4_WIDTH_PX} />
            : <div className="grid h-full place-items-center p-3 text-center text-xs text-muted-foreground">{saleId ? 'Loading…' : 'Make a sale to preview'}</div>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{template.name}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', template.kind === 'thermal' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-accent text-primary')}>{template.kind === 'thermal' ? template.size : 'A4'}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
      </button>
      <button type="button" onClick={onPreview} disabled={!saleId} aria-label={`Preview ${template.name}`} title="Preview full size"
        className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50">
        <Eye size={16} aria-hidden />
      </button>
    </motion.div>
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
        {value && <button type="button" className="btn-ghost px-2 py-1" onClick={() => onChange('')} aria-label="Remove" title="Remove"><Trash2 size={14} aria-hidden /></button>}
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
