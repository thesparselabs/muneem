import { NavLink } from 'react-router-dom';
import { ArrowLeftRight, FileText, Landmark, type LucideIcon } from 'lucide-react';
import { monthLabel, recentMonths } from '../../lib/gst/gstForm.js';

const TABS: readonly (readonly [string, string, LucideIcon])[] = [['/gst', 'Returns', FileText], ['/gst/setoff', 'Set-off', ArrowLeftRight], ['/gst/payments', 'Payments', Landmark]];

export default function GstNav() {
  return (
    <nav className="flex gap-1" aria-label="GST">
      {TABS.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `btn-secondary py-1 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}><Icon size={14} aria-hidden />{label}</NavLink>
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
