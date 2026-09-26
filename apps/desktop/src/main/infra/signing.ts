import { createHash } from 'node:crypto';

/**
 * Device request signature input. The Go server (cloud/internal/httpx) rebuilds EXACTLY this string:
 *   METHOD \n PATH \n TIMESTAMP \n sha256hex(body)
 * - PATH is the URL pathname as the server sees it (including the /v1 prefix, no query string).
 * - TIMESTAMP is UNIX SECONDS as a decimal string (the same string goes in X-Device-Timestamp);
 *   the server accepts ±5 minutes of skew and answers DEVICE_CLOCK_SKEW beyond that.
 * - Body hash is over the exact bytes sent; an empty/absent body hashes the empty string.
 */
export function signingString(method: string, path: string, timestampUnixSeconds: string, body: string | Uint8Array | undefined): string {
  const h = createHash('sha256').update(body ?? '').digest('hex');
  return `${method.toUpperCase()}\n${path}\n${timestampUnixSeconds}\n${h}`;
}

export function deviceTimestamp(nowMs = Date.now()): string {
  return String(Math.floor(nowMs / 1000));
}
