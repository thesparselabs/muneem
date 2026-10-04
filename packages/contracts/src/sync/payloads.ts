import { z } from 'zod';
import type { OutboxEntityType } from './types.js';
import { AuditEntryPayload } from './audit.js';

// Version 1 of the wire is the payload each repository already records (Stage 7a). Known fields are typed so
// the cloud and the apply path can rely on them; anything else passes through untouched.
const Id = z.string().min(1).max(64);
const Paise = z.number().int();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const Ts = z.string().min(10);
const open = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

const Party = z.object({ partyType: z.enum(['customer', 'supplier']), partyId: Id });
const Account = z.union([z.object({ role: z.string() }), z.object({ code: z.string() })]);
export const JournalLinePayload = open({ account: Account, debitPaise: Paise, creditPaise: Paise, party: Party.optional() });

export const JournalPayload = open({
  id: Id, entryNo: z.string(), entryDate: Day, periodId: Id, lines: z.array(JournalLinePayload).min(1),
  source: z.string(), refType: z.string(), refId: Id, docDate: Day, narration: z.string().nullable(), branchId: Id.nullable(), terminalId: Id.nullable(),
  latePosting: z.boolean(), reversalOf: Id.nullable(),
});
export type JournalPayload = z.infer<typeof JournalPayload>;

export const MovementPayload = open({
  id: Id, productId: Id, type: z.string(), qtyMilli: z.number().int(), valuePaise: Paise, unitCostPaise: Paise, provisional: z.boolean(),
  refType: z.string(), refId: Id, refLineId: z.string().nullable(), reasonCode: z.string().nullable(), warehouseId: Id, occurredAt: Ts, deviceId: Id.optional(),
});
export const PartyEntryPayload = open({
  id: Id, partyType: z.enum(['customer', 'supplier']), partyId: Id, refType: z.string(), refId: Id, kind: z.string(), amountPaise: Paise,
  docDate: Day, dueDate: Day.nullable(),
});
const AllocationLine = open({ id: Id, targetType: z.string(), targetId: Id, amountPaise: Paise, allocatedOn: Day.optional() });
// How the origin filed a numbered document (7e), so another device stores it under the same series, number and command.
const Numbering = { seriesId: Id.optional(), docSeq: z.number().int().optional(), fy: z.string().optional(), commandId: Id.optional() };
const Filing = { branchId: Id.optional(), ...Numbering };
const DrawerMovement = open({ id: Id, sessionId: Id, kind: z.string(), amountPaise: Paise, reason: z.string(), createdAt: Ts });
const TaxHeads = { cgstPaise: Paise, sgstPaise: Paise, igstPaise: Paise, cessPaise: Paise };

const SaleLine = open({
  lineNo: z.number().int(), productId: Id, uomId: Id, qtyMilli: z.number().int(), baseQtyMilli: z.number().int(), unitPricePaise: Paise,
  priceIsInclusive: z.boolean(), gstRateBp: z.number().int(), cessRateBp: z.number().int(), cessPerUnitPaise: Paise, taxTreatment: z.string(),
  lineDiscountPaise: Paise, apportionedBillDiscountPaise: Paise, grossPaise: Paise, taxablePaise: Paise, totalPaise: Paise, ...TaxHeads,
});
const DocTotals = open({ taxablePaise: Paise, totalPaise: Paise, roundOffPaise: Paise, supplyType: z.string(), ...TaxHeads });

const Sale = open({
  id: Id, businessId: Id, terminalId: Id, sessionId: Id.nullable(), docType: z.string(), docNumber: z.string(), docDate: Day, customerId: Id.nullish(),
  status: z.string(), lines: z.array(SaleLine).min(1), tenders: z.array(open({ method: z.string(), amountPaise: Paise, changePaise: Paise })),
  totals: DocTotals, creditPaise: Paise, changePaise: Paise, movements: z.array(MovementPayload), partyEntry: PartyEntryPayload.optional(),
  journal: JournalPayload, ...Filing,
});
const PurchaseLine = open({
  id: Id, lineNo: z.number().int(), productId: Id, uomId: Id, qtyMilli: z.number().int(), baseQtyMilli: z.number().int(), unitPricePaise: Paise,
  priceIsInclusive: z.boolean(), gstRateBp: z.number().int(), cessRateBp: z.number().int(), cessPerUnitPaise: Paise, taxTreatment: z.string(),
  itcEligible: z.boolean(), taxablePaise: Paise, totalPaise: Paise, landedValuePaise: Paise, chargesPaise: Paise, ...TaxHeads,
});
const Purchase = open({
  id: Id, businessId: Id, branchId: Id, warehouseId: Id, supplierId: Id, docNumber: z.string(), docDate: Day, supplierInvoiceNo: z.string(),
  supplierInvoiceDate: Day, status: z.string(), lines: z.array(PurchaseLine).min(1), charges: z.array(open({ kind: z.string(), amountPaise: Paise })),
  totals: DocTotals, movements: z.array(MovementPayload), corrections: z.array(JournalPayload), entry: PartyEntryPayload, journal: JournalPayload,
  ...Numbering, placeOfSupplyState: z.string().optional(),
});
const Cancel = open({ id: Id, status: z.literal('cancelled'), reason: z.string(), journal: JournalPayload.nullable(), drawerMovements: z.array(DrawerMovement).optional() });
const DebitNote = open({
  id: Id, businessId: Id, purchaseId: Id, supplierId: Id, docNumber: z.string(), docDate: Day, totalPaise: Paise, roundOffPaise: Paise,
  lines: z.array(open({ purchaseItemId: Id, qtyMilli: z.number().int() })).min(1), movements: z.array(MovementPayload), corrections: z.array(JournalPayload),
  entry: PartyEntryPayload, journal: JournalPayload, ...TaxHeads, ...Filing, warehouseId: Id.optional(), allocations: z.array(AllocationLine).optional(),
});
// ADR-0043: each line carries the sale line it came from, so a server can recompute the return from the sale's own tax.
const SoldLine = open({ qtyMilli: z.number().int(), baseQtyMilli: z.number().int(), taxablePaise: Paise, cogsPaise: Paise, ...TaxHeads });
const CreditNote = open({
  id: Id, businessId: Id, saleId: Id, terminalId: Id, sessionId: Id.nullish(), customerId: Id.nullish(), docNumber: z.string(), docDate: Day,
  kind: z.enum(['return', 'cancel']), reason: z.string(), supplyType: z.string(), taxablePaise: Paise, roundOffPaise: Paise, totalPaise: Paise, costPaise: Paise,
  refundMethod: z.enum(['cash', 'upi', 'card', 'credit']), refundPaise: Paise, creditPaise: Paise, ...TaxHeads,
  lines: z.array(open({
    saleItemId: Id, productId: Id, qtyMilli: z.number().int(), baseQtyMilli: z.number().int(), returnedBeforeMilli: z.number().int(), taxablePaise: Paise,
    totalPaise: Paise, costPaise: Paise, sold: SoldLine, ...TaxHeads,
  })).min(1),
  movements: z.array(MovementPayload), corrections: z.array(JournalPayload), entry: PartyEntryPayload.nullable(), allocations: z.array(AllocationLine),
  journal: JournalPayload, ...Filing, warehouseId: Id.optional(),
});
const Payment = open({
  id: Id, businessId: Id, partyType: z.enum(['customer', 'supplier']), partyId: Id, docNumber: z.string(), paymentDate: Day, method: z.string(),
  amountPaise: Paise, allocations: z.array(AllocationLine), entry: PartyEntryPayload, journal: JournalPayload, ...Filing, terminalId: Id.nullish(),
  drawerMovements: z.array(DrawerMovement).optional(),
});
const WriteOff = open({
  id: Id, businessId: Id, customerId: Id, docDate: Day, amountPaise: Paise, reason: z.string(), allocations: z.array(AllocationLine),
  entry: PartyEntryPayload, journal: JournalPayload,
});
const Expense = open({
  id: Id, businessId: Id, categoryId: Id, docNumber: z.string(), expenseDate: Day, method: z.string(), taxablePaise: Paise, itcPaise: Paise,
  totalPaise: Paise, status: z.string(), entry: PartyEntryPayload.nullable(), journal: JournalPayload, ...TaxHeads, ...Filing, terminalId: Id.nullish(),
  roundOffPaise: Paise.optional(), drawerMovements: z.array(DrawerMovement).optional(),
});
const StockDocument = open({
  id: Id, kind: z.enum(['opening', 'adjustment', 'stock_take']), warehouseId: Id, movements: z.array(MovementPayload), corrections: z.array(JournalPayload),
  journal: JournalPayload.nullable(),
});
const PartyOpening = open({
  opening: open({ id: Id, partyType: z.enum(['customer', 'supplier']), partyId: Id, side: z.string(), amountPaise: Paise, asOfDate: Day }),
  entry: PartyEntryPayload,
});
const SessionOpen = open({ id: Id, terminalId: Id, sessionNo: z.number().int(), openedAt: Ts, openingCashPaise: Paise, status: z.string() });
const SessionClose = open({ sessionId: Id, closedAt: Ts, countedCashPaise: Paise, expectedCashPaise: Paise, variancePaise: Paise });
const CashMovement = open({ id: Id, sessionId: Id, kind: z.string(), amountPaise: Paise, reason: z.string() });
const Allocation = open({ creditType: z.string(), creditId: Id, allocations: z.array(AllocationLine) });
const Period = open({ id: Id, periodStart: Day, periodEnd: Day, status: z.enum(['open', 'locked']) });

const master = open({ id: Id.optional() });
const EXACT: Partial<Record<OutboxEntityType, Partial<Record<string, z.ZodTypeAny>>>> = {
  sale: { create: Sale },
  purchase: { create: Purchase, cancel: Cancel },
  debit_note: { create: DebitNote },
  credit_note: { create: CreditNote },
  payment: { create: Payment, cancel: Cancel },
  write_off: { create: WriteOff },
  expense: { create: Expense, cancel: Cancel },
  stock_adjustment: { create: StockDocument },
  party_opening: { create: PartyOpening, cancel: master },
  pos_session: { create: SessionOpen, update: SessionClose },
  cash_movement: { create: CashMovement },
  allocation: { create: Allocation },
  journal_entry: { create: JournalPayload },
  accounting_period: { create: Period, update: Period },
};

// The schema a payload of this entity and operation must satisfy; masters and config are checked loosely.
export function payloadSchema(entityType: string, operationType: string): z.ZodTypeAny {
  if (entityType === 'audit_entry') return AuditEntryPayload;
  return EXACT[entityType as OutboxEntityType]?.[operationType] ?? master;
}
