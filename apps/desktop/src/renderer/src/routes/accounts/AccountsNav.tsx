import { NavLink } from 'react-router-dom';
import { BookMarked, CalendarCheck, CalendarRange, FileSpreadsheet, ListTree, PenLine, type LucideIcon } from 'lucide-react';

const TABS: readonly (readonly [string, string, LucideIcon])[] = [
  ['/accounts', 'Chart of accounts', ListTree], ['/accounts/statements', 'Statements', FileSpreadsheet], ['/accounts/books', 'Books', BookMarked],
  ['/accounts/journal/new', 'Manual journal', PenLine], ['/accounts/periods', 'Periods', CalendarRange], ['/accounts/year-end', 'Year end', CalendarCheck],
];

export default function AccountsNav() {
  return (
    <nav className="flex gap-1" aria-label="Accounts">
      {TABS.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `btn-secondary py-1 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}><Icon size={14} aria-hidden />{label}</NavLink>
      ))}
    </nav>
  );
}
