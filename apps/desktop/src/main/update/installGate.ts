import type { PosActivitySnapshot } from './posActivity.js';

export const DEFAULT_REGISTER_IDLE_MS = 10 * 60_000;
export const WAIT_FOR_REGISTER = 'Update ready — will install when you close the register';

export interface InstallGateDeps {
  activity: () => PosActivitySnapshot;
  registerOpen: () => boolean;
  now: () => number;
  registerIdleMs?: number;
}

// Never mid-sale: no bill in the cart, nothing being saved, and the register closed or untouched for a while.
export class InstallGate {
  constructor(private readonly d: InstallGateDeps) {}

  blockedReason(): string | null {
    const a = this.d.activity();
    if (a.cartLines > 0) return 'A bill is being rung up. Finish or hold it first.';
    if (a.commandsInFlight > 0) return 'Muneem is still saving. Try again in a moment.';
    const idleFor = this.d.now() - a.lastActivityAt;
    if (this.d.registerOpen() && idleFor < (this.d.registerIdleMs ?? DEFAULT_REGISTER_IDLE_MS)) return WAIT_FOR_REGISTER;
    return null;
  }
}
