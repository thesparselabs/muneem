import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { IMPORT_FIELDS, IMPORT_MAX_ROWS, type ImportField, type ImportMapping, type ImportPreview, type ImportSummary } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../api.js';
import { fileToBase64 } from '../lib/fileToBase64.js';
import { Upload, ArrowLeft } from 'lucide-react';

const FIELD_LABELS: Record<ImportField, string> = {
  name: 'Name', sku: 'SKU / item code', barcodes: 'Barcode(s)', hsnCode: 'HSN / SAC', category: 'Category', brand: 'Brand',
  uom: 'Unit', mrp: 'MRP', sellingPrice: 'Selling price', purchasePrice: 'Purchase price', gstRate: 'GST %', reorderLevel: 'Reorder level',
};

export default function ImportProducts() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [policy, setPolicy] = useState<'skip' | 'update'>('skip');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>, then: (v: T) => void) {
    setBusy(true); setError(null);
    try { then(await fn()); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const choose = (file: File) => run(async () => api.products.importPreview({ fileName: file.name, contentBase64: await fileToBase64(file) }), setPreview);
  const remap = (mapping: ImportMapping) => run(() => api.products.importPreview({ importId: preview!.importId, mapping }), setPreview);
  const commit = () => run(() => api.products.importCommit({ importId: preview!.importId, duplicatePolicy: policy, commandId: newUlid() }), (s) => {
    setSummary(s);
    void qc.invalidateQueries();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Upload size={22} className="text-primary" aria-hidden />Import products</h1>
        <Link to="/products" className="btn-secondary"><ArrowLeft size={16} aria-hidden />Back to products</Link>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {summary ? <Summary summary={summary} />
        : preview ? <Review preview={preview} busy={busy} policy={policy} onPolicy={setPolicy} onRemap={remap} onCommit={commit} onRestart={() => setPreview(null)} />
          : <Choose busy={busy} onFile={choose} />}
    </div>
  );
}

function Choose({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  return (
    <div className="card space-y-3">
      <p className="text-sm text-muted-foreground">Choose a CSV or Excel (.xlsx) file with one product per row and a header row. Columns such as
        "Item Name", "Barcode", "MRP", "Sale Price" and "GST %" are recognised automatically; you can change the matching on the next step.
        Several barcodes go in one cell separated by <code>;</code>. Up to {IMPORT_MAX_ROWS.toLocaleString('en-IN')} rows or 10 MB.</p>
      <label className="label" htmlFor="import-file">File</label>
      <input id="import-file" type="file" accept=".csv,.xlsx,text/csv" disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {busy && <p className="text-sm text-muted-foreground" role="status">Reading the file…</p>}
    </div>
  );
}

interface ReviewProps {
  preview: ImportPreview; busy: boolean; policy: 'skip' | 'update';
  onPolicy: (p: 'skip' | 'update') => void; onRemap: (m: ImportMapping) => void; onCommit: () => void; onRestart: () => void;
}

function Review({ preview, busy, policy, onPolicy, onRemap, onCommit, onRestart }: ReviewProps) {
  const { counts, willCreate } = preview;
  const toWrite = counts.ok + (policy === 'update' ? counts.updatable : 0);
  const notUpdatable = counts.duplicates - counts.updatable;
  const setColumn = (field: ImportField, value: string) => {
    const next: ImportMapping = { ...preview.mapping };
    if (value === '') delete next[field]; else next[field] = Number(value);
    onRemap(next);
  };
  return (
    <>
      <div className="card">
        <h2 className="font-semibold mb-3">Match columns — {preview.fileName}</h2>
        <div className="grid grid-cols-3 gap-3">
          {IMPORT_FIELDS.map((field) => (
            <div key={field}>
              <label className="label" htmlFor={`map-${field}`}>{FIELD_LABELS[field]}</label>
              <select id={`map-${field}`} className="select" value={preview.mapping[field] ?? ''} disabled={busy} onChange={(e) => setColumn(field, e.target.value)}>
                <option value="">— not in file —</option>
                {preview.columns.map((c, i) => <option key={i} value={i}>{c || `Column ${i + 1}`}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Check</h2>
        <ul className="grid grid-cols-4 gap-3 text-sm">
          <li><span className="block text-2xl font-semibold">{counts.total}</span>rows</li>
          <li><span className="block text-2xl font-semibold text-green-700 dark:text-green-400">{counts.ok}</span>ready</li>
          <li><span className="block text-2xl font-semibold text-amber-700 dark:text-amber-300">{counts.duplicates}</span>already exist</li>
          <li><span className="block text-2xl font-semibold text-destructive">{counts.errors}</span>have errors (skipped)</li>
        </ul>
        {(willCreate.categories.length + willCreate.brands.length + willCreate.uoms.length > 0) && (
          <p className="text-sm text-muted-foreground">Will also create —
            {willCreate.categories.length > 0 && <> categories: {willCreate.categories.join(', ')}.</>}
            {willCreate.brands.length > 0 && <> brands: {willCreate.brands.join(', ')}.</>}
            {willCreate.uoms.length > 0 && <> units: {willCreate.uoms.join(', ')}.</>}
          </p>
        )}
        {counts.duplicates > 0 && (
          <fieldset>
            <legend className="label">Products that already exist (same SKU or barcode)</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="dup" checked={policy === 'skip'} onChange={() => onPolicy('skip')} /> Leave them as they are</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="dup" checked={policy === 'update'} onChange={() => onPolicy('update')} /> Update them with the columns in this file</label>
            {notUpdatable > 0 && <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{notUpdatable} of them can't be updated with this file (see the rows below) and will be left as they are.</p>}
          </fieldset>
        )}
        <RowTable preview={preview} />
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || toWrite === 0} onClick={onCommit}>{busy ? 'Importing…' : `Import ${toWrite} products`}</button>
        <button className="btn-secondary" disabled={busy} onClick={onRestart}>Choose another file</button>
      </div>
    </>
  );
}

function RowTable({ preview }: { preview: ImportPreview }) {
  const problems = preview.rows.filter((r) => r.status !== 'ok');
  const shown = problems.length > 0 ? problems : preview.rows;
  const hidden = preview.counts.errors + preview.counts.duplicates - problems.length;
  return (
    <>
      <table className="table-modern">
        <thead><tr><th>Row</th><th>Name</th><th>SKU</th><th>Status</th><th>Details</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.line}>
              <td className="tabular-nums">{r.line}</td>
              <td>{r.name ?? ''}</td>
              <td className="font-mono text-xs">{r.sku ?? ''}</td>
              <td className={r.status === 'error' ? 'text-destructive' : r.status === 'duplicate' ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-400'}>{r.status === 'ok' ? 'Ready' : r.status === 'duplicate' ? 'Exists' : 'Error'}</td>
              <td>{Object.entries(r.errors).map(([f, m]) => `${FIELD_LABELS[f as ImportField] ?? f}: ${m}`).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && <p className="text-xs text-muted-foreground">…and {hidden} more rows not shown.</p>}
    </>
  );
}

function Summary({ summary }: { summary: ImportSummary }) {
  return (
    <div className="card space-y-2" role="status">
      <h2 className="font-semibold">Import finished</h2>
      <p className="text-sm">{summary.created} products added, {summary.updated} updated, {summary.skippedDuplicates} existing left unchanged, {summary.skippedErrors} rows skipped because of errors.</p>
      <p className="text-sm text-muted-foreground">Also created {summary.categoriesCreated} categories, {summary.brandsCreated} brands and {summary.uomsCreated} units.</p>
      {summary.skippedAtCommit.length > 0 && (
        <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc pl-5">
          {summary.skippedAtCommit.map((s) => <li key={s.line}>Row {s.line}: {s.reason}</li>)}
        </ul>
      )}
      <Link to="/products" className="btn-primary">See products</Link>
    </div>
  );
}
