import { listFailedOperations, listReviewItems, markReviewed, resendOperations, stockReconciliation, syncOverview, type Db } from '@muneem/db-sqlite';
import type { Handlers } from '../ipc/gateway.js';

export interface SyncScreenDeps {
  db: () => Db;
  businessId: () => string;
  userId: () => string;
  localDeviceId: () => string;
  onResent: () => void;
}

// 7g read models and the two manager actions behind the sync screens.
export function syncScreenHandlers(d: SyncScreenDeps): Pick<Handlers, 'sync.getOverview' | 'sync.listFailed' | 'sync.resend' | 'sync.listReviewItems' | 'sync.markReviewed' | 'inventory.stockReconciliation'> {
  return {
    'sync.getOverview': () => syncOverview(d.db(), d.businessId()),
    'sync.listFailed': (i) => listFailedOperations(d.db(), d.businessId(), i.limit),
    'sync.resend': (i) => {
      const resent = resendOperations(d.db(), d.businessId(), i.operationIds);
      if (resent > 0) d.onResent();
      return { resent };
    },
    'sync.listReviewItems': (i) => listReviewItems(d.db(), d.businessId(), i.status, i.limit),
    'sync.markReviewed': (i) => ({ reviewed: markReviewed(d.db(), d.businessId(), i.ids, d.userId()) }),
    'inventory.stockReconciliation': (i) => stockReconciliation(d.db(), d.businessId(), d.localDeviceId(), i.limit),
  };
}
