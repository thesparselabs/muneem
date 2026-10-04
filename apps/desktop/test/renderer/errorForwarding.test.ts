import { describe, expect, it } from 'vitest';
import type { RendererErrorInput } from '@muneem/contracts';
import { forwardRendererErrors } from '../../src/renderer/src/lib/errorForwarding.js';

function fakeWindow() {
  const listeners = new Map<string, (e: unknown) => void>();
  return { addEventListener: (type: string, fn: (e: unknown) => void) => { listeners.set(type, fn); }, fire: (type: string, e: unknown) => listeners.get(type)!(e) };
}

describe('renderer error forwarding (ADR-0053)', () => {
  it('forwards errors and rejections to main, bounded, and never throws when main refuses', () => {
    const w = fakeWindow();
    const sent: RendererErrorInput[] = [];
    forwardRendererErrors(w as never, (i) => { sent.push(i); return Promise.reject(new Error('rate limited')); });
    w.fire('error', { error: new TypeError('x'.repeat(3000)), message: 'ignored' });
    w.fire('unhandledrejection', { reason: 'not an error' });
    expect(sent[0]).toMatchObject({ source: 'error', name: 'TypeError' });
    expect(sent[0]!.message).toHaveLength(2000);
    expect(sent[1]).toEqual({ source: 'unhandledrejection', message: 'unhandled rejection' });
  });

  it('survives a missing bridge', () => {
    const w = fakeWindow();
    forwardRendererErrors(w as never, () => { throw new Error('no bridge'); });
    expect(() => w.fire('error', { message: 'boom' })).not.toThrow();
  });
});
