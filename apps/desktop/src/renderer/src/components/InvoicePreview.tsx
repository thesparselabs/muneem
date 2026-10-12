import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import type { InvoiceTemplateId, RenderInvoiceResult, SaveInvoicePdfResult } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import { useToasts } from '../lib/toast.js';
import Dialog from './Dialog.js';

// Any document laid out on the invoice templates: how to render it and how to save it as a PDF.
export interface PreviewSource { key: readonly unknown[]; render: () => Promise<RenderInvoiceResult>; save: () => Promise<SaveInvoicePdfResult> }

const saleSource = (saleId: string, templateId?: InvoiceTemplateId): PreviewSource => {
  const target = { saleId, ...(templateId && { templateId }) };
  return { key: ['invoiceHtml', saleId, templateId ?? null], render: () => api.invoice.renderHtml(target), save: () => api.invoice.savePdf(target) };
};

// Preview a document, then print it or save it as a PDF.
export default function InvoicePreview({ saleId, source, onClose, templateId, title = 'Invoice' }: {
  saleId?: string; source?: PreviewSource; onClose: () => void; templateId?: InvoiceTemplateId; title?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const push = useToasts((s) => s.push);
  const src = source ?? saleSource(saleId!, templateId);
  const doc = useQuery({ queryKey: src.key, queryFn: src.render });

  async function savePdf() {
    try {
      const r = await src.save();
      push(`Saved ${r.fileName}`, 'success');
    } catch (e) { push(errorMessage(e), 'error'); }
  }

  return (
    <Dialog title={title} onClose={onClose} wide>
      <div className="space-y-3">
        {doc.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {doc.error && <p className="err" role="alert">{errorMessage(doc.error)}</p>}
        {doc.data && (
          <iframe ref={frame} title="Invoice preview" srcDoc={doc.data.html} className="h-[68vh] w-full rounded-lg border border-border bg-white" />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary gap-1.5" onClick={() => frame.current?.contentWindow?.print()} disabled={!doc.data}>
            <Printer size={14} aria-hidden /> Print
          </button>
          <button type="button" className="btn-primary gap-1.5" onClick={() => void savePdf()} disabled={!doc.data}>
            <Download size={14} aria-hidden /> Save as PDF
          </button>
        </div>
      </div>
    </Dialog>
  );
}
