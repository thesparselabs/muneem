import type { Permission, Session } from '@muneem/contracts';
import { useUi } from '../store.js';

// Hides what the user cannot do; main still refuses anything it is not allowed (5f details).
export const can = (session: Session | null | undefined, permission: Permission): boolean => !!session?.permissions.includes(permission);

export function useCan(permission: Permission): boolean {
  return can(useUi((s) => s.session), permission);
}
