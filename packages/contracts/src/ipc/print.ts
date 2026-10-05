import { z } from 'zod';

const Int = z.number().int();

// The receipt as data. Amounts stay in paise; layout for a given paper width happens at print time.
export const ReceiptDoc = z.object({
  title: z.enum(['TAX INVOICE', 'BILL OF SUPPLY', 'CREDIT NOTE']),
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
  // A credit note names the invoice it is against and why (ADR-0043).
  against: z.object({ docNumber: z.string(), docDate: z.string() }).optional(),
  reason: z.string().optional(),
  lines: z.array(z.object({ name: z.string(), hsnCode: z.string().optional(), qty: z.string(), unitPricePaise: Int, discountPaise: Int, amountPaise: Int })),
  totals: z.object({
    grossPaise: Int, discountPaise: Int, taxablePaise: Int, cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int,
    roundOffPaise: Int, totalPaise: Int, stateTaxLabel: z.enum(['SGST', 'UTGST']),
  }),
  taxSummary: z.array(z.object({ rateBp: Int, taxablePaise: Int, cgstPaise: Int, sgstPaise: Int, igstPaise: Int })),
  tenders: z.array(z.object({ method: z.string(), amountPaise: Int, reference: z.string().optional() })),
  changePaise: Int,
  credit: z.object({ amountPaise: Int, dueDate: z.string(), balancePaise: Int }).optional(),
  declaration: z.string().optional(),
  footer: z.array(z.string()),
});
export type ReceiptDoc = z.infer<typeof ReceiptDoc>;

// A Windows printer name reaches the spooler helper only as data; control characters never belong in one.
export const PrinterName = z.string().trim().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/u, 'not a valid printer name');

export const PrinterConfig = z.object({
  kind: z.enum(['none', 'simulator', 'network', 'spooler']),
  host: z.string().trim().max(255).optional(),
  port: z.number().int().min(1).max(65_535).default(9100),
  printerName: PrinterName.optional(),
  mode: z.enum(['escpos', 'image']).default('escpos'),
  rupee: z.enum(['symbol', 'Rs']).default('Rs'),
  widthChars: z.union([z.literal(32), z.literal(42), z.literal(48)]).default(42),
  openDrawer: z.boolean().default(true),
})
  .refine((c) => c.kind !== 'network' || !!c.host, { message: 'enter the printer address', path: ['host'] })
  .refine((c) => c.kind !== 'spooler' || !!c.printerName, { message: 'choose a Windows printer', path: ['printerName'] })
  .refine((c) => c.mode === 'escpos' || c.kind === 'spooler', { message: 'image printing needs a Windows printer', path: ['mode'] });
export type PrinterConfig = z.infer<typeof PrinterConfig>;

export const InstalledPrinter = z.object({ name: PrinterName, displayName: z.string().max(256) });
export type InstalledPrinter = z.infer<typeof InstalledPrinter>;

export const PrintJobSummary = z.object({
  id: z.string(),
  docType: z.string(),
  docId: z.string(),
  copyNo: Int,
  isDuplicate: z.boolean(),
  status: z.enum(['queued', 'printing', 'done', 'failed', 'cancelled']),
  attemptCount: Int,
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type PrintJobSummary = z.infer<typeof PrintJobSummary>;
