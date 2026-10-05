import { NavLink } from 'react-router-dom';

const TABS = [
  ['/accounts', 'Chart of accounts'], ['/accounts/statements', 'Statements'], ['/accounts/books', 'Books'],
  ['/accounts/journal/new', 'Manual journal'], ['/accounts/periods', 'Periods'], ['/accounts/year-end', 'Year end'],
] as const;

export default function AccountsNav() {
  return (
    <nav className="flex gap-1" aria-label="Accounts">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `btn-secondary py-1 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}>{label}</NavLink>
      ))}
    </nav>
  );
}
