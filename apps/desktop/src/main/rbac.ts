import { AppError, type Grant, type Permission, type Session } from '@muneem/contracts';
import { getMembership } from '@muneem/db-sqlite';
import type { Db } from '@muneem/db-sqlite';

/** Enforcement happens here, in main, against the cached server snapshot — never the renderer's copy (LLD §15.3). */
export class Rbac {
  constructor(private readonly db: () => Db) {}

  grantsFor(s: Session): Grant[] {
    if (!s.businessId) return [];
    return getMembership(this.db(), s.user.id, s.businessId)?.snapshot.grants ?? [];
  }

  has(s: Session, permission: Permission): Grant | null {
    return this.grantsFor(s).find((g) => g.permission === permission) ?? null;
  }

  assert(s: Session, permission: Permission, input: unknown): void {
    const g = this.has(s, permission);
    if (!g) throw new AppError('PERMISSION_DENIED', `Missing permission ${permission}`);
    const lim = g.limit;
    if (!lim || !input || typeof input !== 'object') return;
    const i = input as Record<string, unknown>;
    if (lim.maxDiscountBp !== undefined && typeof i.discountBp === 'number' && i.discountBp > lim.maxDiscountBp) {
      throw new AppError('PERMISSION_DENIED', `Discount above your limit (${lim.maxDiscountBp / 100}%)`);
    }
    if (lim.maxRefundPaise !== undefined && typeof i.refundPaise === 'number' && i.refundPaise > lim.maxRefundPaise) {
      throw new AppError('PERMISSION_DENIED', 'Refund above your limit');
    }
    if (lim.backdateDays !== undefined && typeof i.docDate === 'string') {
      const days = (Date.now() - Date.parse(i.docDate)) / 86_400_000;
      if (days > lim.backdateDays) throw new AppError('PERMISSION_DENIED', 'Back-dating beyond your limit');
    }
  }
}
