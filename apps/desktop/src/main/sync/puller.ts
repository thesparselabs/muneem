import { PULL_MAX_LIMIT, STREAM_ORDER, type SyncStream } from '@muneem/contracts';
import {
  applyPullPage, deleteMeta, emptyPageResult, getBusiness, getCursor, getMeta, META_KEYS, realignDocSeries, withTransaction, type Db, type PageResult,
} from '@muneem/db-sqlite';
import type { Transport } from './transport.js';
import { authorized, type WireIdentity } from './wire.js';

export interface PullerDeps {
  db: () => Db;
  transport: Transport;
  refreshAuth: () => Promise<boolean>;
  now: () => number;
  pageSize?: number;
}

// 7e: each stream in order, page by page from its cursor; a page and its cursor commit together, so a crash re-pulls at most one page.
export class Puller {
  constructor(private readonly d: PullerDeps) {}

  // Control comes first (LLD §7.2), except on a device that has not yet got the business its locks and review items belong to.
  private order(businessId: string): readonly SyncStream[] {
    return getBusiness(this.d.db(), businessId) ? STREAM_ORDER : ['config', ...STREAM_ORDER.filter((s) => s !== 'config')];
  }

  // After this device restores its own backup (8f), its changes made since the backup come back as well, until a full pull ends.
  async pullAll(id: WireIdentity): Promise<PageResult> {
    const includeOwn = getMeta(this.d.db(), META_KEYS.restoreCatchUp) === '1';
    const total = emptyPageResult();
    for (const stream of this.order(id.businessId)) {
      for (;;) {
        const since = getCursor(this.d.db(), id.businessId, stream);
        const page = await authorized((t) => t.pull({ businessId: id.businessId, stream, since, limit: this.d.pageSize ?? PULL_MAX_LIMIT }), this.d.transport, this.d.refreshAuth);
        const r = applyPullPage(this.d.db(), { ...id, includeOwn }, stream, page, new Date(this.d.now()).toISOString());
        for (const k of Object.keys(total) as (keyof PageResult)[]) total[k] += r[k];
        if (!page.hasMore || page.nextSeq <= since) break;
      }
    }
    if (includeOwn) {
      const db = this.d.db();
      withTransaction(db, () => { realignDocSeries(db, id.businessId); deleteMeta(db, META_KEYS.restoreCatchUp); });
    }
    return total;
  }
}
