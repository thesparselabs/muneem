import { AppError, type ImportMapping } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import type { Table } from './tableReader.js';

export interface PreviewSession<M = ImportMapping> { id: string; businessId: string; fileName: string; table: Table; mapping: M; lastUsedAt: number }

const TTL_MS = 15 * 60 * 1000;

// Parsed files stay in main-process memory only; a restart simply asks for the file again.
export class PreviewStore<M = ImportMapping> {
  private readonly sessions = new Map<string, PreviewSession<M>>();
  constructor(private readonly now: () => number) {}

  put(s: Omit<PreviewSession<M>, 'id' | 'lastUsedAt'>): PreviewSession<M> {
    this.evictExpired();
    const session = { ...s, id: newUlid(), lastUsedAt: this.now() };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string, businessId: string): PreviewSession<M> {
    this.evictExpired();
    const s = this.sessions.get(id);
    if (!s || s.businessId !== businessId) throw new AppError('INVALID_STATE', 'This preview has expired. Choose the file again.');
    s.lastUsedAt = this.now();
    return s;
  }

  update(s: PreviewSession<M>): void { this.sessions.set(s.id, { ...s, lastUsedAt: this.now() }); }
  delete(id: string): void { this.sessions.delete(id); }

  private evictExpired(): void {
    const cutoff = this.now() - TTL_MS;
    for (const [id, s] of this.sessions) if (s.lastUsedAt < cutoff) this.sessions.delete(id);
  }
}
