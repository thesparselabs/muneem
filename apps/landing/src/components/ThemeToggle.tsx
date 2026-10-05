import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function resolved(): Theme {
  try {
    const saved = localStorage.getItem('muneem-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage blocked */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => { setTheme(resolved()); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('muneem-theme', theme); } catch { /* storage blocked */ }
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`}
      className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-card text-ink-soft transition-colors hover:text-ink">
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
