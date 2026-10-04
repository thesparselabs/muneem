import { describe, expect, it } from 'vitest';
import { InstallGate, WAIT_FOR_REGISTER } from '../../src/main/update/installGate.js';
import { PosActivity } from '../../src/main/update/posActivity.js';

const MIN = 60_000;

function till(registerOpen: boolean) {
  let now = 1_000_000;
  const activity = new PosActivity(() => now);
  const state = { registerOpen };
  const gate = new InstallGate({ activity: () => activity.snapshot(), registerOpen: () => state.registerOpen, now: () => now, registerIdleMs: 10 * MIN });
  return { activity, gate, state, advance: (ms: number) => { now += ms; } };
}

describe('update install gate (never mid-sale)', () => {
  it('defers while a bill is in the cart, even with the register long idle', () => {
    const t = till(true);
    t.activity.reportCart(3);
    t.advance(60 * MIN);
    expect(t.gate.blockedReason()).toMatch(/bill is being rung up/);
    t.activity.reportCart(0);
    expect(t.gate.blockedReason()).toBe(WAIT_FOR_REGISTER);
  });

  it('defers while a command is still running', () => {
    const t = till(false);
    const done = t.activity.dispatch('sales.complete');
    expect(t.gate.blockedReason()).toMatch(/still saving/);
    done();
    done();
    expect(t.activity.snapshot().commandsInFlight).toBe(0);
    expect(t.gate.blockedReason()).toBeNull();
  });

  it('waits for the register to close, or to sit idle for the configured minutes', () => {
    const t = till(true);
    t.activity.dispatch('sales.complete')();
    t.advance(9 * MIN);
    expect(t.gate.blockedReason()).toBe(WAIT_FOR_REGISTER);
    t.advance(MIN);
    expect(t.gate.blockedReason()).toBeNull();
    t.activity.dispatch('sales.quote')();
    expect(t.gate.blockedReason()).toBe(WAIT_FOR_REGISTER);
    t.state.registerOpen = false;
    expect(t.gate.blockedReason()).toBeNull();
  });

  it('does not count reads, the update channels or the cart report itself as work', () => {
    const t = till(true);
    t.advance(30 * MIN);
    t.activity.dispatch('reports.run')();
    t.activity.dispatch('pos.getSession')();
    t.activity.reportCart(0);
    const install = t.activity.dispatch('update.installNow');
    expect(t.gate.blockedReason()).toBeNull();
    install();
  });

  it('a session change clears a cart the screen can no longer report', () => {
    const t = till(false);
    t.activity.reportCart(2);
    t.activity.clearCart();
    expect(t.gate.blockedReason()).toBeNull();
  });
});
