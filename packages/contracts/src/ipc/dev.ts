import { z } from 'zod';

const Count = z.number().int().min(0);
export const DemoSeedSummary = z.object({
  products: Count, parties: Count, sales: Count, purchases: Count, payments: Count, expenses: Count, returns: Count, adjustments: Count, journals: Count,
  errors: z.array(z.string()),
});
export type DemoSeedSummary = z.infer<typeof DemoSeedSummary>;
