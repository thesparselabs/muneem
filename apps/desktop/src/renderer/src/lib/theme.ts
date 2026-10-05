import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function current(): Theme {
  try { const s = localStorage.getItem('muneem-theme'); if (s === 'light' || s === 'dark') return s; } catch { /* storage blocked */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Drives the shadcn `.dark` class on <html>; remembers the choice, defaults to the OS setting.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => { setTheme(current()); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('muneem-theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
