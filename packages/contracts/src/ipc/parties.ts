import { z } from 'zod';
import { BusinessDate, Gstin, StateCode, Ulid } from './schemas.js';
import { CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_PURPOSES, CustomerSearchInput } from './pos.js';

const Paise = z.number().int().min(0).max(1_000_000_000_000);
const Amount = z.number().int().min(1).max(1_000_000_000_000);
const Signed = z.number().int();

export const PARTY_TYPES = ['customer', 'supplier'] as const;
export const PartyType = z.enum(PARTY_TYPES);
export type PartyType = z.infer<typeof PartyType>;

export const SupplierInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^\+?\d{6,15}$/, 'digits only, 6–15 long').optional(),
  email: z.string().trim().email().optional(),
  gstin: Gstin.optional(),
  stateCode: StateCode,
  taxScheme: z.enum(['regular', 'composition', 'unregistered']).default('regular'),
  addressLine1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  creditDays: z.number().int().min(0).max(365).default(0),
});
export type SupplierInput = z.infer<typeof SupplierInput>;
export const Supplier = SupplierInput.extend({ id: Ulid, businessId: Ulid, version: z.number().int() });
export type Supplier = z.infer<typeof Supplier>;
export const SupplierSearchInput = CustomerSearchInput;

export const SetCreditLimitInput = z.object({ id: Ulid, version: z.number().int(), limitPaise: Paise.nullable() });
export type SetCreditLimitInput = z.infer<typeof SetCreditLimitInput>;

// receivable = the party owes the business; payable = the business owes the party.
export const OPENING_SIDES = ['receivable', 'payable'] as const;
export const OpeningBalanceInput = z.object({
  partyId: Ulid,
  side: z.enum(OPENING_SIDES).optional(),
  amountPaise: Amount,
  asOfDate: BusinessDate,
});
export type OpeningBalanceInput = z.infer<typeof OpeningBalanceInput>;
export const PartyOpening = z.object({
  id: Ulid, partyType: PartyType, partyId: Ulid, side: z.enum(OPENING_SIDES), amountPaise: Amount, asOfDate: BusinessDate,
  allocatedPaise: Paise, settledPaise: Paise,
});
export type PartyOpening = z.infer<typeof PartyOpening>;

export const LedgerInput = z.object({
  partyId: Ulid,
  from: BusinessDate.optional(),
  to: BusinessDate.optional(),
  limit: z.number().int().min(1).max(500).default(100),
  cursor: z.string().max(200).optional(),
});
export type LedgerInput = z.infer<typeof LedgerInput>;
// Amounts are signed so that positive means the party owes the business (ADR-0022).
export const LedgerLine = z.object({
  id: Ulid, refType: z.string(), refId: z.string(), kind: z.enum(['post', 'cancel']), docNumber: z.string().optional(),
  docDate: BusinessDate, dueDate: BusinessDate.optional(), amountPaise: Signed, balancePaise: Signed,
});
export const LedgerPage = z.object({
  openingBalancePaise: Signed, items: z.array(LedgerLine), closingBalancePaise: Signed, nextCursor: z.string().nullable(),
});
export type LedgerPage = z.infer<typeof LedgerPage>;

export const OutstandingInput = z.object({ asOf: BusinessDate.optional(), partyId: Ulid.optional() });
export type OutstandingInput = z.infer<typeof OutstandingInput>;
// What is owed in the party's usual direction (customers owe, suppliers are owed), aged by days past the due date.
export const AgeingBuckets = z.object({
  notDuePaise: Paise, days0to30Paise: Paise, days31to60Paise: Paise, days61to90Paise: Paise, over90Paise: Paise,
  advancePaise: Paise, netPaise: Signed,
});
export type AgeingBuckets = z.infer<typeof AgeingBuckets>;
export const OutstandingRow = AgeingBuckets.extend({ partyId: Ulid, name: z.string() });
export const Outstanding = z.object({ asOf: BusinessDate, rows: z.array(OutstandingRow), totals: AgeingBuckets });
export type Outstanding = z.infer<typeof Outstanding>;

// FR-104 / ADR-0050: consent, a copy of what is held, and erasure that keeps the statutory invoices.
export const SetConsentInput = z.object({
  customerId: Ulid, purpose: z.enum(CONSENT_PURPOSES).default('payment_reminders'), channel: z.enum(CONSENT_CHANNELS), method: z.enum(CONSENT_METHODS),
});
export type SetConsentInput = z.infer<typeof SetConsentInput>;
export const WithdrawConsentInput = z.object({ customerId: Ulid, consentId: Ulid });
export type WithdrawConsentInput = z.infer<typeof WithdrawConsentInput>;
export const ExportProfileInput = z.object({ customerId: Ulid, format: z.enum(['json', 'csv']).default('json') });
export type ExportProfileInput = z.infer<typeof ExportProfileInput>;
export const ExportProfileResult = z.object({ saved: z.boolean(), fileName: z.string(), bytes: z.number().int() });
export const EraseCustomerInput = z.object({ customerId: Ulid, version: z.number().int(), reason: z.string().trim().min(3).max(200) });
export type EraseCustomerInput = z.infer<typeof EraseCustomerInput>;

// File import of customers or suppliers; `taxScheme` is read for suppliers only.
export const PARTY_IMPORT_FIELDS = [
  'name', 'phone', 'email', 'gstin', 'stateCode', 'taxScheme', 'addressLine1', 'city', 'pinCode', 'creditDays', 'openingBalance', 'openingDate',
] as const;
export const PartyImportField = z.enum(PARTY_IMPORT_FIELDS);
export type PartyImportField = z.infer<typeof PartyImportField>;
export const PartyImportMapping = z.record(PartyImportField, z.number().int().min(0).max(500));
export type PartyImportMapping = z.infer<typeof PartyImportMapping>;
export const PartyImportPreviewInput = z
  .object({ fileName: z.string().trim().min(1).max(200).optional(), contentBase64: z.string().max(14_000_000).optional(), importId: Ulid.optional(), mapping: PartyImportMapping.optional() })
  .refine((i) => i.importId !== undefined || (i.fileName !== undefined && i.contentBase64 !== undefined), { message: 'send a file, or the importId of an earlier preview' });
export type PartyImportPreviewInput = z.infer<typeof PartyImportPreviewInput>;
const Count = z.number().int();
export const PartyImportPreview = z.object({
  importId: Ulid, fileName: z.string(), columns: z.array(z.string()), mapping: PartyImportMapping,
  counts: z.object({ total: Count, ok: Count, errors: Count, duplicates: Count, openings: Count }),
  rows: z.array(z.object({ line: Count, status: z.enum(['ok', 'error', 'duplicate']), name: z.string().optional(), errors: z.record(z.string(), z.string()) })),
});
export type PartyImportPreview = z.infer<typeof PartyImportPreview>;
export const PartyImportCommitInput = z.object({ importId: Ulid, commandId: Ulid });
export type PartyImportCommitInput = z.infer<typeof PartyImportCommitInput>;
export const PartyImportSummary = z.object({
  created: Count, openingsSet: Count, skippedDuplicates: Count, skippedErrors: Count,
  skippedAtCommit: z.array(z.object({ line: Count, reason: z.string() })),
});
export type PartyImportSummary = z.infer<typeof PartyImportSummary>;
