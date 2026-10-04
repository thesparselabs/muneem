import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ExportFormat, ReportResult } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { previousMonth } from '../../lib/gst/gstForm.js';
import GstNav, { MonthPicker } from './GstNav.js';

const money = (p: number) => <span className="tabular-nums">{formatPaise(p)}</span>;

// GST → Returns: the month's GSTR-1 sections, GSTR-3B and whether they tie to the tax accounts (ADR-0044).
export default function GstReturns() {
  const [month, setMonth] = useState(() => previousMonth(new Date().toLocaleDateString('en-CA')));
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useQuery({ queryKey: ['gst', 'summary', month], queryFn: () => api.gst.returnSummary({ month }) });
  const exportReport = async (id: string, format: ExportFormat) => {
    try {
      const r = await api.reports.export({ id, params: { month }, format });
      setMessage(r.saved ? `Saved ${r.fileName}` : 'Not saved');
    } catch (e) { setMessage(errorMessage(e)); }
  };
  const s = summary.data;
  const off = s?.tieOuts.filter((t) => t.returnPaise !== t.booksPaise) ?? [];
  const exportButtons = (id: string) => (
    <span className="flex gap-1">
      <button type="button" className="btn-secondary py-0" onClick={() => void exportReport(id, 'csv')}>CSV</button>
      <button type="button" className="btn-secondary py-0" onClick={() => void exportReport(id, 'xlsx')}>XLSX</button>
    </span>
  );
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">GST returns</h1>
      <GstNav />
      <div className="flex items-center gap-4">
        <MonthPicker value={month} onChange={(m) => { setMonth(m); setOpen(null); }} />
        {s?.locked && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">Month locked</span>}
        {s?.setoffId && <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">Set off</span>}
      </div>
      {message && <p className="text-sm" role="status">{message}</p>}
      {summary.error && <p className="err" role="alert">{errorMessage(summary.error)}</p>}
      {s && !s.applicable && <p className="card text-sm">This business is not under the regular scheme, so it files no GSTR-1 or GSTR-3B here.</p>}
      {s?.applicable && (
        <>
          <p className={`text-sm ${off.length ? 'text-red-700' : 'text-green-700'}`} role="status">
            {off.length ? `The return does not tie to the books: ${off.map((t) => `${t.name} (${formatPaise(t.returnPaise)} vs ${formatPaise(t.booksPaise)})`).join('; ')}`
              : 'Every head ties to the tax accounts for the month.'}
          </p>
          {s.missingHsn > 0 && <p className="text-sm text-amber-700">{s.missingHsn} lines have no HSN code. {exportButtons('gst.productsMissingHsn')}</p>}
          <table className="w-full rounded-lg border bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr>
              <th className="p-2">GSTR-1 section</th><th className="p-2 text-right">Rows</th><th className="p-2 text-right">Taxable</th><th className="p-2 text-right">IGST</th>
              <th className="p-2 text-right">CGST</th><th className="p-2 text-right">SGST</th><th className="p-2 text-right">Cess</th><th className="p-2">Export</th>
            </tr></thead>
            <tbody>
              {s.sections.map((x) => (
                <tr key={x.section} className={`border-t ${open === x.reportId ? 'bg-blue-50' : ''}`}>
                  <td className="p-2"><button type="button" className="underline" onClick={() => setOpen(open === x.reportId ? null : x.reportId)}>{x.title}</button></td>
                  <td className="p-2 text-right">{x.rows}</td><td className="p-2 text-right">{money(x.taxablePaise)}</td><td className="p-2 text-right">{money(x.igstPaise)}</td>
                  <td className="p-2 text-right">{money(x.cgstPaise)}</td><td className="p-2 text-right">{money(x.sgstPaise)}</td><td className="p-2 text-right">{money(x.cessPaise)}</td>
                  <td className="p-2">{exportButtons(x.reportId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {open && <SectionTable id={open} month={month} />}
          <div className="card space-y-2">
            <div className="flex items-center justify-between"><h2 className="font-semibold">GSTR-3B</h2>{exportButtons('gst.gstr3b')}</div>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600"><tr><th className="p-1">Table</th><th className="p-1">Description</th><th className="p-1 text-right">Taxable</th>
                <th className="p-1 text-right">IGST</th><th className="p-1 text-right">CGST</th><th className="p-1 text-right">SGST</th><th className="p-1 text-right">Cess</th></tr></thead>
              <tbody>{s.gstr3b.map((r) => (
                <tr key={r.code} className="border-t"><td className="p-1">{r.code}</td><td className="p-1">{r.description}</td><td className="p-1 text-right">{money(r.taxablePaise)}</td>
                  <td className="p-1 text-right">{money(r.igstPaise)}</td><td className="p-1 text-right">{money(r.cgstPaise)}</td><td className="p-1 text-right">{money(r.sgstPaise)}</td>
                  <td className="p-1 text-right">{money(r.cessPaise)}</td></tr>
              ))}
              {s.inward.map((r) => (
                <tr key={r.description} className="border-t"><td className="p-1">5</td><td className="p-1">{r.description}</td>
                  <td className="p-1 text-right" colSpan={5}>inter-state {formatPaise(r.interPaise)} · intra-state {formatPaise(r.intraPaise)}</td></tr>
              ))}</tbody>
            </table>
            <div className="flex items-center gap-2 text-sm">ITC register {exportButtons('gst.itcRegister')}</div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTable({ id, month }: { id: string; month: string }) {
  const r = useQuery({ queryKey: ['gst', 'section', id, month], queryFn: () => api.reports.run({ id, params: { month } }) });
  if (r.error) return <p className="err" role="alert">{errorMessage(r.error)}</p>;
  if (!r.data) return <p className="text-sm text-slate-500">Loading…</p>;
  return <ResultTable result={r.data} />;
}

function ResultTable({ result }: { result: ReportResult }) {
  const cell = (kind: string, v: string | number | null) =>
    v === null ? '' : kind === 'money' && typeof v === 'number' ? formatPaise(v) : kind === 'qty' && typeof v === 'number' ? String(v / 1000) : String(v);
  if (result.rows.length === 0) return <p className="card text-sm text-slate-600">Nothing in this section for the month.</p>;
  return (
    <div className="overflow-auto rounded-lg border bg-white">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-600"><tr>{result.columns.map((c) => <th key={c.key} className="p-1">{c.label}</th>)}</tr></thead>
        <tbody>
          {[...result.rows, ...(result.totals ? [result.totals] : [])].map((row, i) => (
            <tr key={i} className={`border-t ${i === result.rows.length ? 'font-semibold' : ''}`}>
              {result.columns.map((c) => <td key={c.key} className={`p-1 ${c.kind === 'text' || c.kind === 'date' ? '' : 'text-right tabular-nums'}`}>{cell(c.kind, row[c.key] ?? null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
