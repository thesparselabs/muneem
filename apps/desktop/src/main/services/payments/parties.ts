import { AppError } from '@muneem/contracts';
import type { PartyType } from '@muneem/domain';
import { getCustomer, getSupplier } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

export interface PartyInfo { name: string; creditDays: number }

// A party of this business that the user may see: a cashier can deal with customers, not suppliers (5d details).
export function requireParty(ctx: PosContext, partyType: PartyType, partyId: string): PartyInfo {
  if (!ctx.can(partyType === 'customer' ? 'customers.view' : 'suppliers.view')) {
    throw new AppError('PERMISSION_DENIED', partyType === 'customer' ? 'You cannot deal with customers' : 'You cannot deal with suppliers');
  }
  const party = partyType === 'customer' ? getCustomer(ctx.db(), partyId) : getSupplier(ctx.db(), partyId);
  if (!party || party.businessId !== ctx.businessId()) throw new AppError('NOT_FOUND', `${partyType === 'customer' ? 'Customer' : 'Supplier'} not found`);
  return { name: party.name, creditDays: party.creditDays };
}
