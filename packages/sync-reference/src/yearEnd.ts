import type { PushOperation, SyncError } from '@muneem/contracts';
import type { BusinessState, Payload } from './state.js';

interface ClosingPayload { version?: number; journal?: { id?: string } | null }

const closingsOf = (p: Payload): ClosingPayload[] => (Array.isArray(p.closings) ? (p.closings as ClosingPayload[]) : []);
const invalid = (detail: string): SyncError => ({ code: 'INVALID_STATE', class: 'permanent', detail });

function fyMonths(fy: string): string[] {
  const y = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => `${i < 9 ? y : y + 1}-${String(((i + 3) % 12) + 1).padStart(2, '0')}-01`);
}

// ADR-0045: one close per business and year, made only once all its months are locked; each later version adds exactly one
// closing on top of the one the cloud holds, so two devices adjusting at once cannot both stand.
export function yearCloseRefusal(b: BusinessState, op: PushOperation): SyncError | null {
  if (op.entityType !== 'fy_close') return null;
  const fy = String(op.payload.fy);
  const version = Number(op.payload.version);
  const existing = b.entity('fy_close', op.entityId);
  if (op.operationType === 'create') {
    const other = [...b.entities.values()].find((e) => e.entityType === 'fy_close' && e.payload.fy === fy);
    if (other) return invalid(`${fy} is already closed (${other.entityId})`);
    if (version !== 1) return invalid('a close starts at version 1');
    const open = fyMonths(fy).filter((m) => !b.lockedMonths.has(m));
    return open.length > 0 ? invalid(`${fy} has months not locked: ${open.map((m) => m.slice(0, 7)).join(', ')}`) : null;
  }
  if (!existing) return null;
  if (version !== existing.version + 1) return invalid(`${fy} is at version ${existing.version}; this adjustment was made from version ${version - 1}`);
  const held = closingsOf(existing.payload).map((c) => c.journal?.id ?? null);
  const sent = closingsOf(op.payload).map((c) => c.journal?.id ?? null);
  return sent.length === held.length + 1 && held.every((id, i) => sent[i] === id) ? null : invalid(`${fy}: an adjustment must keep every earlier closing`);
}

// The closing journal closes exactly the balances it names, to 3300, and touches nothing else.
export function closingsHold(p: Payload): boolean {
  return closingsOf(p).every((c) => {
    const balances = ((c as { balances?: { code: string; netPaise: number }[] }).balances ?? []).filter((x) => x.netPaise !== 0);
    const lines = ((c.journal as { lines?: { account: { code?: string; role?: string }; debitPaise: number; creditPaise: number }[] } | null)?.lines) ?? [];
    if (!c.journal) return balances.length === 0;
    const net = new Map<string, number>();
    for (const l of lines) {
      const key = l.account.role === 'retained_earnings' ? '3300' : l.account.code ?? `role:${l.account.role}`;
      net.set(key, (net.get(key) ?? 0) + l.debitPaise - l.creditPaise);
    }
    const profit = -balances.reduce((s, x) => s + x.netPaise, 0);
    return balances.every((x) => net.get(x.code) === -x.netPaise) && (net.get('3300') ?? 0) === -profit && net.size === balances.length + (profit === 0 ? 0 : 1);
  });
}
