import { monotonicFactory, ulid as plainUlid } from 'ulid';

const monotonic = monotonicFactory();

/** Time-sortable, collision-free without coordination (LLD §1.4). Monotonic within this process. */
export function newUlid(): string {
  return monotonic();
}

/** Non-monotonic ULID; only for tests or when process-monotonicity is not wanted. */
export function randomUlid(): string {
  return plainUlid();
}

const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export function isUlid(s: string): boolean {
  return ULID_RE.test(s);
}
