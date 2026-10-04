import { z } from 'zod';
import { AppError } from './errors.js';

const Paise = z.number().int().min(0).max(1_000_000_000_000);

// Every business setting has a schema; settings.set refuses unknown keys and bad values, and readers fall back to defaults.
export const SETTING_SCHEMAS = {
  'pos.roundToRupee': z.boolean(),
  'pos.blindClose': z.boolean(),
  'pos.varianceThresholdPaise': Paise,
  'gst.b2clThresholdPaise': Paise.refine((v) => v > 0, 'must be more than zero'),
  // Effective-dated thresholds (LLD §3.1); the latest on or before a bill's date wins, else gst.b2clThresholdPaise.
  'gst.b2clThresholds': z.array(z.object({
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'a date'), paise: Paise.refine((v) => v > 0, 'must be more than zero'),
  })).max(20),
  'inventory.negativeStock': z.enum(['block', 'warn', 'allow']),
  'pos.receiptFooter': z.array(z.string().trim().max(48, 'at most 48 characters per line')).max(5, 'at most 5 lines'),
  // NFR-025 / ADR-0053: crash and error reports leave the device only when the owner turns this on (default off).
  'telemetry.crashReports': z.boolean(),
} as const;
export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;
export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as [SettingKey, ...SettingKey[]];

export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  const r = SETTING_SCHEMAS[key].safeParse(value);
  if (!r.success) throw new AppError('VALIDATION_FAILED', `Invalid value for ${key}`, { value: r.error.issues.map((i) => i.message).join('; ') });
  return r.data as SettingValue<K>;
}
