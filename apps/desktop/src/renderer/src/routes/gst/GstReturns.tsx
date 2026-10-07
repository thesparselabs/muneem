import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReportResult } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { formatPaise } from '../../lib/money.js';
import { previousMonth } from '../../lib/gst/gstForm.js';
import GstNav, { MonthPicker } from './GstNav.js';
import ExportMenu from '../../components/ExportMenu.js';
import { FileText } from 'lucide-react';

const money = (p: number) => <span className="tabular-nums">{formatPaise(p)}</span>;

// GST → Returns: the month's GSTR-1 sections, GSTR-3B and whether they tie to the tax accounts (ADR-0044).
export default function GstReturns() {
  const [month, setMonth] = useState(() => previousMonth(new Date().toLocaleDateString('en-CA')));
  const [open, setOpen] = useState<string | null>(null);
  const summary = useQuery({ queryKey: ['gst', 'summary', month], queryFn: () => api.gst.returnSummary({ month }) });
  const s = summary.data;
  const off = s?.tieOuts.filter((t) => t.returnPaise !== t.booksPaise) ?? [];
  const exportButtons = (id: string) => <ExportMenu reportId={id} params={{ month }} />;
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><FileText size={22} className="text-primary" aria-hidden />GST returns</h1>
      <GstNav />
      <div className="flex items-center gap-4">
        <MonthPicker value={month} onChange={(m) => { setMonth(m); setOpen(null); }} />
        {s?.locked && <span className="rounded bg-muted px-2 py-0.5 text-xs">Month locked</span>}
        {s?.setoffId && <span className="rounded bg-green-50 dark:bg-green-500/20 px-2 py-0.5 text-xs text-green-800 dark:text-green-400">Set off</span>}
      </div>
      {summary.error && <p className="err" role="alert">{errorMessage(summary.error)}</p>}
      {s && !s.applicable && <p className="card text-sm">This business is not under the regular scheme, so it files no GSTR-1 or GSTR-3B here.</p>}
      {s?.applicable && (
        <>
          <p className={`text-sm ${off.length ? 'text-destructive' : 'text-green-700 dark:text-green-400'}`} role="status">
            {off.length ? `The return does not tie to the books: ${off.map((t) => `${t.name} (${formatPaise(t.returnPaise)} vs ${formatPaise(t.booksPaise)})`).join('; ')}`
              : 'Every head ties to the tax accounts for the month.'}
          </p>
          {s.missingHsn > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{s.missingHsn} lines have no HSN code. {exportButtons('gst.productsMissingHsn')}</p>}
          <table className="table-modern rounded-lg border border-border bg-card">
            <thead><tr>
              <th>GSTR-1 section</th><th className="text-right">Rows</th><th className="text-right">Taxable</th><th className="text-right">IGST</th>
              <th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">Cess</th><th>Export</th>
            </tr></thead>
            <tbody>
              {s.sections.map((x) => (
                <tr key={x.section} className={open === x.reportId ? 'bg-accent' : undefined}>
                  <td><button type="button" className="underline" onClick={() => setOpen(open === x.reportId ? null : x.reportId)}>{x.title}</button></td>
                  <td className="text-right">{x.rows}</td><td className="text-right">{money(x.taxablePaise)}</td><td className="text-right">{money(x.igstPaise)}</td>
                  <td className="text-right">{money(x.cgstPaise)}</td><td className="text-right">{money(x.sgstPaise)}</td><td className="text-right">{money(x.cessPaise)}</td>
                  <td>{exportButtons(x.reportId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {open && <SectionTable id={open} month={month} />}
          <div className="card space-y-2">
            <div className="flex items-center justify-between"><h2 className="font-semibold">GSTR-3B</h2>{exportButtons('gst.gstr3b')}</div>
            <table className="table-modern">
              <thead><tr><th>Table</th><th>Description</th><th className="text-right">Taxable</th>
                <th className="text-right">IGST</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">Cess</th></tr></thead>
              <tbody>{s.gstr3b.map((r) => (
                <tr key={r.code}><td>{r.code}</td><td>{r.description}</td><td className="text-right">{money(r.taxablePaise)}</td>
                  <td className="text-right">{money(r.igstPaise)}</td><td className="text-right">{money(r.cgstPaise)}</td><td className="text-right">{money(r.sgstPaise)}</td>
                  <td className="text-right">{money(r.cessPaise)}</td></tr>
              ))}
              {s.inward.map((r) => (
                <tr key={r.description}><td>5</td><td>{r.description}</td>
                  <td className="text-right" colSpan={5}>inter-state {formatPaise(r.interPaise)} · intra-state {formatPaise(r.intraPaise)}</td></tr>
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
  if (!r.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return <ResultTable result={r.data} />;
}

function ResultTable({ result }: { result: ReportResult }) {
  const cell = (kind: string, v: string | number | null) =>
    v === null ? '' : kind === 'money' && typeof v === 'number' ? formatPaise(v) : kind === 'qty' && typeof v === 'number' ? String(v / 1000) : String(v);
  if (result.rows.length === 0) return <p className="card text-sm text-muted-foreground">Nothing in this section for the month.</p>;
  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="table-modern text-xs">
        <thead><tr>{result.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {[...result.rows, ...(result.totals ? [result.totals] : [])].map((row, i) => (
            <tr key={i} className={i === result.rows.length ? 'font-semibold' : undefined}>
              {result.columns.map((c) => <td key={c.key} className={c.kind === 'text' || c.kind === 'date' ? undefined : 'text-right tabular-nums'}>{cell(c.kind, row[c.key] ?? null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
