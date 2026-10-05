import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ExportFormat, ReportDefinitionView, ReportParamField, ReportResult } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import DatePicker from '../../components/DatePicker.js';
import PartyPicker from '../../components/PartyPicker.js';
import { useCan } from '../../lib/permissions.js';
import { checkParams, defaultParams, formatCell, groupReports, isNumeric, periodLabel, runParams } from '../../lib/reports/reportForm.js';

const today = () => new Date().toLocaleDateString('en-CA');

function ParamInput({ p, value, error, onChange, branches }: {
  p: ReportParamField; value: string; error?: string | undefined; onChange: (v: string) => void; branches: { id: string; name: string }[];
}) {
  const id = `rp-${p.key}`;
  if (p.kind === 'customer' || p.kind === 'supplier') {
    return (
      <div className="min-w-64">
        <PartyPicker id={id} partyType={p.kind} onPick={(picked) => onChange(`${picked.id}|${picked.name}`)} />
        {value && <p className="text-xs text-slate-600">{value.split('|')[1]}</p>}
        {error && <p className="err">{error}</p>}
      </div>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={id}>{p.label}</label>
      {p.kind === 'branch' ? (
        <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      ) : p.kind === 'select' ? (
        <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>{p.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : p.kind === 'date' ? (
        <DatePicker id={id} value={value} onChange={onChange} />
      ) : (
        <input id={id} type="text" className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

function ResultTable({ r }: { r: ReportResult }) {
  return (
    <table className="table-modern">
      <thead>
        <tr>{r.columns.map((c) => <th key={c.key} className={isNumeric(c.kind) ? 'text-right' : ''}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {r.rows.map((row, i) => (
          <tr key={i}>{r.columns.map((c) => <td key={c.key} className={isNumeric(c.kind) ? 'text-right tabular-nums' : ''}>{formatCell(c.kind, row[c.key])}</td>)}</tr>
        ))}
        {r.totals && (
          <tr className="border-t-2 border-slate-400 font-semibold">{r.columns.map((c) => <td key={c.key} className={isNumeric(c.kind) ? 'text-right tabular-nums' : ''}>{formatCell(c.kind, r.totals![c.key])}</td>)}</tr>
        )}
      </tbody>
    </table>
  );
}

// Party pickers keep "id|name" so the chosen name can be shown; only the id is sent.
const sendable = (values: Record<string, string>) => runParams(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.split('|')[0] ?? ''])));

export default function Reports() {
  const canExport = useCan('reports.export');
  const defs = useQuery({ queryKey: ['reportDefinitions'], queryFn: () => api.reports.listDefinitions({}) });
  const business = useQuery({ queryKey: ['business'], queryFn: () => api.business.get({}) });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.business.getBranches({}) });
  const [def, setDef] = useState<ReportDefinitionView | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = useMutation({ mutationFn: () => api.reports.run({ id: def!.id, params: sendable(values) }) });
  const exp = useMutation({ mutationFn: (format: ExportFormat) => api.reports.export({ id: def!.id, params: sendable(values), format }) });

  const pick = (d: ReportDefinitionView) => { setDef(d); setValues(defaultParams(d, today())); setErrors({}); run.reset(); exp.reset(); };
  const submit = () => {
    const e = checkParams(def!, values);
    setErrors(e);
    if (Object.keys(e).length === 0) run.mutate();
  };

  return (
    <div className="grid grid-cols-[240px_1fr] gap-6 print:block">
      <aside className="space-y-4 print:hidden" aria-label="Reports">
        <h1 className="text-2xl font-semibold">Reports</h1>
        {defs.error && <p className="err" role="alert">{errorMessage(defs.error)}</p>}
        {groupReports(defs.data ?? []).map((g) => (
          <div key={g.group}>
            <h2 className="text-xs font-semibold uppercase text-slate-500">{g.group}</h2>
            <ul>{g.reports.map((r) => (
              <li key={r.id}><button type="button" className={`w-full rounded px-2 py-1 text-left text-sm ${def?.id === r.id ? 'bg-blue-50 font-medium text-blue-800' : 'hover:bg-slate-50'}`} onClick={() => pick(r)}>{r.title}</button></li>
            ))}</ul>
          </div>
        ))}
      </aside>
      <section className="min-w-0 space-y-4">
        {!def && <p className="text-slate-500">Choose a report.</p>}
        {def && (
          <>
            <div className="card flex flex-wrap items-end gap-3 print:hidden">
              {def.params.map((p) => (
                <ParamInput key={p.key} p={p} value={values[p.key] ?? ''} error={errors[p.key]} branches={branches.data ?? []}
                  onChange={(v) => setValues({ ...values, [p.key]: v })} />
              ))}
              <button type="button" className="btn-primary" onClick={submit} disabled={run.isPending}>Run</button>
              {run.data && canExport && (['csv', 'xlsx', 'pdf'] as const).map((f) => (
                <button key={f} type="button" className="btn-secondary" disabled={exp.isPending} onClick={() => exp.mutate(f)}>Export {f.toUpperCase()}</button>
              ))}
              {run.data && <button type="button" className="btn-secondary" onClick={() => window.print()}>Print</button>}
            </div>
            {(run.error ?? exp.error) && <p className="err" role="alert">{errorMessage(run.error ?? exp.error)}</p>}
            {exp.data?.saved && <p className="text-sm text-green-700">Saved {exp.data.fileName}</p>}
            {run.data && (
              <div className="card space-y-2 overflow-x-auto">
                <header>
                  <p className="font-semibold">{business.data?.name}{business.data?.gstin && <span className="ml-2 text-sm font-normal text-slate-600">GSTIN {business.data.gstin}</span>}</p>
                  <h2 className="text-lg font-semibold">{run.data.title}</h2>
                  <p className="text-xs text-slate-600">{periodLabel(values)} · generated {new Date(run.data.generatedAt).toLocaleString('en-IN')}</p>
                </header>
                {run.data.truncated && <p className="text-sm text-amber-800">Showing the first rows only; narrow the dates or export.</p>}
                <ResultTable r={run.data} />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
