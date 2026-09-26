import { describe, expect, it } from 'vitest';
import { channels } from '@muneem/contracts';
import { exposed, invoked } from './electron-stub.js';
import { EXPOSED_CHANNELS, EXPOSED_EVENTS } from '../src/preload/generated.js';

function flatten(api: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(api)) {
    if (typeof v === 'function') out.push(prefix + k);
    else if (v && typeof v === 'object') out.push(...flatten(v as Record<string, unknown>, prefix + k + '.'));
  }
  return out;
}

describe('preload surface (LLD §10.1: generated, exactly the contract)', () => {
  it('exposes exactly the contract channels plus the events subscription', () => {
    const api = exposed.muneem as Record<string, unknown>;
    expect(api).toBeDefined();
    const methods = flatten(api).filter((m) => !m.startsWith('events.'));
    expect(methods.sort()).toEqual([...channels].sort());
    expect([...EXPOSED_CHANNELS].sort()).toEqual([...channels].sort());
    expect(flatten(api).filter((m) => m.startsWith('events.'))).toEqual(['events.on']);
    expect(EXPOSED_EVENTS).toEqual(['sync.status', 'connectivity.changed', 'session.changed']);
  });
  it('never exposes raw ipcRenderer, require, sql, shell or file access', () => {
    const api = exposed.muneem as Record<string, unknown>;
    for (const k of Object.keys(api)) expect(k).not.toMatch(/ipc|require|sql|shell|fs|path/i);
    expect(JSON.stringify(flatten(api))).not.toMatch(/execute|readFile|writeFile|openPath/);
  });
  it('routes a call to ipcRenderer.invoke with the same channel name', async () => {
    const api = exposed.muneem as { auth: { getSession: (i: unknown) => Promise<unknown> } };
    await api.auth.getSession({});
    expect(invoked.at(-1)).toEqual({ channel: 'auth.getSession', input: {} });
  });
  it('events.on rejects unknown channels', () => {
    const api = exposed.muneem as { events: { on: (c: string, cb: () => void) => void } };
    expect(() => api.events.on('evil', () => undefined)).toThrow(/unknown event/);
  });
});
