const KEY = 'muneem-tour-seen';

export function hasSeenTour(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}

export function markTourSeen(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
}
