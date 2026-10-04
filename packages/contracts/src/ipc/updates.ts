import { z } from 'zod';

// ADR-0049: channels, staged rollout and an install that never interrupts a sale.
export const UPDATE_CHANNELS = ['dev', 'beta', 'stable'] as const;
export const UpdateChannel = z.enum(UPDATE_CHANNELS);
export type UpdateChannel = z.infer<typeof UpdateChannel>;

export const UpdateState = z.enum(['disabled', 'idle', 'checking', 'up_to_date', 'available', 'downloading', 'ready', 'error']);
export type UpdateState = z.infer<typeof UpdateState>;

export const MigrationFailure = z.object({ at: z.string(), from: z.number().int(), to: z.number().int(), appVersion: z.string(), error: z.string(), restored: z.boolean() });
export type MigrationFailure = z.infer<typeof MigrationFailure>;

export const UpdateStatus = z.object({
  state: UpdateState,
  channel: UpdateChannel,
  currentVersion: z.string(),
  availableVersion: z.string().nullable(),
  percent: z.number().min(0).max(100).nullable(),
  error: z.string().nullable(),
  checkedAt: z.string().nullable(),
  // Why "Restart and update" is not offered right now; null when it may install.
  installBlockedReason: z.string().nullable(),
  lastMigrationFailure: MigrationFailure.nullable(),
});
export type UpdateStatus = z.infer<typeof UpdateStatus>;

export const SetChannelInput = z.object({ channel: UpdateChannel });
export const ReportCartInput = z.object({ lines: z.number().int().min(0).max(10_000) });
