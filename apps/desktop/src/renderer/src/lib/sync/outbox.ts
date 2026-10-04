import type { FailedOperation } from '@muneem/contracts';

export const PREVIEW_CHARS = 4000;

// Pretty JSON when it parses (main may have cut a large payload short), cut to a readable length either way.
export function payloadPreview(op: Pick<FailedOperation, 'payloadJson' | 'payloadBytes'>, maxChars = PREVIEW_CHARS): string {
  let text: string;
  try { text = JSON.stringify(JSON.parse(op.payloadJson), null, 2); } catch { text = op.payloadJson; }
  const cut = text.length > maxChars || op.payloadBytes > new TextEncoder().encode(op.payloadJson).length;
  return cut ? `${text.slice(0, maxChars)}\n… (${op.payloadBytes.toLocaleString('en-IN')} bytes in all)` : text;
}

export const errorLine = (op: Pick<FailedOperation, 'errorCode' | 'errorClass' | 'errorMessage'>): string =>
  [op.errorCode ?? 'no code', op.errorClass && `(${op.errorClass})`, op.errorMessage].filter(Boolean).join(' ');

export const STREAM_LABEL: Record<string, string> = { control: 'Control', config: 'Settings', masters: 'Products & parties', documents: 'Documents' };
