import { z } from 'zod';

const Int = z.number().int();

// The receipt as data. Amounts stay in paise; layout for a given paper width happens at print time.
export const ReceiptDoc = z.object({
  title: z.enum(['TAX INVOICE', 'BILL OF SUPPLY']),
  duplicate: z.boolean(),
  copyNo: Int,
  header: z.object({
    businessName: z.string(),
    lines: z.array(z.string()),
    gstin: z.string().optional(),
  }),
  docNumber: z.string(),
  docDate: z.string(),
  time: z.string(),
  terminalCode: z.string(),
  cashier: z.string(),
  customer: z.object({ name: z.string(), gstin: z.string().optional(), phone: z.string().optional() }).optional(),
  placeOfSupply: z.string(),
  lines: z.array(z.object({ name: z.string(), hsnCode: z.string().optional(), qty: z.string(), unitPricePaise: Int, discountPaise: Int, amountPaise: Int })),
  totals: z.object({
    grossPaise: Int, discountPaise: Int, taxablePaise: Int, cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int,
    roundOffPaise: Int, totalPaise: Int, stateTaxLabel: z.enum(['SGST', 'UTGST']),
  }),
  taxSummary: z.array(z.object({ rateBp: Int, taxablePaise: Int, cgstPaise: Int, sgstPaise: Int, igstPaise: Int })),
  tenders: z.array(z.object({ method: z.string(), amountPaise: Int, reference: z.string().optional() })),
  changePaise: Int,
  declaration: z.string().optional(),
  footer: z.array(z.string()),
});
export type ReceiptDoc = z.infer<typeof ReceiptDoc>;
