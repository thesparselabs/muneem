import type { NotificationKind, StockRow, SyncStatus } from '@muneem/contracts';
import { addDays, formatRupees } from '@muneem/domain';
import type { BackupHealthRow, NotificationRaise, PartyDue } from '@muneem/db-sqlite';

type Raise = Omit<NotificationRaise, 'kind'>;

export interface DetectorSources {
  today(): string;
  now(): number;
  lowStock(): StockRow[];
  dues(partyType: 'customer' | 'supplier', dueBefore: string): PartyDue[];
  syncStatus(): SyncStatus;
  backupHealth(): BackupHealthRow;
  businessCreatedAt(): string | null;
  reviewCounts(): { total: number; lateArrivals: number };
}

export interface Detector {
  kind: NotificationKind;
  // business detectors need an open business; device ones run without one
  needsBusiness: boolean;
  detect(s: DetectorSources): Raise[];
}

export const SUPPLIER_DUE_DAYS = 7;
export const BACKUP_STALE_HOURS = 26;
const HOUR_MS = 3_600_000;
const qty = (milli: number): string => String(milli / 1000);
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

const lowStock: Detector = {
  kind: 'low_stock', needsBusiness: true,
  detect: (s) => s.lowStock().map((r) => ({
    severity: r.qtyMilli <= 0 ? 'warning' : 'info', entityType: 'product', entityId: r.productId,
    title: r.qtyMilli <= 0 ? `Out of stock: ${r.name}` : `Low stock: ${r.name}`,
    body: `${qty(r.qtyMilli)} ${r.uomCode} left; reorder level ${qty(r.reorderLevelMilli ?? 0)} ${r.uomCode}`, link: `/inventory/product/${r.productId}`,
  })),
};

const customerOverdue: Detector = {
  kind: 'customer_overdue', needsBusiness: true,
  detect: (s) => {
    const today = s.today();
    return s.dues('customer', today).map((d) => {
      const late = daysBetween(d.oldestDueDate, today);
      return {
        severity: late > 30 ? 'warning' : 'info', entityType: 'customer', entityId: d.partyId, title: `${d.name} is overdue`,
        body: `${formatRupees(d.duePaise)} overdue on ${d.documents} bill${d.documents === 1 ? '' : 's'}, the oldest due ${d.oldestDueDate} (${late} days)`,
        link: `/parties/customer/${d.partyId}`,
      };
    });
  },
};

const supplierDue: Detector = {
  kind: 'supplier_due', needsBusiness: true,
  detect: (s) => {
    const today = s.today();
    return s.dues('supplier', addDays(today, SUPPLIER_DUE_DAYS + 1)).map((d) => {
      const overdue = d.oldestDueDate < today;
      return {
        severity: overdue ? 'warning' : 'info', entityType: 'supplier', entityId: d.partyId, title: overdue ? `Payment to ${d.name} is overdue` : `Pay ${d.name} soon`,
        body: `${formatRupees(d.duePaise)} on ${d.documents} bill${d.documents === 1 ? '' : 's'}, ${overdue ? 'overdue since' : 'due by'} ${d.oldestDueDate}`,
        link: `/parties/supplier/${d.partyId}`,
      };
    });
  },
};

const syncBlocked: Detector = {
  kind: 'sync_blocked', needsBusiness: false,
  detect: (s) => {
    const st = s.syncStatus();
    const out: Raise[] = [];
    if (st.deviceStatus === 'revoked' || st.deviceStatus === 'upgrade_required') {
      out.push({
        severity: 'critical', entityType: 'device', entityId: 'status', link: '/diagnostics',
        title: st.deviceStatus === 'revoked' ? 'This device was removed from the business' : 'Update Muneem to keep syncing',
        body: st.detail ?? 'Sync is stopped until this is resolved.',
      });
    }
    if (st.dead > 0) {
      out.push({
        severity: 'critical', entityType: 'sync', entityId: 'dead', link: '/diagnostics',
        title: `${st.dead} change${st.dead === 1 ? '' : 's'} could not sync`, body: 'The cloud refused them for good. Open Diagnostics → Sync to look at them and resend.',
      });
    }
    return out;
  },
};

const auditChain: Detector = {
  kind: 'audit_chain_broken', needsBusiness: false,
  detect: (s) => (s.syncStatus().auditChainBroken ? [{
    severity: 'critical', entityType: 'audit', entityId: 'chain', link: '/diagnostics', title: 'The audit trail failed its check',
    body: 'A gap or an altered row was found in the audit hash chain, here or by the cloud. Sync is paused; see Diagnostics → Audit.',
  }] : []),
};

const backupFailed: Detector = {
  kind: 'backup_failed', needsBusiness: false,
  detect: (s) => {
    const h = s.backupHealth();
    const out: Raise[] = [];
    if (h.lastErrorAt && (!h.lastSuccessAt || h.lastErrorAt > h.lastSuccessAt)) {
      out.push({ severity: 'critical', entityType: 'backup', entityId: 'local', link: '/diagnostics', title: 'The last backup failed', body: h.lastError ?? 'See Diagnostics → Backups.' });
    }
    if (h.lastUploadError && h.awaitingUpload > 0) {
      out.push({ severity: 'warning', entityType: 'backup', entityId: 'upload', link: '/diagnostics', title: 'Backups are not reaching the cloud', body: h.lastUploadError });
    }
    return out;
  },
};

const backupStale: Detector = {
  kind: 'backup_stale', needsBusiness: false,
  detect: (s) => {
    const since = s.backupHealth().lastSuccessAt ?? s.businessCreatedAt();
    if (!since) return [];
    const age = s.now() - Date.parse(since);
    if (age <= BACKUP_STALE_HOURS * HOUR_MS) return [];
    const never = !s.backupHealth().lastSuccessAt;
    return [{
      severity: 'warning', entityType: 'backup', entityId: 'local', link: '/diagnostics',
      title: never ? 'No backup has been taken yet' : 'No recent backup', body: never ? 'Take a backup from Diagnostics → Backups.' : `The last good backup is ${Math.floor(age / HOUR_MS)} hours old.`,
    }];
  },
};

const reviewItems: Detector = {
  kind: 'review_items', needsBusiness: true,
  detect: (s) => {
    const { total, lateArrivals } = s.reviewCounts();
    if (total === 0) return [];
    return [{
      severity: lateArrivals > 0 ? 'warning' : 'info', entityType: 'review', entityId: 'open', link: '/settings/review',
      title: `${total} item${total === 1 ? '' : 's'} to review`,
      body: lateArrivals > 0 ? `${lateArrivals} late arrival${lateArrivals === 1 ? '' : 's'} into locked periods and ${total - lateArrivals} other.` : 'Sync conflicts the cloud settled, for a look.',
    }];
  },
};

export const DETECTORS: readonly Detector[] = [lowStock, customerOverdue, supplierDue, syncBlocked, auditChain, backupFailed, backupStale, reviewItems];
