import { z } from 'zod';
import { Gstin, IsoDateTime, StateCode, Ulid } from './schemas.js';

const Paise = z.number().int().min(0).max(1_000_000_000_000);
const Version = z.number().int();

export const CustomerInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^\+?\d{6,15}$/, 'digits only, 6–15 long').optional(),
  email: z.string().trim().email().optional(),
  gstin: Gstin.optional(),
  stateCode: StateCode.optional(),
  addressLine1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  creditDays: z.number().int().min(0).max(365).optional(),
});
export type CustomerInput = z.infer<typeof CustomerInput>;
// NULL limit = no credit allowed (ADR-0026).
export const Customer = CustomerInput.extend({ id: Ulid, businessId: Ulid, version: Version, creditDays: z.number().int(), creditLimitPaise: Paise.nullable() });
export type Customer = z.infer<typeof Customer>;
export const CustomerSearchInput = z.object({ query: z.string().max(64), limit: z.number().int().min(1).max(50).default(20) });

export const CASH_MOVEMENT_KINDS = ['cash_in', 'cash_out', 'safe_drop'] as const;
export const CashMovementInput = z.object({
  kind: z.enum(CASH_MOVEMENT_KINDS),
  amountPaise: Paise.refine((v) => v > 0, 'must be more than zero'),
  reason: z.string().trim().min(1).max(200),
});
export type CashMovementInput = z.infer<typeof CashMovementInput>;

export const RegisterSession = z.object({
  id: Ulid,
  terminalId: Ulid,
  sessionNo: z.number().int(),
  status: z.enum(['open', 'closing', 'closed']),
  openedAt: IsoDateTime,
  openedBy: z.string(),
  openingCashPaise: z.number().int(),
  closedAt: IsoDateTime.optional(),
});
export type RegisterSession = z.infer<typeof RegisterSession>;

export const TenderTotal = z.object({ method: z.string(), amountPaise: z.number().int() });
export const RegisterReport = z.object({
  sessionId: Ulid,
  sessionNo: z.number().int(),
  final: z.boolean(),
  openedAt: IsoDateTime,
  closedAt: IsoDateTime.optional(),
  openingCashPaise: z.number().int(),
  salesCount: z.number().int(),
  salesTotalPaise: z.number().int(),
  taxPaise: z.number().int(),
  byTender: z.array(TenderTotal),
  changeGivenPaise: z.number().int(),
  cashInPaise: z.number().int(),
  cashOutPaise: z.number().int(),
  safeDropPaise: z.number().int(),
  expectedCashPaise: z.number().int().nullable(),
  countedCashPaise: z.number().int().optional(),
  variancePaise: z.number().int().optional(),
});
export type RegisterReport = z.infer<typeof RegisterReport>;

export const OpenRegisterInput = z.object({ openingCashPaise: Paise });
export const CloseRegisterInput = z
  .object({
    countedCashPaise: Paise,
    denominations: z.record(z.string().regex(/^\d+$/), z.number().int().min(0)).optional(),
  })
  .refine((i) => !i.denominations || Object.entries(i.denominations).reduce((s, [d, n]) => s + Number(d) * n, 0) === i.countedCashPaise, {
    message: 'the denominations do not add up to the counted cash', path: ['countedCashPaise'],
  });
export type CloseRegisterInput = z.infer<typeof CloseRegisterInput>;
