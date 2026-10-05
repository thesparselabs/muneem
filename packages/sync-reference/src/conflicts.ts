import { sameValue } from './canonical.js';

type Payload = Record<string, unknown>;

// ADR-0041: on these the cloud keeps its value when both sides changed it (both spellings: product payloads carry columns).
const CLOUD_WINS_FIELDS = new Set([
  'sellingPricePaise', 'mrpPaise', 'mrp_paise', 'gstRateBp', 'gst_rate_bp', 'cessRateBp', 'cess_rate_bp', 'taxTreatment', 'tax_treatment',
  'creditLimitPaise',
]);
// Whole entities that are cloud-authoritative: config, price list items and the credit limit.
const CLOUD_WINS_TYPES = new Set(['setting', 'doc_series', 'terminal', 'user_pin', 'price_list_item', 'customer_credit_limit']);
const BOOKKEEPING = new Set(['version', 'updatedAt']);

export interface Stored { payload: Payload; updatedAt: string | null; deviceId: string }
export interface Incoming { payload: Payload; updatedAt: string | null; deviceId: string }
export interface FieldConflict { field: string; rule: 'cloud_wins' | 'last_writer_wins'; winner: 'cloud' | 'device'; cloudValue: unknown; deviceValue: unknown }
export interface Merge { payload: Payload; conflicts: FieldConflict[] }

// ADR-0050: an erased customer's profile stays erased; a stale edit made before the erasure cannot bring any of it back.
const erasureWins = (entityType: string, stored: Payload, incoming: Payload): boolean =>
  entityType === 'customer' && typeof stored.erasedAt === 'string' && typeof incoming.erasedAt !== 'string';

const cloudWins = (entityType: string, field: string): boolean => CLOUD_WINS_TYPES.has(entityType) || CLOUD_WINS_FIELDS.has(field);

// Later updatedAt wins; a tie goes to the higher device id, so every replay picks the same side.
const deviceIsLater = (s: Stored, i: Incoming): boolean => {
  const a = i.updatedAt ?? '';
  const b = s.updatedAt ?? '';
  return a === b ? i.deviceId > s.deviceId : a > b;
};

// A push based on an older version is merged field by field against the version it was based on (ADR-0041).
export function mergeStale(entityType: string, base: Payload, stored: Stored, incoming: Incoming): Merge {
  if (erasureWins(entityType, stored.payload, incoming.payload)) {
    return { payload: { ...stored.payload }, conflicts: [{ field: 'erasedAt', rule: 'cloud_wins', winner: 'cloud', cloudValue: stored.payload.erasedAt, deviceValue: null }] };
  }
  const payload: Payload = { ...stored.payload };
  const conflicts: FieldConflict[] = [];
  for (const [field, deviceValue] of Object.entries(incoming.payload)) {
    if (BOOKKEEPING.has(field)) continue;
    const cloudValue = stored.payload[field];
    const deviceChanged = !sameValue(deviceValue, base[field]);
    if (!deviceChanged) continue;
    if (sameValue(cloudValue, base[field])) {
      payload[field] = deviceValue;
      continue;
    }
    if (sameValue(cloudValue, deviceValue)) continue;
    const rule = cloudWins(entityType, field) ? 'cloud_wins' : 'last_writer_wins';
    const winner = rule === 'last_writer_wins' && deviceIsLater(stored, incoming) ? 'device' : 'cloud';
    if (winner === 'device') payload[field] = deviceValue;
    conflicts.push({ field, rule, winner, cloudValue, deviceValue });
  }
  const latest = [stored.updatedAt, incoming.updatedAt].filter((x): x is string => !!x).sort().at(-1);
  if (latest) payload.updatedAt = latest;
  return { payload, conflicts };
}

// The sender's own change comes back only when the stored result differs from what it sent (null origin).
export const matchesSent = (stored: Payload, sent: Payload): boolean =>
  Object.entries(sent).every(([k, v]) => BOOKKEEPING.has(k) || sameValue(stored[k], v));
