import { gzipSync } from 'node:zlib';
import { STREAM_OF, STREAM_ORDER, type BundleHeader, type Change, type SyncStream } from '@muneem/contracts';
import type { BusinessState } from './state.js';

// Cloud-made control types follow accounting_period (ADR-0038, as built 7f).
const CLOUD_MADE_CONTROL = ['device', 'conflict_log'];
const typeOrder = new Map([...Object.keys(STREAM_OF), ...CLOUD_MADE_CONTROL].map((t, i) => [t, i]));
const rank = (t: string): number => typeOrder.get(t) ?? typeOrder.size;

// Control, config and masters: each entity's latest change; documents: every version, in seq order.
function streamLines(b: BusinessState, stream: SyncStream): Change[] {
  const changes = b.changes.filter((c) => c.stream === stream);
  if (stream === 'documents') return changes;
  const latest = new Map<string, Change>();
  for (const c of changes) latest.set(`${c.entityType}:${c.entityId}`, c);
  return [...latest.values()].sort((x, y) => rank(x.entityType) - rank(y.entityType) || x.seq - y.seq);
}

export interface Bundle { header: BundleHeader; changes: Change[] }

export function buildBundle(b: BusinessState): Bundle {
  const byStream = STREAM_ORDER.map((s) => [s, streamLines(b, s)] as const);
  const asOfSeq = b.changes.reduce((max, c) => Math.max(max, c.seq), 0);
  return {
    header: { format: 'muneem-bundle', version: 1, businessId: b.id, asOfSeq, counts: Object.fromEntries(byStream.map(([s, c]) => [s, c.length])) },
    changes: byStream.flatMap(([, c]) => c),
  };
}

// The object a bundle URL serves: gzipped NDJSON, header first.
export const encodeBundle = (bundle: Bundle): Buffer =>
  gzipSync(Buffer.from([bundle.header, ...bundle.changes].map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8'));
