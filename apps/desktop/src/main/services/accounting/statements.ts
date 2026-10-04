import type { AccountLedgerPage, AccountView, BalanceSheet, DayBookPage, ProfitAndLoss, TrialBalance } from '@muneem/contracts';
import { AppError } from '@muneem/contracts';
import { accountLedger, accountTotals, balanceSheet, dayBook, ensureChartOfAccounts, listAccounts, profitAndLoss, trialBalance, type AccountRow } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

type Branch = { branchId?: string | undefined };
type LedgerQuery = Branch & { accountId?: string | undefined; from?: string | undefined; to?: string | undefined; limit: number; cursor?: string | undefined };

// Statements and books read the journal directly; nothing here writes (FR-054).
export class StatementService {
  constructor(private readonly ctx: PosContext) {}

  // A business created before Stage 6 has no chart until something seeds it; reading one must not depend on that.
  chart(): AccountRow[] {
    ensureChartOfAccounts(this.ctx.db(), this.ctx.businessId(), this.ctx.actor());
    return listAccounts(this.ctx.db(), this.ctx.businessId());
  }

  accounts(asOf?: string): AccountView[] {
    const balances = new Map(accountTotals(this.ctx.db(), { businessId: this.ctx.businessId(), to: asOf ?? this.ctx.today() })
      .map((a) => [a.accountId, a.debitPaise - a.creditPaise]));
    return this.chart().map((a) => ({
      id: a.id, code: a.code, name: a.name, type: a.type, role: a.role, parentId: a.parentId, isGroup: a.isGroup, isSystem: a.isSystem,
      balancePaise: balances.get(a.id) ?? 0,
    }));
  }

  trialBalance(q: Branch & { asOf?: string | undefined }): TrialBalance {
    const asOf = q.asOf ?? this.ctx.today();
    return { asOf, ...trialBalance(this.ctx.db(), { businessId: this.ctx.businessId(), to: asOf, branchId: q.branchId ?? null }) };
  }

  profitAndLoss(q: Branch & { from: string; to: string }): ProfitAndLoss {
    if (q.from > q.to) throw new AppError('VALIDATION_FAILED', 'The range ends before it starts', { from: 'after the end date' });
    return { from: q.from, to: q.to, ...profitAndLoss(this.ctx.db(), { businessId: this.ctx.businessId(), from: q.from, to: q.to, branchId: q.branchId ?? null }) };
  }

  balanceSheet(q: Branch & { asOf?: string | undefined }): BalanceSheet {
    const asOf = q.asOf ?? this.ctx.today();
    return { asOf, ...balanceSheet(this.ctx.db(), { businessId: this.ctx.businessId(), to: asOf, branchId: q.branchId ?? null }) };
  }

  ledger(q: LedgerQuery): AccountLedgerPage {
    if (!q.accountId) throw new AppError('VALIDATION_FAILED', 'Choose an account', { accountId: 'required' });
    const account = this.chart().find((a) => a.id === q.accountId);
    if (!account) throw new AppError('NOT_FOUND', 'Account not found');
    return {
      accountId: account.id,
      ...accountLedger(this.ctx.db(), {
        businessId: this.ctx.businessId(), accountId: account.id, from: q.from ?? null, to: q.to ?? this.ctx.today(), branchId: q.branchId ?? null, limit: q.limit, cursor: q.cursor,
      }),
    };
  }

  // The cash book is 1100's ledger; the bank book is 1200's unless another bank account is chosen.
  book(role: 'cash' | 'bank', q: LedgerQuery): AccountLedgerPage {
    const accountId = role === 'bank' && q.accountId ? q.accountId : this.chart().find((a) => a.role === role)?.id;
    return this.ledger({ ...q, accountId });
  }

  dayBook(q: Branch & { from: string; to: string; limit: number; cursor?: string | undefined }): DayBookPage {
    return dayBook(this.ctx.db(), { businessId: this.ctx.businessId(), from: q.from, to: q.to, branchId: q.branchId ?? null, limit: q.limit, cursor: q.cursor });
  }
}
