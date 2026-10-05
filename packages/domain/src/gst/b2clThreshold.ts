// An effective-dated B2CL threshold: the latest entry on or before the date applies, else the fallback (LLD §3.1).
export interface ThresholdEntry { effectiveFrom: string; paise: number }

export function b2clThresholdOn(schedule: readonly ThresholdEntry[] | null | undefined, date: string, fallbackPaise: number): number {
  let best: ThresholdEntry | null = null;
  for (const e of schedule ?? []) if (e.effectiveFrom <= date && (!best || e.effectiveFrom >= best.effectiveFrom)) best = e;
  return best?.paise ?? fallbackPaise;
}
