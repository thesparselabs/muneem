import { Info } from 'lucide-react';
import { IMPORT_MAX_ROWS } from '@muneem/contracts';
import type { ImportFormat } from '../lib/importFormats.js';

// What a file must look like, shown before the user picks one, so a refused import is not the first they hear of it.
export default function ImportFormatHelp({ format, open = true }: { format: ImportFormat; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><Info size={16} className="text-primary" aria-hidden />File format</summary>
      <div className="mt-3 space-y-3">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>A CSV (.csv) or Excel (.xlsx) file; from Excel only the first sheet is read.</li>
          <li>The first row holds the column names, then one record per row. Column order does not matter.</li>
          <li>Up to {IMPORT_MAX_ROWS.toLocaleString('en-IN')} rows or 10 MB.</li>
          <li>Column names are matched ignoring capitals, spaces and symbols; you can correct the matching after choosing the file.</li>
          {format.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th>Column</th><th>Needed</th><th>Recognised column names</th><th>What to put in it</th></tr></thead>
            <tbody>
              {format.columns.map((c) => (
                <tr key={c.name}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.required ? <span className="font-medium text-destructive">Required</span> : <span className="text-muted-foreground">Optional</span>}</td>
                  <td className="text-muted-foreground">{c.headers}</td>
                  <td>{c.format}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-1 font-medium">Example</p>
          <pre className="overflow-x-auto rounded-md border border-border bg-card p-2 font-mono text-xs">{format.example.join('\n')}</pre>
        </div>
      </div>
    </details>
  );
}
