import { DomainError } from '../errors.js';

export interface OpenItem { id: string; dueDate: string; docDate: string; outstandingPaise: number }
export interface Allocation { itemId: string; amountPaise: number }
export interface AllocationResult { allocations: Allocation[]; unallocatedPaise: number }

function assertAmount(amountPaise: number, what: string): void {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new DomainError('INVALID_INPUT', `${what} must be a positive amount, got ${amountPaise}`);
}

const byAge = (a: OpenItem, b: OpenItem): number =>
  a.dueDate.localeCompare(b.dueDate) || a.docDate.localeCompare(b.docDate) || a.id.localeCompare(b.id);

// ADR-0025: oldest due date first, then document date; ULIDs break ties in the order the documents were made.
export function allocateOldestFirst(items: readonly OpenItem[], amountPaise: number): AllocationResult {
  assertAmount(amountPaise, 'payment');
  let left = amountPaise;
  const allocations: Allocation[] = [];
  for (const item of [...items].sort(byAge)) {
    if (left === 0) break;
    if (item.outstandingPaise <= 0) continue;
    const take = Math.min(left, item.outstandingPaise);
    allocations.push({ itemId: item.id, amountPaise: take });
    left -= take;
  }
  return { allocations, unallocatedPaise: left };
}

export function allocateAsChosen(items: readonly OpenItem[], amountPaise: number, chosen: readonly Allocation[]): AllocationResult {
  assertAmount(amountPaise, 'payment');
  const open = new Map(items.map((i) => [i.id, i.outstandingPaise]));
  const seen = new Set<string>();
  let total = 0;
  for (const a of chosen) {
    assertAmount(a.amountPaise, 'allocation');
    if (seen.has(a.itemId)) throw new DomainError('INVALID_INPUT', `document ${a.itemId} is allocated twice`);
    seen.add(a.itemId);
    const outstanding = open.get(a.itemId);
    if (outstanding === undefined) throw new DomainError('INVALID_INPUT', `document ${a.itemId} is not open for this party`);
    if (a.amountPaise > outstanding) throw new DomainError('INVALID_INPUT', `allocation ${a.amountPaise} exceeds the ${outstanding} outstanding on ${a.itemId}`);
    total += a.amountPaise;
  }
  if (total > amountPaise) throw new DomainError('INVALID_INPUT', `allocations ${total} exceed the payment ${amountPaise}`);
  return { allocations: chosen.map((a) => ({ ...a })), unallocatedPaise: amountPaise - total };
}
