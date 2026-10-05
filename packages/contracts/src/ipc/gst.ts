import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

const Int = z.number().int();
const Paise = Int.min(0).max(1_000_000_000_000);
export const GstMonth = BusinessDate.refine((d) => d.endsWith('-01'), 'the first day of a month');

export const GstHeads = z.object({ igstPaise: Int, cgstPaise: Int, sgstPaise: Int, cessPaise: Int });
export type GstHeads = z.infer<typeof GstHeads>;
const Amounts = GstHeads.extend({ taxablePaise: Int });

export const GstMonthInput = z.object({ month: GstMonth });
export type GstMonthInput = z.infer<typeof GstMonthInput>;

export const GstTieOutView = z.object({ name: z.string(), returnPaise: Int, booksPaise: Int });
export const GstSectionTotal = Amounts.extend({ section: z.string(), title: z.string(), reportId: z.string(), rows: Int });

// One month's returns at a glance: section totals, GSTR-3B, whether they tie to the books, and the set-off if posted.
export const GstReturnSummary = z.object({
  month: GstMonth,
  applicable: z.boolean(),
  sections: z.array(GstSectionTotal),
  gstr3b: z.array(Amounts.extend({ code: z.string(), description: z.string() })),
  inward: z.array(z.object({ description: z.string(), interPaise: Int, intraPaise: Int })),
  tieOuts: z.array(GstTieOutView),
  missingHsn: Int,
  locked: z.boolean(),
  setoffId: Ulid.nullable(),
});
export type GstReturnSummary = z.infer<typeof GstReturnSummary>;

export const SetoffUtilisation = z.object({
  igstToIgstPaise: Int, igstToCgstPaise: Int, igstToSgstPaise: Int, cgstToCgstPaise: Int, cgstToIgstPaise: Int, sgstToSgstPaise: Int, sgstToIgstPaise: Int,
  cessToCessPaise: Int,
});
export const GstSetoffPreview = z.object({
  month: GstMonth, docDate: BusinessDate, liability: GstHeads, credit: GstHeads, utilisation: SetoffUtilisation, creditUsed: GstHeads, creditLeft: GstHeads,
  cash: GstHeads, cashTotalPaise: Int,
  // Why it cannot be posted now; empty when it can.
  blockers: z.array(z.string()),
});
export type GstSetoffPreview = z.infer<typeof GstSetoffPreview>;

export const PostGstSetoffInput = z.object({ month: GstMonth, commandId: Ulid });
export type PostGstSetoffInput = z.infer<typeof PostGstSetoffInput>;

export const GstSetoff = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, month: GstMonth, liability: GstHeads, credit: GstHeads, utilisation: SetoffUtilisation, cash: GstHeads,
  createdAt: IsoDateTime, createdBy: z.string(),
});
export type GstSetoff = z.infer<typeof GstSetoff>;

export const GstPaymentInput = z.object({
  commandId: Ulid,
  paymentDate: BusinessDate,
  // CPIN or CIN of the challan.
  challanRef: z.string().trim().min(1).max(40),
  month: GstMonth.optional(),
  igstPaise: Paise.default(0), cgstPaise: Paise.default(0), sgstPaise: Paise.default(0), cessPaise: Paise.default(0),
  note: z.string().trim().max(200).optional(),
}).refine((p) => p.igstPaise + p.cgstPaise + p.sgstPaise + p.cessPaise > 0, { message: 'Enter the tax paid', path: ['igstPaise'] });
export type GstPaymentInput = z.infer<typeof GstPaymentInput>;

export const GstPayment = GstHeads.extend({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, month: GstMonth.optional(), challanRef: z.string(), totalPaise: Int, note: z.string().optional(),
  createdAt: IsoDateTime, createdBy: z.string(),
});
export type GstPayment = z.infer<typeof GstPayment>;

export const GstLedgerView = z.object({
  setoffs: z.array(GstSetoff), payments: z.array(GstPayment),
  // 2300 GST Payable: what set-offs moved there less what challans paid.
  payablePaise: Int,
});
export type GstLedgerView = z.infer<typeof GstLedgerView>;
