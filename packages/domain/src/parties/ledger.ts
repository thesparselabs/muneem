export type PartyType = 'customer' | 'supplier';

// Ledger entries are signed so that positive means the party owes the business.
export const chargeSign = (t: PartyType): 1 | -1 => (t === 'customer' ? 1 : -1);

export interface PartyRef { partyType: PartyType; partyId: string }
export interface PartyEntry extends PartyRef { amountPaise: number }
// Charges create what a party owes or is owed (invoices, credit portions, openings); settlements clear them (payments, debit notes, write-offs).
export interface PartyDocument extends PartyRef { id: string; amountPaise: number; live: boolean }
export interface PartyAllocation { sourceId: string; targetId: string; amountPaise: number; live: boolean }

export interface PartyMismatch extends PartyRef { ledgerPaise: number; openItemsPaise: number }
export type AllocationFault =
  | { kind: 'over_allocated'; documentId: string; allocatedPaise: number; amountPaise: number }
  | { kind: 'dead_document'; sourceId: string; targetId: string }
  | { kind: 'unknown_document'; sourceId: string; targetId: string }
  | { kind: 'cross_party'; sourceId: string; targetId: string };

export interface Reconciliation { mismatches: PartyMismatch[]; faults: AllocationFault[] }

const keyOf = (p: PartyRef): string => `${p.partyType}:${p.partyId}`;

function sameParty(a: PartyRef, b: PartyRef): boolean {
  return a.partyType === b.partyType && a.partyId === b.partyId;
}

// ADR-0022: Σ entries per party = sign × (Σ open charges − Σ unallocated settlements).
export function reconcileParties(input: {
  entries: readonly PartyEntry[]; charges: readonly PartyDocument[]; settlements: readonly PartyDocument[]; allocations: readonly PartyAllocation[];
}): Reconciliation {
  const faults: AllocationFault[] = [];
  const charges = new Map(input.charges.map((d) => [d.id, d]));
  const settlements = new Map(input.settlements.map((d) => [d.id, d]));
  const used = new Map<string, number>();
  for (const a of input.allocations) {
    if (!a.live) continue;
    const source = settlements.get(a.sourceId);
    const target = charges.get(a.targetId);
    if (!source || !target) faults.push({ kind: 'unknown_document', sourceId: a.sourceId, targetId: a.targetId });
    else if (!source.live || !target.live) faults.push({ kind: 'dead_document', sourceId: a.sourceId, targetId: a.targetId });
    else if (!sameParty(source, target)) faults.push({ kind: 'cross_party', sourceId: a.sourceId, targetId: a.targetId });
    used.set(a.sourceId, (used.get(a.sourceId) ?? 0) + a.amountPaise);
    used.set(a.targetId, (used.get(a.targetId) ?? 0) + a.amountPaise);
  }

  const ledger = new Map<string, PartyEntry>();
  for (const e of input.entries) {
    const k = keyOf(e);
    ledger.set(k, { ...e, amountPaise: (ledger.get(k)?.amountPaise ?? 0) + e.amountPaise });
  }
  const open = new Map<string, PartyEntry>();
  const addOpen = (d: PartyDocument, sign: 1 | -1): void => {
    const allocated = used.get(d.id) ?? 0;
    if (allocated > d.amountPaise) faults.push({ kind: 'over_allocated', documentId: d.id, allocatedPaise: allocated, amountPaise: d.amountPaise });
    if (!d.live) return;
    const k = keyOf(d);
    const delta = sign * chargeSign(d.partyType) * (d.amountPaise - allocated);
    open.set(k, { partyType: d.partyType, partyId: d.partyId, amountPaise: (open.get(k)?.amountPaise ?? 0) + delta });
  };
  input.charges.forEach((d) => addOpen(d, 1));
  input.settlements.forEach((d) => addOpen(d, -1));

  const mismatches: PartyMismatch[] = [];
  for (const k of [...new Set([...ledger.keys(), ...open.keys()])].sort()) {
    const ref = ledger.get(k) ?? open.get(k)!;
    const ledgerPaise = ledger.get(k)?.amountPaise ?? 0;
    const openItemsPaise = open.get(k)?.amountPaise ?? 0;
    if (ledgerPaise !== openItemsPaise) mismatches.push({ partyType: ref.partyType, partyId: ref.partyId, ledgerPaise, openItemsPaise });
  }
  return { mismatches, faults };
}
