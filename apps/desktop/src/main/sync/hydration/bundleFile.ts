import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { BundleHeader, Change } from '@muneem/contracts';

// Streamed gunzip and line parse: the bundle is never held whole in memory.
async function* lines(path: string): AsyncGenerator<unknown> {
  const input = createReadStream(path).pipe(createGunzip());
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) if (line.length > 0) yield JSON.parse(line) as unknown;
  } finally {
    input.destroy();
  }
}

async function* changes(path: string): AsyncGenerator<Change> {
  let first = true;
  for await (const line of lines(path)) {
    if (!first) yield Change.parse(line);
    first = false;
  }
}

export async function readHeader(path: string): Promise<BundleHeader> {
  for await (const line of lines(path)) return BundleHeader.parse(line);
  throw new Error('the hydration bundle is empty');
}

// The bundle's order with config first: the business that periods and review items belong to must exist before them (ADR-0040).
export async function* importOrder(path: string): AsyncGenerator<Change> {
  for await (const c of changes(path)) {
    if (c.stream === 'config') yield c;
    else if (c.stream !== 'control') break;
  }
  for await (const c of changes(path)) if (c.stream !== 'config') yield c;
}
