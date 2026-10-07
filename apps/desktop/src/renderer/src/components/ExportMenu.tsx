import { FileSpreadsheet, FileText, FileType, type LucideIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import type { ExportFormat } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import { useCan } from '../lib/permissions.js';
import { useToasts } from '../lib/toast.js';

const FORMATS: { format: ExportFormat; label: string; icon: LucideIcon }[] = [
  { format: 'csv', label: 'Export CSV', icon: FileText },
  { format: 'xlsx', label: 'Export Excel', icon: FileSpreadsheet },
  { format: 'pdf', label: 'Export PDF', icon: FileType },
];

// Saves a catalogue report as a file; any screen whose list matches a report can offer it.
export default function ExportMenu({ reportId, params = {}, formats = ['csv', 'xlsx', 'pdf'] }: { reportId: string; params?: Record<string, string>; formats?: readonly ExportFormat[] }) {
  const canExport = useCan('reports.export');
  const push = useToasts((s) => s.push);
  const exp = useMutation({
    mutationFn: (format: ExportFormat) => api.reports.export({ id: reportId, params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '')), format }),
    onSuccess: (r) => { if (r.saved) push(`Exported ${r.fileName}`, 'success'); },
    onError: (e) => push(errorMessage(e), 'error'),
  });
  if (!canExport) return null;
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border shadow-sm print:hidden" role="group" aria-label="Export">
      {FORMATS.filter((f) => formats.includes(f.format)).map(({ format, label, icon: Icon }) => (
        <button key={format} type="button" aria-label={label} title={label} disabled={exp.isPending} onClick={() => exp.mutate(format)}
          className="flex items-center gap-1 border-l border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground transition-colors first:border-l-0 hover:bg-muted disabled:opacity-50">
          <Icon size={16} aria-hidden /><span aria-hidden>{format === 'xlsx' ? 'XLS' : format.toUpperCase()}</span>
        </button>
      ))}
      {exp.data?.saved && <span role="status" className="sr-only">Saved {exp.data.fileName}</span>}
    </div>
  );
}
