import type { ClientError } from '@muneem/contracts';

/** Thin access to the preload bridge. Every rejection is a ClientError (plain object, LLD §17). */
export const api = window.muneem;

export function isClientError(e: unknown): e is ClientError {
  return !!e && typeof e === 'object' && 'code' in e && 'class' in e;
}
export function errorMessage(e: unknown): string {
  if (isClientError(e)) return e.fields ? `${e.message}: ${Object.entries(e.fields).map(([k, v]) => `${k} ${v}`).join(', ')}` : e.message;
  return e instanceof Error ? e.message : String(e);
}
