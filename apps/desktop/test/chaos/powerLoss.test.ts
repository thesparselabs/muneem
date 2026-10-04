import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { killDuring } from '../crash/killLoop.js';
import { checkDocuments } from './checkDocuments.js';
import type { DocumentKind } from './documentKinds.js';

const here = dirname(fileURLToPath(import.meta.url));
// About a second per kill; `pnpm chaos` raises it.
const KILLS = Number(process.env.MUNEEM_CHAOS_KILLS ?? 20);

// The kill window is roughly one pass of the child's loop, so kills land anywhere in it.
const CASES: { kind: DocumentKind; windowMs: number; made: string[] }[] = [
  { kind: 'returns', windowMs: 100, made: ['sale', 'credit_note'] },
  { kind: 'purchases', windowMs: 150, made: ['purchase', 'debit_note'] },
  { kind: 'payments', windowMs: 150, made: ['payment', 'sale', 'purchase'] },
  { kind: 'setoff', windowMs: 250, made: ['gst_setoff'] },
  { kind: 'yearEnd', windowMs: 500, made: ['fy_close', 'gst_setoff'] },
];

describe('power loss mid-commit (9g, NFR-019)', () => {
  it.each(CASES)(`${KILLS} SIGKILLs while posting $kind leave whole documents only`, async ({ kind, windowMs, made }) => {
    const file = join(mkdtempSync(join(tmpdir(), `muneem-chaos-${kind}-`)), 'muneem.sqlite');
    await killDuring(join(here, 'documentsChild.ts'), [file, kind], KILLS, windowMs);
    const report = checkDocuments(file);
    console.info(kind, JSON.stringify(report));
    expect(report.failures).toEqual([]);
    for (const table of made) expect(report.counts[table], `${kind} made ${table}`).toBeGreaterThan(0);
  }, 900_000);
});
