import { z } from 'zod';
import { IsoDateTime, Ulid } from './schemas.js';

// 7f: where adding this device to a business stands. `held` means billing waits until the import is ready.
export const HydrationStatus = z.object({
  businessId: Ulid.nullable(),
  status: z.enum(['none', 'pending', 'downloading', 'importing', 'ready', 'failed']),
  held: z.boolean(),
  bytesTotal: z.number().int().nullable(), bytesDownloaded: z.number().int(),
  linesTotal: z.number().int().nullable(), linesImported: z.number().int(),
  asOfSeq: z.number().int().nullable(), error: z.string().nullable(), updatedAt: IsoDateTime.nullable(),
});
export type HydrationStatus = z.infer<typeof HydrationStatus>;

export const HydrationStartInput = z.object({ businessId: Ulid });

// A business the signed-in user belongs to on the cloud, and whether this device already holds it.
export const CloudBusiness = z.object({ id: Ulid, name: z.string(), stateCode: z.string().nullable(), onThisDevice: z.boolean() });
export type CloudBusiness = z.infer<typeof CloudBusiness>;
