import type { Supplier, SupplierInput } from '@muneem/contracts';
import { createSupplier, getSupplier, searchSuppliers, updateSupplier } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

export class SupplierService {
  constructor(private readonly ctx: PosContext) {}

  search(query: string, limit: number): Supplier[] { return searchSuppliers(this.ctx.db(), this.ctx.businessId(), query, limit); }

  get(id: string): Supplier {
    const s = getSupplier(this.ctx.db(), id);
    if (!s || s.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return s;
  }

  create(input: SupplierInput): Supplier { return createSupplier(this.ctx.db(), this.ctx.businessId(), input, this.ctx.actor()); }

  update(input: SupplierInput & { id: string; version: number }): Supplier {
    this.get(input.id);
    const { id, version, ...fields } = input;
    return updateSupplier(this.ctx.db(), id, version, fields, this.ctx.actor());
  }
}
