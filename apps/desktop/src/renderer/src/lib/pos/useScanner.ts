import { useEffect, useRef } from 'react';
import { feedKey, idleScan, type ScanState } from './scanBuffer.js';

// Scans are picked up when focus is on the page or on a field marked data-scan-target; other fields keep their typing.
export function useScanner(onScan: (code: string) => void, enabled: boolean): void {
  const state = useRef<ScanState>(idleScan);
  const handler = useRef(onScan);
  handler.current = onScan;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName) && !target.dataset.scanTarget;
      if (typing) { state.current = idleScan; return; }
      const r = feedKey(state.current, e.key, e.timeStamp);
      state.current = r.state;
      if (r.scan) {
        e.preventDefault();
        if (target?.dataset.scanTarget && 'value' in target) (target as HTMLInputElement).value = '';
        handler.current(r.scan);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
