import type { Customer, CustomerInput, SetCreditLimitInput } from '@muneem/contracts';
import { createCustomer, getCustomer, searchCustomers, setCustomerCreditLimit, updateCustomer } from '@muneem/db-sqlite';
import type { PosContext } from './posContext.js';

export class CustomerService {
  constructor(private readonly ctx: PosContext) {}

  search(query: string, limit: number): Customer[] { return searchCustomers(this.ctx.db(), this.ctx.businessId(), query, limit); }

  get(id: string): Customer {
    const c = getCustomer(this.ctx.db(), id);
    if (!c || c.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return c;
  }

  create(input: CustomerInput): Customer { return createCustomer(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor()); }

  update(input: CustomerInput & { id: string; version: number }): Customer {
    this.get(input.id);
    const { id, version, ...fields } = input;
    return updateCustomer(this.ctx.db(), id, version, fields, this.ctx.actor());
  }

  setCreditLimit(input: SetCreditLimitInput): Customer {
    this.get(input.id);
    return setCustomerCreditLimit(this.ctx.db(), input.id, input.version, input.limitPaise, this.ctx.actor());
  }
}
