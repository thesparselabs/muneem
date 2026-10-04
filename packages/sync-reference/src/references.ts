// The entities an operation needs on the cloud before it can be stored (7b: party, session or document the verifier reads).
export interface EntityRef { entityType: string; entityId: string }

type Payload = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const ref = (entityType: string, id: unknown): EntityRef[] => (str(id) ? [{ entityType, entityId: str(id)! }] : []);
const party = (p: Payload): EntityRef[] => ref(p.partyType === 'supplier' ? 'supplier' : 'customer', p.partyId);

const TARGET_TYPES: Record<string, string> = { sale: 'sale', purchase: 'purchase', expense: 'expense', opening: 'party_opening' };
const SOURCE_TYPES: Record<string, string> = { payment: 'payment', debit_note: 'debit_note', write_off: 'write_off', opening: 'party_opening' };

// An opening allocated against is the party_opening entity whose `opening.id` it is; openings are stored by that id.
const allocationTargets = (p: Payload): EntityRef[] =>
  ((p.allocations ?? []) as { targetType: string; targetId: string }[]).flatMap((a) => ref(TARGET_TYPES[a.targetType] ?? a.targetType, a.targetId));

const CREATE_REFS: Record<string, (p: Payload) => EntityRef[]> = {
  sale: (p) => [...ref('pos_session', p.sessionId), ...ref('customer', p.customerId)],
  purchase: (p) => ref('supplier', p.supplierId),
  debit_note: (p) => ref('purchase', p.purchaseId),
  payment: (p) => [...party(p), ...allocationTargets(p)],
  write_off: (p) => [...ref('customer', p.customerId), ...allocationTargets(p)],
  expense: (p) => ref('supplier', p.supplierId),
  allocation: (p) => [...ref(SOURCE_TYPES[String(p.creditType)] ?? String(p.creditType), p.creditId), ...allocationTargets(p)],
  cash_movement: (p) => ref('pos_session', p.sessionId),
  party_opening: (p) => party((p.opening ?? {}) as Payload),
  barcode: (p) => ref('product', p.productId),
  uom_conversion: (p) => ref('product', p.productId),
  price_list_item: (p) => [...ref('product', p.productId), ...ref('price_list', p.priceListId)],
  customer_credit_limit: () => [],
};

const SELF_REFS = new Set(['cancel', 'void']);

export function requiredRefs(entityType: string, operationType: string, entityId: string, payload: Payload): EntityRef[] {
  if (SELF_REFS.has(operationType)) return [{ entityType, entityId }];
  if (entityType === 'customer_credit_limit') return [{ entityType: 'customer', entityId }];
  if (entityType === 'pos_session' && operationType === 'update') return [{ entityType, entityId }];
  return CREATE_REFS[entityType]?.(payload) ?? [];
}
