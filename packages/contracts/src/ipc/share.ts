import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

// FR-085 (ADR-0067): a document leaves the shop as a PDF, by WhatsApp click-to-chat or by the cloud's email relay.
export const SHARE_DOC_TYPES = ['invoice', 'credit_note', 'customer_statement', 'supplier_statement'] as const;
export const ShareDocType = z.enum(SHARE_DOC_TYPES);
export type ShareDocType = z.infer<typeof ShareDocType>;

export const SHARE_CHANNELS = ['whatsapp', 'email'] as const;
export const ShareChannel = z.enum(SHARE_CHANNELS);
export type ShareChannel = z.infer<typeof ShareChannel>;

// opened: WhatsApp was opened with the message for the user to send; queued → sending → sent | failed: an email.
export const ShareStatus = z.enum(['opened', 'queued', 'sending', 'sent', 'failed']);
export type ShareStatus = z.infer<typeof ShareStatus>;

// The cloud relays at most this much PDF per email, so its base64 fits the API's 2 MiB request limit.
export const SHARE_EMAIL_MAX_PDF_BYTES = 1_048_576;

// A statement covers its period; without one, everything to date. Apart from `to`, which is the recipient on a send.
export const SharePeriod = z.object({ from: BusinessDate.optional(), to: BusinessDate.optional() });
export const ShareTarget = z.object({ docType: ShareDocType, id: Ulid, period: SharePeriod.optional() });
export type ShareTarget = z.infer<typeof ShareTarget>;

export const SharePreviewInput = ShareTarget.extend({ channel: ShareChannel });
export type SharePreviewInput = z.infer<typeof SharePreviewInput>;

// What the share dialog starts from: the party's number or address on file (or empty) and the standard message.
export const SharePreview = z.object({ docLabel: z.string(), to: z.string(), subject: z.string(), message: z.string(), fileName: z.string() });
export type SharePreview = z.infer<typeof SharePreview>;

export const SendShareInput = SharePreviewInput.extend({
  to: z.string().trim().min(1).max(254),
  message: z.string().trim().min(1).max(1000),
});
export type SendShareInput = z.infer<typeof SendShareInput>;

export const ShareRecord = z.object({
  id: Ulid,
  docType: ShareDocType,
  docId: Ulid,
  docLabel: z.string(),
  channel: ShareChannel,
  to: z.string(),
  status: ShareStatus,
  fileName: z.string(),
  attempts: z.number().int(),
  lastError: z.string().optional(),
  createdAt: IsoDateTime,
  sentAt: IsoDateTime.optional(),
});
export type ShareRecord = z.infer<typeof ShareRecord>;

export const ShareHistoryInput = ShareTarget.pick({ docType: true, id: true });
export type ShareHistoryInput = z.infer<typeof ShareHistoryInput>;
