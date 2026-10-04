import type { AccountView } from '@muneem/contracts';
import { createAccount, renameAccount } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import type { StatementService } from './statements.js';

export class ChartService {
  constructor(private readonly ctx: PosContext, private readonly statements: StatementService) {}

  create(input: { code: string; name: string; parentCode: string }): AccountView {
    this.statements.chart();
    const a = createAccount(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor());
    return this.statements.accounts().find((x) => x.id === a.id)!;
  }

  rename(id: string, name: string): AccountView {
    renameAccount(this.ctx.db(), this.ctx.businessId(), id, name, this.ctx.actor());
    return this.statements.accounts().find((x) => x.id === id)!;
  }
}
