import type { BacklogResult } from '@muneem/contracts';
import { postBacklogBatch, rebuildAccountBalances, unpostedDocuments } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

const BATCH = 200;

// ADR-0034: documents saved before Stage 6 get their journals in batches, yielding between them; safe to stop mid-way.
export class JournalBacklog {
  private running: Promise<BacklogResult> | null = null;

  constructor(private readonly ctx: PosContext) {}

  run(): Promise<BacklogResult> {
    this.running ??= this.post().finally(() => { this.running = null; });
    return this.running;
  }

  rebuildBalances(): number { return rebuildAccountBalances(this.ctx.db(), this.ctx.businessId()); }

  private async post(): Promise<BacklogResult> {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const pending = unpostedDocuments(db, businessId);
    let posted = 0;
    for (let i = 0; i < pending.length; i += BATCH) {
      posted += postBacklogBatch(db, businessId, pending.slice(i, i + BATCH), this.ctx.till(), this.ctx.actor());
      await new Promise((r) => setImmediate(r));
    }
    return { posted, remaining: unpostedDocuments(db, businessId).length };
  }
}
