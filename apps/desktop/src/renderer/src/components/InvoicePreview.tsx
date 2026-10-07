import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import type { InvoiceTemplateId } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import { useToasts } from '../lib/toast.js';
import Dialog from './Dialog.js';

// Preview a sale's invoice, then print it or save it as a PDF.
export default function InvoicePreview({ saleId, onClose, templateId, title = 'Invoice' }: { saleId: string; onClose: () => void; templateId?: InvoiceTemplateId; title?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const push = useToasts((s) => s.push);
  const target = { saleId, ...(templateId && { templateId }) };
  const doc = useQuery({ queryKey: ['invoiceHtml', saleId, templateId ?? null], queryFn: () => api.invoice.renderHtml(target) });

  async function savePdf() {
    try {
      const r = await api.invoice.savePdf(target);
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
