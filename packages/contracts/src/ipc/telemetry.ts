import { z } from 'zod';

// ADR-0053: whether this business sends crash reports, whether the build knows where to, and when one last went out.
export const CrashReportingStatus = z.object({ enabled: z.boolean(), configured: z.boolean(), lastSentAt: z.string().nullable() });
export type CrashReportingStatus = z.infer<typeof CrashReportingStatus>;

export const RendererErrorInput = z.object({
  source: z.enum(['error', 'unhandledrejection']), name: z.string().max(200).optional(), message: z.string().max(2000), stack: z.string().max(8000).optional(),
});
export type RendererErrorInput = z.infer<typeof RendererErrorInput>;
