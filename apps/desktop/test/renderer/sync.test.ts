import { describe, expect, it } from 'vitest';
import type { ReconciliationRow, ReviewItem, SyncStatus } from '@muneem/contracts';
import { ago, stockStaleness, syncBadge } from '../../src/renderer/src/lib/sync/status.js';
import { diffVersions, groupReviewItems, kindLabel, ruleLabel } from '../../src/renderer/src/lib/sync/review.js';
import { reconcile } from '../../src/renderer/src/lib/sync/reconciliation.js';
import { errorLine, payloadPreview } from '../../src/renderer/src/lib/sync/outbox.js';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const status = (over: Partial<SyncStatus>): SyncStatus => ({
  state: 'synced', pending: 0, inFlight: 0, failed: 0, dead: 0, lastPushAt: minutesAgo(2), lastPullAt: minutesAgo(2), online: true, serverSkewMs: 0, detail: null,
  deviceStatus: 'active', oldestPendingAt: null, documentsPulledAt: null, terminalCount: 1, ...over,
});

describe('sync badge (FR-068, LLD §8.4)', () => {
  it('says each state the way the LLD does', () => {
    expect(syncBadge(status({}), true, NOW)).toMatchObject({ label: '✓ Synced · 2 min ago', tone: 'ok' });
    expect(syncBadge(status({ state: 'syncing', inFlight: 12 }), true, NOW).label).toBe('⟳ Syncing 12');
    expect(syncBadge(status({ state: 'queued', pending: 34 }), false, NOW).label).toBe('⚠ 34 waiting · offline');
    expect(syncBadge(status({ state: 'degraded', failed: 3 }), true, NOW)).toMatchObject({ label: '⚠ retrying (3 failed)', tone: 'warn' });
    expect(syncBadge(status({ state: 'blocked', dead: 2 }), true, NOW)).toMatchObject({ label: '✕ Needs attention · 2 could not sync', tone: 'error' });
    expect(syncBadge(status({ state: 'never' }), false, NOW).label).toBe('– Offline');
  });

  it('names why a device is blocked', () => {
    expect(syncBadge(status({ state: 'blocked', deviceStatus: 'revoked' }), true, NOW).label).toBe('✕ Needs attention · device removed');
    expect(syncBadge(status({ state: 'blocked', deviceStatus: 'upgrade_required', detail: 'App too old' }), true, NOW)).toMatchObject({
      label: '✕ Needs attention · update required', title: expect.stringContaining('App too old'),
    });
  });

  it('shows the lag once the oldest waiting change is a minute old', () => {
    expect(syncBadge(status({ state: 'queued', pending: 5, oldestPendingAt: minutesAgo(0.5) }), true, NOW).label).toBe('⚠ 5 waiting');
    expect(syncBadge(status({ state: 'queued', pending: 5, oldestPendingAt: minutesAgo(90) }), false, NOW).label).toBe('⚠ 5 waiting · offline · oldest 1 h');
    expect(syncBadge(status({ state: 'degraded', failed: 1, oldestPendingAt: minutesAgo(12) }), true, NOW).label).toBe('⚠ retrying (1 failed) · oldest 12 min');
  });

  it('formats relative times', () => {
    expect([ago(minutesAgo(0.2), NOW), ago(minutesAgo(59), NOW), ago(minutesAgo(60 * 30), NOW), ago(minutesAgo(60 * 72), NOW)]).toEqual(['just now', '59 min ago', '30 h ago', '3 d ago']);
  });
});

describe('POS stock staleness (FR-087)', () => {
  it('appears only when another terminal exists', () => {
    expect(stockStaleness(status({ documentsPulledAt: minutesAgo(7) }), NOW)).toBeNull();
    expect(stockStaleness(status({ terminalCount: 2, documentsPulledAt: minutesAgo(7) }), NOW)).toBe('Stock last updated 7 min ago');
    expect(stockStaleness(status({ terminalCount: 2 }), NOW)).toBe('Stock has not been updated from other terminals yet');
    expect(stockStaleness(null, NOW)).toBeNull();
  });
});

const item = (over: Partial<ReviewItem>): ReviewItem => ({
  id: 'R', kind: 'field_conflict', entityType: 'product', entityId: 'P1', entityLabel: 'Soap', deviceId: 'D', rule: 'cloud_wins', winner: 'cloud', field: null,
  cloudValueJson: null, deviceValueJson: null, occurredAt: '2026-10-04T10:00:00Z', receivedAt: '2026-10-04T10:00:00Z', reviewedAt: null, reviewedBy: null, ...over,
});

describe('review items', () => {
  it('groups known kinds in a fixed order and keeps unknown ones', () => {
    const groups = groupReviewItems([
      item({ id: 'a', kind: 'late_arrival' }), item({ id: 'b', kind: 'unique_clash' }), item({ id: 'c', kind: 'conflict' }), item({ id: 'd', kind: 'field_conflict' }),
      item({ id: 'e', kind: 'tombstone' }), item({ id: 'f', kind: 'duplicate_barcode' }),
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Field conflicts', ['c', 'd']], ['Deleted elsewhere', ['e']], ['Duplicate barcodes', ['f']], ['Late arrivals', ['a']], ['Unique clash', ['b']],
    ]);
    expect([kindLabel('tombstone_wins'), ruleLabel('last_writer_wins'), ruleLabel('some_new_rule')]).toEqual(['Deleted elsewhere', 'Latest edit kept', 'Some new rule']);
  });

  it('lines both versions up side by side', () => {
    expect(diffVersions(item({ field: 'sellingPricePaise', cloudValueJson: '5000', deviceValueJson: '4000' }))).toEqual([
      { key: 'sellingPricePaise', cloud: '5000', device: '4000', differs: true },
    ]);
    expect(diffVersions(item({ cloudValueJson: '{"name":"Soap","mrp":10}', deviceValueJson: '{"name":"Soap Bar","mrp":10,"hsn":"3401"}' }))).toEqual([
      { key: 'hsn', cloud: '—', device: '3401', differs: true }, { key: 'mrp', cloud: '10', device: '10', differs: false }, { key: 'name', cloud: 'Soap', device: 'Soap Bar', differs: true },
    ]);
    expect(diffVersions(item({ kind: 'duplicate_barcode', cloudValueJson: '"P2"' }))).toEqual([{ key: 'value', cloud: 'P2', device: '—', differs: true }]);
    expect(diffVersions(item({}))).toEqual([]);
  });
});

const recRow = (over: Partial<ReconciliationRow>): ReconciliationRow => ({
  productId: 'P1', productName: 'Soap', uomCode: 'PCS', warehouseId: 'W', warehouseName: 'Main', currentQtyMilli: -2000, movementId: 'M1', movementType: 'sale',
  refType: 'sale', refId: 'S1', docNumber: 'T01/1', terminalCode: 'T01', deviceId: 'D', viaSync: false, occurredAt: '2026-10-04T10:00:00Z', qtyMilli: -1000,
  balanceAfterMilli: -1000, ...over,
});

describe('stock reconciliation rows', () => {
  it('groups breaches per product, oldest first, lowest product first, and can keep only synced oversells', () => {
    const rows = [
      recRow({ movementId: 'M2', occurredAt: '2026-10-04T11:00:00Z', terminalCode: 'T02', viaSync: true, balanceAfterMilli: -2000 }),
      recRow({ movementId: 'M1' }),
      recRow({ productId: 'P2', productName: 'Tea', movementId: 'M3', refType: 'adjustment', docNumber: null, terminalCode: null, currentQtyMilli: -500, balanceAfterMilli: -500 }),
    ];
    const all = reconcile(rows);
    expect(all.map((p) => [p.productName, p.lowestMilli, p.viaSync, p.breaches.map((b) => `${b.movementId}:${b.source}`)])).toEqual([
      ['Soap', -2000, true, ['M1:Terminal T01', 'M2:Terminal T02']], ['Tea', -500, false, ['M3:Adjustment']],
    ]);
    expect(reconcile(rows, { viaSyncOnly: true }).map((p) => p.productName)).toEqual(['Soap']);
    expect(reconcile([recRow({ terminalCode: null, viaSync: true })])[0]!.breaches[0]!.source).toBe('Another terminal');
  });
});

describe('outbox preview', () => {
  it('pretty-prints a payload and marks one cut short', () => {
    expect(payloadPreview({ payloadJson: '{"a":1}', payloadBytes: 7 })).toBe('{\n  "a": 1\n}');
    expect(payloadPreview({ payloadJson: '{"a":"xxxx', payloadBytes: 20_000 }, 5)).toBe('{"a":\n… (20,000 bytes in all)');
    expect(errorLine({ errorCode: 'TOTAL_MISMATCH', errorClass: 'permanent', errorMessage: 'total off' })).toBe('TOTAL_MISMATCH (permanent) total off');
  });
});
