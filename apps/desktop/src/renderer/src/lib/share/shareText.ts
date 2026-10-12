import type { ShareChannel, ShareRecord, ShareStatus } from '@muneem/contracts';
import type { ToastVariant } from '../toast.js';

export const CHANNEL_LABELS: Record<ShareChannel, string> = { whatsapp: 'WhatsApp', email: 'Email' };
export const STATUS_LABELS: Record<ShareStatus, string> = {
  opened: 'Opened in WhatsApp', queued: 'Waiting to send', sending: 'Sending', sent: 'Sent', failed: 'Not sent',
};

// What the user is told once a share has left the dialog, and what to do next.
export function shareOutcome(r: Pick<ShareRecord, 'status' | 'to' | 'fileName' | 'lastError'>): { text: string; variant: ToastVariant } {
  switch (r.status) {
    case 'opened': return { text: `WhatsApp opened for ${r.to}. Attach ${r.fileName} from your Downloads folder, then press send.`, variant: 'success' };
    case 'sent': return { text: `Emailed to ${r.to}.`, variant: 'success' };
    case 'failed': return { text: `Not sent: ${r.lastError ?? 'the email was refused'}.`, variant: 'error' };
    default: return { text: `The email to ${r.to} is waiting and goes out as soon as Muneem is online.`, variant: 'info' };
  }
}

export const hasPending = (records: readonly Pick<ShareRecord, 'status'>[]): boolean => records.some((r) => r.status === 'queued' || r.status === 'sending');

export const sharedAt = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
