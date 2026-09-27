import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeInvoice, type GstFixtureFile } from '../src/index.js';

// THE cross-language contract: cloud/internal/domain/gst runs these same files (HLD §5.1).
const dir = fileURLToPath(new URL('../fixtures/gst/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

describe('GST golden vectors', () => {
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const fx = JSON.parse(readFileSync(dir + f, 'utf8')) as GstFixtureFile;
    describe(f, () => {
      for (const c of fx.cases) {
        it(c.name, () => expect(computeInvoice(c.input)).toEqual(c.expected));
      }
    });
  }
});
