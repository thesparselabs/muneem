import { describe, expect, it } from 'vitest';
import type { UpdateStatus } from '@muneem/contracts';
import { bannerText, canRestartNow, statusLine } from '../../src/renderer/src/lib/update.js';

const status = (over: Partial<UpdateStatus>): UpdateStatus => ({
  state: 'idle', channel: 'stable', currentVersion: '0.1.0', availableVersion: null, percent: null, error: null, checkedAt: null,
  installBlockedReason: null, lastMigrationFailure: null, ...over,
});

describe('Settings → Updates', () => {
  it('describes each state in a line', () => {
    expect(statusLine(status({ state: 'downloading', availableVersion: '0.2.0', percent: 42 }))).toBe('Downloading version 0.2.0 — 42%');
    expect(statusLine(status({ state: 'error', error: 'offline' }))).toBe('Update failed: offline');
    expect(statusLine(status({ state: 'disabled' }))).toMatch(/off/);
  });

  it('offers "Restart and update" only when ready and the till is idle', () => {
    expect(canRestartNow(status({ state: 'ready', availableVersion: '0.2.0' }))).toBe(true);
    expect(canRestartNow(status({ state: 'ready', installBlockedReason: 'A bill is being rung up' }))).toBe(false);
    expect(canRestartNow(status({ state: 'downloading' }))).toBe(false);
  });

  it('shows the banner only for a ready update, saying when it will install', () => {
    expect(bannerText(status({ state: 'downloading' }))).toBeNull();
    expect(bannerText(undefined)).toBeNull();
    expect(bannerText(status({ state: 'ready', availableVersion: '0.2.0', installBlockedReason: 'x' }))).toBe('Update 0.2.0 ready — will install when you close the register');
    expect(bannerText(status({ state: 'ready', availableVersion: '0.2.0' }))).toMatch(/restart Muneem/);
  });
});
