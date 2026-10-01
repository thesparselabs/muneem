// LLD §13: a scanner types fast; a scan is ≥ 4 characters ending in Enter, each key within 60 ms and Enter within 120 ms.
export const SCAN_MIN_LENGTH = 4;
export const SCAN_MAX_GAP_MS = 60;
export const SCAN_ENTER_MS = 120;

export interface ScanState { buffer: string; lastAt: number }
export const idleScan: ScanState = { buffer: '', lastAt: -Infinity };

export function feedKey(state: ScanState, key: string, at: number): { state: ScanState; scan?: string } {
  if (key === 'Enter') {
    const isScan = state.buffer.length >= SCAN_MIN_LENGTH && at - state.lastAt <= SCAN_ENTER_MS;
    return isScan ? { state: idleScan, scan: state.buffer } : { state: idleScan };
  }
  if (key.length !== 1) return { state: idleScan };
  const buffer = at - state.lastAt <= SCAN_MAX_GAP_MS ? state.buffer + key : key;
  return { state: { buffer, lastAt: at } };
}
