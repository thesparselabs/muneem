import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOUR_STEPS, type TourStep } from '../../lib/tour/steps.js';
import { waitForElement } from '../../lib/tour/waitForElement.js';
import { hasSeenTour, markTourSeen } from '../../lib/tour/seen.js';

interface TourState {
  running: boolean;
  step: TourStep | null;
  target: HTMLElement | null;
  index: number;
  total: number;
  start: () => void;
  next: () => void;
  back: () => void;
  stop: () => void;
}

const TourContext = createContext<TourState | null>(null);

export function useTour(): TourState {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour outside TourProvider');
  return ctx;
}

const AUTH_PATHS = ['/login', '/switch', '/setup'];
const TARGET_TIMEOUT_MS = 2500;

export function TourProvider({ children, steps = TOUR_STEPS }: { children: ReactNode; steps?: TourStep[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const step = running ? steps[index] ?? null : null;

  const stop = useCallback(() => { markTourSeen(); setRunning(false); setTarget(null); }, []);
  const start = useCallback(() => { setIndex(0); setTarget(null); setRunning(true); }, []);
  const next = useCallback(() => {
    if (index >= steps.length - 1) return stop();
    setTarget(null);
    setIndex(index + 1);
  }, [index, steps.length, stop]);
  const back = useCallback(() => { if (index > 0) { setTarget(null); setIndex(index - 1); } }, [index]);

  useEffect(() => {
    if (!step) return;
    const ctl = new AbortController();
    if (step.route && step.route !== pathRef.current) navigate(step.route);
    if (!step.selector) { setTarget(null); return () => ctl.abort(); }
    const { selector } = step;
    void waitForElement(selector, TARGET_TIMEOUT_MS, ctl.signal).then((el) => {
      if (ctl.signal.aborted) return;
      el?.scrollIntoView({ block: 'center', inline: 'nearest' });
      setTarget(el);
    });
    return () => ctl.abort();
  }, [step, navigate]);

  useEffect(() => {
    // Never auto-start under automation (Playwright) — the overlay would block the tests.
    if (running || navigator.webdriver || hasSeenTour() || AUTH_PATHS.includes(pathname)) return;
    const t = window.setTimeout(start, 900);
    return () => window.clearTimeout(t);
  }, [running, pathname, start]);

  const value = useMemo<TourState>(
    () => ({ running, step, target, index, total: steps.length, start, next, back, stop }),
    [running, step, target, index, steps.length, start, next, back, stop],
  );
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
