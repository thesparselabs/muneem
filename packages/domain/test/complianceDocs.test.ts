import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COMPLIANCE_DOCS, generatedDocs } from '../scripts/gen-compliance-docs.js';
import { CATALOGUED, RULE_NAMES } from '../scripts/compliance/postingTables.js';

// The CA review pack's tables are generated; this keeps them from drifting from the rules and the fixtures.
describe('CA review pack (docs/compliance)', () => {
  it('lists every posting rule the accounting module exports', () => {
    expect(CATALOGUED).toEqual(RULE_NAMES);
  });

  for (const [name, text] of Object.entries(generatedDocs())) {
    it(`${name} matches the rules and fixtures (run \`pnpm --filter @muneem/domain gen:compliance\`)`, () => {
      expect(readFileSync(COMPLIANCE_DOCS + name, 'utf8')).toBe(text);
    });
  }
});
