// Writes the generated tables of the CA review pack (docs/compliance/) from the posting rules and the scenario fixtures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { postingTablesMarkdown } from './compliance/postingTables.js';
import { scenarioWorkbookMarkdown } from './compliance/workbook.js';
import type { ScenarioFile } from './compliance/types.js';

export const COMPLIANCE_DOCS = fileURLToPath(new URL('../../../docs/compliance/', import.meta.url));
export const SCENARIO_FILE = fileURLToPath(new URL('../fixtures/compliance/scenarios.json', import.meta.url));

export const generatedDocs = (): Record<string, string> => ({
  'posting-tables.md': postingTablesMarkdown(),
  'scenario-workbook.md': scenarioWorkbookMarkdown(JSON.parse(readFileSync(SCENARIO_FILE, 'utf8')) as ScenarioFile),
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(COMPLIANCE_DOCS, { recursive: true });
  for (const [name, text] of Object.entries(generatedDocs())) {
    writeFileSync(COMPLIANCE_DOCS + name, text);
    console.log(`wrote docs/compliance/${name}`);
  }
}
