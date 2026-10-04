import type { BacklogResult } from '@muneem/contracts';
import { ensureChartOfAccounts, postBacklogBatch, rebuildAccountBalances, unpostedDocuments, type Actor, type Till } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

const BATCH = 200;

// ADR-0034: documents saved before Stage 6 get their journals in batches, yielding between them; safe to stop mid-way.
export class JournalBacklog {
  private readonly running = new Map<string, Promise<BacklogResult>>();
  private readonly started = new Set<string>();

  constructor(private readonly ctx: PosContext) {}

  // Once per business per app run, as soon as a session has it: the chart first, then the backlog when there is a terminal.
  startForSession(): Promise<BacklogResult> | null {
    const businessId = this.ctx.businessId();
    ensureChartOfAccounts(this.ctx.db(), businessId, this.ctx.actor());
    if (this.started.has(businessId) || !this.ctx.tillIfAny()) return null;
    this.started.add(businessId);
    return this.run().catch((e: unknown) => { this.started.delete(businessId); throw e; });
  }

  run(): Promise<BacklogResult> {
    const businessId = this.ctx.businessId();
    const existing = this.running.get(businessId);
    if (existing) return existing;
    const run = this.post(businessId, this.ctx.till(), this.ctx.actor()).finally(() => this.running.delete(businessId));
    this.running.set(businessId, run);
    return run;
  }

  rebuildBalances(): number { return rebuildAccountBalances(this.ctx.db(), this.ctx.businessId()); }

  // The poster and actor are fixed when the run starts; a session that moves to another business stops it between batches.
  private async post(businessId: string, poster: Till, actor: Actor): Promise<BacklogResult> {
    const db = this.ctx.db();
    const pending = unpostedDocuments(db, businessId);
    let posted = 0;
    for (let i = 0; i < pending.length && this.stillOn(businessId); i += BATCH) {
      posted += postBacklogBatch(db, businessId, pending.slice(i, i + BATCH), poster, actor);
      await new Promise((r) => setImmediate(r));
    }
    return { posted, remaining: unpostedDocuments(db, businessId).length };
  }

  private stillOn(businessId: string): boolean {
    try { return this.ctx.businessId() === businessId; } catch { return false; }
  }
}
