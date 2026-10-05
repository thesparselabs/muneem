import { describe, expect, it } from 'vitest';
import type { CustomerConsent, Notification, NotificationCounts } from '@muneem/contracts';
import { attentionNote, bell, groupBySeverity, kindLabel } from '../../src/renderer/src/lib/notifications.js';
import { channelsToAsk, consentRows, eraseBlocker } from '../../src/renderer/src/lib/parties/consent.js';

const note = (id: string, severity: Notification['severity'], kind: Notification['kind'] = 'low_stock'): Notification => ({
  id, kind, severity, entityType: 'product', entityId: id, title: id, body: '', link: null,
  createdAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-05T10:00:00Z', readAt: null, dismissedAt: null, resolvedAt: null,
});
const counts = (over: Partial<NotificationCounts> & { info?: number; warning?: number; critical?: number }): NotificationCounts => {
  const bySeverity = { info: over.info ?? 0, warning: over.warning ?? 0, critical: over.critical ?? 0 };
  const open = bySeverity.info + bySeverity.warning + bySeverity.critical;
  return { open, unread: over.unread ?? open, bySeverity };
};

describe('notification centre helpers (8h)', () => {
  it('groups worst first, keeping each group in the order it came, and drops empty groups', () => {
    const groups = groupBySeverity([note('a', 'info'), note('b', 'critical'), note('c', 'info'), note('d', 'critical')]);
    expect(groups.map((g) => [g.severity, g.items.map((n) => n.id)])).toEqual([['critical', ['b', 'd']], ['info', ['a', 'c']]]);
    expect(groups[0]!.label).toBe('Needs action now');
    expect(groupBySeverity([])).toEqual([]);
  });

  it('the bell counts unread, caps at 9+, and takes the worst open severity', () => {
    expect(bell(undefined)).toMatchObject({ count: '', tone: 'none' });
    expect(bell(counts({ warning: 2, info: 1 }))).toMatchObject({ count: '3', tone: 'warning', label: 'Notifications, 3 unread of 3 open' });
    expect(bell(counts({ info: 12, critical: 1 }))).toMatchObject({ count: '9+', tone: 'critical' });
    expect(bell(counts({ info: 2, unread: 0 }))).toMatchObject({ count: '', tone: 'info' });
  });

  it('summarises open counts for the dashboard and labels kinds', () => {
    expect(attentionNote(counts({}))).toBeUndefined();
    expect(attentionNote(counts({ critical: 1, info: 4 }))).toBe('1 critical · 4 info');
    expect(kindLabel('customer_overdue')).toBe('Customer overdue');
  });
});

describe('consent helpers (FR-104)', () => {
  const consent = (id: string, channel: CustomerConsent['channel'], givenAt: string, withdrawnAt: string | null = null): CustomerConsent =>
    ({ id, purpose: 'payment_reminders', channel, method: 'in_person', givenAt, withdrawnAt, capturedBy: 'u' });

  it('lists active consents first, then the history, and offers only channels not yet agreed', () => {
    const list = [consent('old', 'sms', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'), consent('wa', 'whatsapp', '2026-03-01T00:00:00Z')];
    expect(consentRows(list).map((r) => [r.id, r.active])).toEqual([['wa', true], ['old', false]]);
    expect(consentRows(list)[1]!.when).toBe('given 2026-01-01, withdrawn 2026-02-01');
    expect(consentRows(list)[0]!.text).toBe('Payment reminders by WhatsApp · In person');
    expect(channelsToAsk(list)).toEqual(['sms']);
    expect(channelsToAsk(undefined)).toEqual(['sms', 'whatsapp']);
  });

  it('blocks erasure until the balance is square either way', () => {
    expect(eraseBlocker(undefined)).toMatch(/Loading/u);
    expect(eraseBlocker(12_000)).toBe('The customer still owes ₹120.00. Settle it first.');
    expect(eraseBlocker(-5_000)).toMatch(/₹50.00 in advance/u);
    expect(eraseBlocker(0)).toBeNull();
  });
});
