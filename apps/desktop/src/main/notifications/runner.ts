import type { NotificationKind, SyncStatus } from '@muneem/contracts';
import { DETECTORS, type Detector, type DetectorSources } from './detectors.js';
import type { NotificationService } from './notificationService.js';

export interface RunnerDeps {
  service: NotificationService;
  sources: DetectorSources;
  hasBusiness: () => boolean;
  log: (err: unknown, kind: NotificationKind) => void;
  schedule?: (fn: () => void, ms: number) => void;
  detectors?: readonly Detector[];
}

// Commits that can move stock: the low-stock check follows them, once per quiet spell.
const STOCK_CHANNELS = /^(sales\.(complete|cancel)|returns\.complete|purchases\.(create|return|cancel)|inventory\.(adjust|stockTake|setOpeningStock|importOpeningCommit))$/u;
const AFTER_COMMIT_DELAY_MS = 30_000;

// Runs the detectors on the 6-hourly timer, at start-up, when a business opens, and after the cheap events that touch them.
export class NotificationRunner {
  private stockPending = false;
  private lastSync = '';
  constructor(private readonly d: RunnerDeps) {}

  run(kinds?: readonly NotificationKind[]): void {
    const business = this.d.hasBusiness();
    for (const det of this.d.detectors ?? DETECTORS) {
      if (kinds && !kinds.includes(det.kind)) continue;
      if (det.needsBusiness && !business) continue;
      try {
        this.d.service.reconcile(det.kind, det.detect(this.d.sources));
      } catch (e) {
        this.d.log(e, det.kind);
      }
    }
  }

  afterCommit(channel: string): void {
    if (!STOCK_CHANNELS.test(channel) || this.stockPending) return;
    this.stockPending = true;
    (this.d.schedule ?? ((fn, ms) => { setTimeout(fn, ms).unref?.(); }))(() => {
      this.stockPending = false;
      this.run(['low_stock']);
    }, AFTER_COMMIT_DELAY_MS);
  }

  // The badge's status arrives often; the detectors run only when what they look at changed.
  onSyncStatus(s: SyncStatus): void {
    const key = `${s.deviceStatus}|${s.dead}|${s.auditChainBroken === true}`;
    if (key === this.lastSync) return;
    this.lastSync = key;
    this.run(['sync_blocked', 'audit_chain_broken']);
  }
}
