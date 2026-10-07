import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Upload } from 'lucide-react';
import { PARTY_IMPORT_FIELDS, type PartyImportField, type PartyImportMapping, type PartyImportPreview, type PartyImportSummary, type PartyType } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage } from '../../api.js';
import ImportFormatHelp from '../../components/ImportFormatHelp.js';
import { fileToBase64 } from '../../lib/fileToBase64.js';
import { CUSTOMER_FORMAT, SUPPLIER_FORMAT } from '../../lib/importFormats.js';

const FIELD_LABELS: Record<PartyImportField, string> = {
  name: 'Name', phone: 'Phone', email: 'Email', gstin: 'GSTIN', stateCode: 'State code', taxScheme: 'Tax scheme', addressLine1: 'Address', city: 'City',
  pinCode: 'PIN code', creditDays: 'Credit days', openingBalance: 'Opening balance', openingDate: 'Opening date',
};
const KIND = {
  customer: { plural: 'customers', title: 'Import customers', format: CUSTOMER_FORMAT, api: () => api.customers },
  supplier: { plural: 'suppliers', title: 'Import suppliers', format: SUPPLIER_FORMAT, api: () => api.suppliers },
} as const;
const STATUS = { ok: ['Ready', 'text-green-700 dark:text-green-400'], duplicate: ['Exists', 'text-amber-700 dark:text-amber-300'], error: ['Error', 'text-destructive'] } as const;

export default function ImportParties() {
  const { kind } = useParams<{ kind: PartyType }>();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PartyImportPreview | null>(null);
  const [summary, setSummary] = useState<PartyImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commandId, setCommandId] = useState(newUlid);
  if (kind !== 'customer' && kind !== 'supplier') return <Navigate to="/parties" replace />;
  const k = KIND[kind];
  const fields = PARTY_IMPORT_FIELDS.filter((f) => f !== 'taxScheme' || kind === 'supplier');

  async function run<T>(fn: () => Promise<T>, then: (v: T) => void) {
    setBusy(true); setError(null);
    try { then(await fn()); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const choose = (file: File) => run(async () => k.api().importPreview({ fileName: file.name, contentBase64: await fileToBase64(file) }), (p) => { setPreview(p); setCommandId(newUlid()); });
  const remap = (mapping: PartyImportMapping) => run(() => k.api().importPreview({ importId: preview!.importId, mapping }), setPreview);
  const commit = () => run(() => k.api().importCommit({ importId: preview!.importId, commandId }), (s) => { setSummary(s); void qc.invalidateQueries(); });
  const setColumn = (field: PartyImportField, value: string) => {
    const next: PartyImportMapping = { ...preview!.mapping };
    if (value === '') delete next[field]; else next[field] = Number(value);
    void remap(next);
  };
  const problems = preview?.rows.filter((r) => r.status !== 'ok') ?? [];
  const shown = problems.length > 0 ? problems : preview?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Upload size={22} className="text-primary" aria-hidden />{k.title}</h1>
        <Link to="/parties" className="btn-secondary px-2.5" aria-label="Back to parties" title="Back to parties"><ArrowLeft size={16} aria-hidden /></Link>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {summary ? (
        <div className="card space-y-2" role="status">
          <h2 className="font-semibold">Import finished</h2>
          <p className="text-sm">{summary.created} {k.plural} added, {summary.openingsSet} opening balances set, {summary.skippedDuplicates} already on file left unchanged, {summary.skippedErrors} rows skipped because of errors.</p>
          {summary.skippedAtCommit.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-300">{summary.skippedAtCommit.map((s) => <li key={s.line}>Row {s.line}: {s.reason}</li>)}</ul>}
          <Link to="/parties" className="btn-primary">See parties</Link>
        </div>
      ) : !preview ? (
        <div className="card space-y-3">
          <ImportFormatHelp format={k.format} />
          <label className="label" htmlFor="party-file">File</label>
          <input id="party-file" type="file" accept=".csv,.xlsx,text/csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f); }} />
          {busy && <p className="text-sm text-muted-foreground" role="status">Reading the file…</p>}
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="mb-3 font-semibold">Match columns — {preview.fileName}</h2>
            <div className="grid grid-cols-4 gap-3">
              {fields.map((field) => (
                <div key={field}>
                  <label className="label" htmlFor={`pm-${field}`}>{FIELD_LABELS[field]}</label>
                  <select id={`pm-${field}`} className="select" value={preview.mapping[field] ?? ''} disabled={busy} onChange={(e) => setColumn(field, e.target.value)}>
                    <option value="">— not in file —</option>
                    {preview.columns.map((c, i) => <option key={i} value={i}>{c || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="card space-y-3">
            <h2 className="font-semibold">Check</h2>
            <ul className="grid grid-cols-5 gap-3 text-sm">
              <li><span className="block text-2xl font-semibold">{preview.counts.total}</span>rows</li>
              <li><span className="block text-2xl font-semibold text-green-700 dark:text-green-400">{preview.counts.ok}</span>ready</li>
              <li><span className="block text-2xl font-semibold">{preview.counts.openings}</span>with an opening balance</li>
              <li><span className="block text-2xl font-semibold text-amber-700 dark:text-amber-300">{preview.counts.duplicates}</span>already on file (skipped)</li>
              <li><span className="block text-2xl font-semibold text-destructive">{preview.counts.errors}</span>have errors (skipped)</li>
            </ul>
            <table className="table-modern">
              <thead><tr><th>Row</th><th>Name</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.line}>
                    <td className="tabular-nums">{r.line}</td><td>{r.name ?? ''}</td>
                    <td className={STATUS[r.status][1]}>{STATUS[r.status][0]}</td>
                    <td>{Object.entries(r.errors).map(([f, m]) => `${FIELD_LABELS[f as PartyImportField] ?? f}: ${m}`).join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={busy || preview.counts.ok === 0} onClick={() => void commit()}><Upload size={16} aria-hidden />{busy ? 'Importing…' : `Import ${preview.counts.ok} ${k.plural}`}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setPreview(null)}><RotateCcw size={16} aria-hidden />Choose another file</button>
          </div>
        </>
      )}
    </div>
  );
}
