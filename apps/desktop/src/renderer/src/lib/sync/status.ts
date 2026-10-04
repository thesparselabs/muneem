import type { SyncStatus } from '@muneem/contracts';

export type BadgeTone = 'ok' | 'busy' | 'warn' | 'error' | 'idle';
export interface Badge { label: string; tone: BadgeTone; title: string }

const MINUTE = 60_000;

export function age(iso: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < MINUTE) return 'just now';
  if (ms < 60 * MINUTE) return `${Math.floor(ms / MINUTE)} min`;
  if (ms < 48 * 60 * MINUTE) return `${Math.floor(ms / (60 * MINUTE))} h`;
  return `${Math.floor(ms / (24 * 60 * MINUTE))} d`;
}

export const ago = (iso: string, now: number): string => {
  const a = age(iso, now);
  return a === 'just now' ? a : `${a} ago`;
};

const BLOCKED_REASON: Record<string, string> = { revoked: 'device removed', upgrade_required: 'update required' };

function blockedReason(s: SyncStatus): string {
  if (s.deviceStatus && s.deviceStatus !== 'active') return BLOCKED_REASON[s.deviceStatus] ?? s.deviceStatus;
  if (s.auditChainBroken) return 'audit trail check failed';
  return `${s.dead} could not sync`;
}

// The waiting queue's lag is shown once the oldest unsent change is at least a minute old.
function lag(s: SyncStatus, now: number): string {
  if (!s.oldestPendingAt) return '';
  const a = age(s.oldestPendingAt, now);
  return a === 'just now' ? '' : ` · oldest ${a}`;
}

// LLD §8.4 / FR-068 badge text.
export function syncBadge(s: SyncStatus, online: boolean, now: number): Badge {
  const title = [s.detail, s.lastPushAt && `Last sent ${ago(s.lastPushAt, now)}`, s.lastPullAt && `Last received ${ago(s.lastPullAt, now)}`, 'Open Diagnostics']
    .filter(Boolean).join(' · ');
  switch (s.state) {
    case 'synced': return { label: `✓ Synced${s.lastPushAt ? ` · ${ago(s.lastPushAt, now)}` : ''}`, tone: 'ok', title };
    case 'syncing': return { label: `⟳ Syncing ${s.inFlight}`, tone: 'busy', title };
    case 'queued': return { label: `⚠ ${s.pending} waiting${online ? '' : ' · offline'}${lag(s, now)}`, tone: 'warn', title };
    case 'degraded': return { label: `⚠ retrying (${s.failed} failed)${lag(s, now)}`, tone: 'warn', title };
    case 'blocked': return { label: `✕ Needs attention · ${blockedReason(s)}`, tone: 'error', title };
    case 'never': return { label: online ? '– Not synced yet' : '– Offline', tone: 'idle', title };
  }
}

// FR-087: the POS admits how stale its stock is, but only when another terminal could be selling the same goods.
export function stockStaleness(s: SyncStatus | null, now: number): string | null {
  if (!s || s.terminalCount < 2) return null;
  if (!s.documentsPulledAt) return 'Stock has not been updated from other terminals yet';
  const a = age(s.documentsPulledAt, now);
  return a === 'just now' ? 'Stock last updated just now' : `Stock last updated ${a} ago`;
}
