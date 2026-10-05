import type { ReconciliationRow } from '@muneem/contracts';

export interface Breach {
  movementId: string; occurredAt: string; source: string; document: string | null; qtyMilli: number; balanceAfterMilli: number; viaSync: boolean;
}
export interface ReconciledProduct {
  key: string; productId: string; productName: string; uomCode: string; warehouseName: string; currentQtyMilli: number; lowestMilli: number;
  viaSync: boolean; breaches: Breach[];
}

const SOURCE: Record<string, string> = { adjustment: 'Adjustment', stock_take: 'Stock take', sale_return: 'Sale return', purchase_return: 'Purchase return', correction: 'Correction' };

function source(r: ReconciliationRow): string {
  if (r.refType === 'sale') return r.terminalCode ? `Terminal ${r.terminalCode}` : r.viaSync ? 'Another terminal' : 'This terminal';
  return SOURCE[r.refType] ?? r.refType;
}

// One entry per product and warehouse, its breaches oldest first; products that went lowest come first.
export function reconcile(rows: readonly ReconciliationRow[], opts: { viaSyncOnly?: boolean } = {}): ReconciledProduct[] {
  const byKey = new Map<string, ReconciledProduct>();
  for (const r of rows) {
    const key = `${r.warehouseId}|${r.productId}`;
    const p = byKey.get(key) ?? {
      key, productId: r.productId, productName: r.productName, uomCode: r.uomCode, warehouseName: r.warehouseName, currentQtyMilli: r.currentQtyMilli,
      lowestMilli: 0, viaSync: false, breaches: [],
    };
    p.breaches.push({ movementId: r.movementId, occurredAt: r.occurredAt, source: source(r), document: r.docNumber, qtyMilli: r.qtyMilli, balanceAfterMilli: r.balanceAfterMilli, viaSync: r.viaSync });
    p.lowestMilli = Math.min(p.lowestMilli, r.balanceAfterMilli);
    p.viaSync ||= r.viaSync;
    byKey.set(key, p);
  }
  return [...byKey.values()]
    .filter((p) => !opts.viaSyncOnly || p.viaSync)
    .map((p) => ({ ...p, breaches: [...p.breaches].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.movementId.localeCompare(b.movementId)) }))
    .sort((a, b) => a.lowestMilli - b.lowestMilli || a.productName.localeCompare(b.productName));
}
