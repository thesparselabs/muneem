import type { CustomerConsent } from '@muneem/contracts';
import { formatPaise } from '../money.js';

export const CHANNEL_LABEL: Record<CustomerConsent['channel'], string> = { sms: 'SMS', whatsapp: 'WhatsApp' };
export const METHOD_LABEL: Record<CustomerConsent['method'], string> = { in_person: 'In person', phone: 'On the phone', written: 'In writing', digital: 'Online form' };
export const PURPOSE_LABEL: Record<CustomerConsent['purpose'], string> = { payment_reminders: 'Payment reminders' };

export interface ConsentRow { id: string; active: boolean; text: string; when: string }

// Active consents first, then the withdrawn history, each newest first.
export function consentRows(consents: readonly CustomerConsent[] | undefined): ConsentRow[] {
  return [...(consents ?? [])]
    .sort((a, b) => Number(a.withdrawnAt !== null) - Number(b.withdrawnAt !== null) || b.givenAt.localeCompare(a.givenAt))
    .map((c) => ({
      id: c.id, active: c.withdrawnAt === null, text: `${PURPOSE_LABEL[c.purpose]} by ${CHANNEL_LABEL[c.channel]} · ${METHOD_LABEL[c.method]}`,
      when: c.withdrawnAt === null ? `given ${c.givenAt.slice(0, 10)}` : `given ${c.givenAt.slice(0, 10)}, withdrawn ${c.withdrawnAt.slice(0, 10)}`,
    }));
}

// Channels the customer has not already agreed to, for the "record consent" picker.
export const channelsToAsk = (consents: readonly CustomerConsent[] | undefined): CustomerConsent['channel'][] =>
  (['sms', 'whatsapp'] as const).filter((ch) => !(consents ?? []).some((c) => c.channel === ch && c.withdrawnAt === null));

// Why erasure is not possible yet, or null when it is: the ledger must be square first.
export function eraseBlocker(balancePaise: number | undefined): string | null {
  if (balancePaise === undefined) return 'Loading the balance…';
  if (balancePaise > 0) return `The customer still owes ${formatPaise(balancePaise)}. Settle it first.`;
  if (balancePaise < 0) return `The customer has ${formatPaise(-balancePaise)} in advance. Refund or apply it first.`;
  return null;
}
