import { useCallback, useState } from 'react';
import type { HelpLang } from './content.js';

const KEY = 'muneem.helpLang';

function initial(): HelpLang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'hi') return saved;
  } catch { /* storage unavailable */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

export function useHelpLang(): [HelpLang, (l: HelpLang) => void] {
  const [lang, setLang] = useState<HelpLang>(initial);
  const set = useCallback((l: HelpLang) => {
    setLang(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);
  return [lang, set];
}
