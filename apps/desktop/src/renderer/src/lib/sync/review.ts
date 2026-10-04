import type { ReviewItem } from '@muneem/contracts';

const KINDS: [string[], string][] = [
  [['audit_chain_broken'], 'Audit trail breaks'],
  [['conflict', 'field_conflict'], 'Field conflicts'],
  [['tombstone', 'tombstone_wins'], 'Deleted elsewhere'],
  [['duplicate_barcode'], 'Duplicate barcodes'],
  [['late_arrival'], 'Late arrivals'],
];

const RULES: Record<string, string> = {
  cloud_wins: 'Head office value kept',
  last_writer_wins: 'Latest edit kept',
  tombstone_wins: 'Delete wins over an edit',
  keep_both: 'Both kept for review',
  stored_as_sent: 'Stored as sent into a locked month',
  audit_chain: 'Audit row refused by the cloud',
};

const words = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const kindLabel = (kind: string): string => KINDS.find(([k]) => k.includes(kind))?.[1] ?? words(kind);
export const ruleLabel = (rule: string): string => RULES[rule] ?? words(rule);
export const winnerLabel = (winner: string): string => (winner === 'cloud' ? 'Cloud' : winner === 'device' ? 'This edit' : words(winner));

export interface ReviewGroup { label: string; items: ReviewItem[] }

// Known kinds first in a fixed order, then anything else (local clashes, future kinds) by its own name.
export function groupReviewItems(items: readonly ReviewItem[]): ReviewGroup[] {
  const groups = new Map<string, ReviewItem[]>();
  for (const i of items) {
    const label = kindLabel(i.kind);
    groups.set(label, [...(groups.get(label) ?? []), i]);
  }
  const order = KINDS.map(([, l]) => l);
  const rank = (l: string) => (order.includes(l) ? order.indexOf(l) : order.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([label, list]) => ({ label, items: list }));
}

export interface VersionRow { key: string; cloud: string; device: string; differs: boolean }

const parse = (json: string | null): unknown => {
  if (json === null) return undefined;
  try { return JSON.parse(json); } catch { return json; }
};
const show = (v: unknown): string => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Both versions side by side: objects key by key, anything else as one row named after the field.
export function diffVersions(item: Pick<ReviewItem, 'field' | 'cloudValueJson' | 'deviceValueJson'>): VersionRow[] {
  const cloud = parse(item.cloudValueJson), device = parse(item.deviceValueJson);
  if (cloud === undefined && device === undefined) return [];
  if (isRecord(cloud) && isRecord(device)) {
    const keys = [...new Set([...Object.keys(cloud), ...Object.keys(device)])].sort();
    return keys.map((key) => ({ key, cloud: show(cloud[key]), device: show(device[key]), differs: JSON.stringify(cloud[key]) !== JSON.stringify(device[key]) }));
  }
  return [{ key: item.field ?? 'value', cloud: show(cloud), device: show(device), differs: JSON.stringify(cloud) !== JSON.stringify(device) }];
}
