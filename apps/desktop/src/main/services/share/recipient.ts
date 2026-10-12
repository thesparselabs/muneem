import { z } from 'zod';
import { AppError, type ShareChannel } from '@muneem/contracts';

const Email = z.string().email();

// wa.me takes the number with its country code and nothing else; a bare 10-digit mobile is Indian.
export function whatsappNumber(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/gu, '');
  if (!/^\+?\d+$/u.test(compact)) return null;
  const digits = compact.replace(/^\+/u, '');
  if (compact.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : null;
  if (digits.length === 10 && /^[6-9]/u.test(digits)) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return whatsappNumber(digits.slice(1));
  if (digits.length === 12 && digits.startsWith('91')) return whatsappNumber(digits.slice(2));
  return null;
}

// The recipient as the channel needs it, or a field error the share dialog shows under "To".
export function recipientFor(channel: ShareChannel, raw: string): string {
  const to = raw.trim();
  if (channel === 'whatsapp') {
    const number = whatsappNumber(to);
    if (!number) throw new AppError('VALIDATION_FAILED', 'Enter a WhatsApp number', { to: 'a 10-digit mobile number, or + and the country code' });
    return number;
  }
  if (!Email.safeParse(to).success) throw new AppError('VALIDATION_FAILED', 'Enter an email address', { to: 'one email address' });
  return to;
}

export const whatsappLink = (number: string, message: string): string => `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
