import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface HelpState { open: boolean; openHelp: () => void; closeHelp: () => void }

const HelpContext = createContext<HelpState | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openHelp = useCallback(() => setOpen(true), []);
  const closeHelp = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openHelp, closeHelp }), [open, openHelp, closeHelp]);
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp(): HelpState {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp outside HelpProvider');
  return ctx;
}
