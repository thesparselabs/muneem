import { compactJournal, runScenario, valueAt } from './run.js';
import { SCENARIOS } from './scenarios.js';
import type { Scenario, ScenarioFile, ScenarioResult } from './types.js';

// Every HAND value and journal that does not match what the engines compute, as messages.
export function handMismatches(s: Scenario, result: ScenarioResult): string[] {
  const out: string[] = [];
  for (const [path, want] of Object.entries(s.hand.values)) {
    const got = valueAt(result, path);
    if (got !== want) out.push(`${path}: expected ${String(want)} got ${String(got)}`);
  }
  for (const [ref, want] of Object.entries(s.hand.journals)) {
    const j = result.journals.find((x) => x.ref === ref);
    const got = j ? compactJournal(j) : [];
    if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`journal ${ref}: expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
  }
  return out;
}

export function complianceFixtures(): ScenarioFile {
  return {
    version: 1,
    scenarios: SCENARIOS.map((s) => {
      const expected = runScenario(s);
      const bad = handMismatches(s, expected);
      if (bad.length > 0) throw new Error(`HAND-VERIFIED MISMATCH "${s.name}":\n  ${bad.join('\n  ')}`);
      return { ...s, expected };
    }),
  };
}
