/**
 * NFR-004 / HLD §7: no REAL/FLOAT/DOUBLE/NUMERIC/DECIMAL in any financial column, in SQLite or Postgres migrations.
 * A financial column is one whose name matches the pattern below. Fails CI on the first violation.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = ['packages/db-sqlite/migrations', 'cloud/migrations'];
const FINANCIAL = /(_paise|_qty|_milli|_bp|amount|price|rate|total|tax|cost|value|discount|cess|balance|limit_paise)/i;
const FLOATY = /^\s*"?([a-z_][a-z0-9_]*)"?\s+(REAL|FLOAT\d*|DOUBLE(\s+PRECISION)?|NUMERIC|DECIMAL|MONEY)\b/i;

let violations = 0;
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = FLOATY.exec(line);
      if (m && FINANCIAL.test(m[1]!)) {
        violations++;
        console.error(`${join(dir, f)}:${i + 1}: financial column "${m[1]}" declared as ${m[2]} — use INTEGER/BIGINT minor units`);
      }
    });
  }
}
if (violations) {
  console.error(`schema-lint: ${violations} violation(s)`);
  process.exit(1);
}
console.log('schema-lint: ok (no float financial columns)');
