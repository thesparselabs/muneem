import { describe, expect, it } from 'vitest';
import { channels, contract, ERROR_CODES, ROLE_PRESETS } from '../src/index.js';

describe('IPC contract registry', () => {
  it('every channel is namespaced, has a schema, a permission decision and a rate limit', () => {
    for (const ch of channels) {
      expect(ch).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      const s = contract[ch];
      expect(s.input).toBeDefined();
      expect(s.output).toBeDefined();
      expect('permission' in s).toBe(true);
      expect(s.rateLimit.perSec).toBeGreaterThan(0);
    }
  });
  it('never exposes raw SQL, shell or filesystem surface (LLD §10.2)', () => {
    const banned = /sql|shell|exec|readFile|writeFile|openPath|path/i;
    for (const ch of channels) expect(ch, ch).not.toMatch(banned);
  });
  it('mutating methods are audited', () => {
    const mutating = channels.filter((c) => /\.(create|update|set|select|switch|logout|login|backup|export|integrity)/i.test(c));
    for (const c of mutating) expect(contract[c].audit, c).toBe(true);
  });
  it('error codes map to a class', () => {
    for (const [, cls] of Object.entries(ERROR_CODES)) expect(typeof cls).toBe('string');
  });
  it('role presets never say "optional": every preset is a concrete grant list', () => {
    for (const [role, grants] of Object.entries(ROLE_PRESETS)) {
      expect(grants.length, role).toBeGreaterThan(0);
      for (const g of grants) expect(g.permission).toMatch(/^[a-z]+\.[a-z]+$/);
    }
    expect(ROLE_PRESETS.cashier!.some((g) => g.permission === 'accounting.view')).toBe(false);
  });
});
