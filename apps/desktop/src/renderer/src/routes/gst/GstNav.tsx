import { NavLink } from 'react-router-dom';
import { monthLabel, recentMonths } from '../../lib/gst/gstForm.js';

const TABS = [['/gst', 'Returns'], ['/gst/setoff', 'Set-off'], ['/gst/payments', 'Payments']] as const;

export default function GstNav() {
  return (
    <nav className="flex gap-1" aria-label="GST">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `btn-secondary py-1 ${isActive ? 'bg-slate-200' : ''}`}>{label}</NavLink>
      ))}
    </nav>
  );
}

export function MonthPicker({ value, onChange, id = 'gst-month' }: { value: string; onChange: (m: string) => void; id?: string }) {
  const months = recentMonths(new Date().toLocaleDateString('en-CA'), 24);
  return (
    <label className="flex items-center gap-2 text-sm" htmlFor={id}>
      Month
      <select id={id} className="select w-40" value={value} onChange={(e) => onChange(e.target.value)}>
        {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
    </label>
  );
}
