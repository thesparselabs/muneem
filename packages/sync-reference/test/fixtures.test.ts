import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Change, PullResponse, PushResponse } from '@muneem/contracts';
import { ReferenceServer, type PullQuery } from '../src/index.js';

interface Step { device: string; call: 'push' | 'pull'; request: Record<string, unknown>; expect: Record<string, unknown> }
interface Fixture { name: string; description: string; setup: { organizationId: string; userId: string; devices: string[] }; steps: Step[] }

const DIR = new URL('../../contracts/fixtures/sync/', import.meta.url);
const fixtures = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Fixture);
const deviceId = (symbol: string) => `device-${symbol}`;

// README "Matching": objects on the keys listed, arrays by length and element, device symbols as that device's id.
function partial(actual: unknown, expected: unknown, path: string): string[] {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${path}: expected an array`];
    if (actual.length !== expected.length) return [`${path}: length ${actual.length} ≠ ${expected.length}`];
    return expected.flatMap((e, i) => partial(actual[i], e, `${path}[${i}]`));
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return [`${path}: expected an object`];
    return Object.entries(expected).flatMap(([k, v]) => partial((actual as Record<string, unknown>)[k], k === 'originDeviceId' && typeof v === 'string' ? deviceId(v) : v, `${path}.${k}`));
  }
  return actual === expected ? [] : [`${path}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`];
}

function check(answer: PushResponse | PullResponse, expected: Record<string, unknown>): string[] {
  const { lastChangeFor, ...rest } = expected as { lastChangeFor?: { entityType: string; entityId: string } };
  const problems = partial(answer, rest, '$');
  if (lastChangeFor) {
    const last = ((answer as PullResponse).changes as Change[]).filter((c) => c.entityType === lastChangeFor.entityType && c.entityId === lastChangeFor.entityId).at(-1);
    problems.push(...(last ? partial(last, lastChangeFor, '$.lastChangeFor') : ['$.lastChangeFor: no such change']));
  }
  return problems;
}

describe('protocol fixtures against the reference server (ADR-0042)', () => {
  it('finds the fixtures', () => expect(fixtures.length).toBeGreaterThanOrEqual(5));

  for (const f of fixtures) {
    it(`${f.name}: ${f.description}`, async () => {
      const server = new ReferenceServer();
      server.addMember(f.setup.userId, f.setup.organizationId);
      for (const d of f.setup.devices) server.registerDevice(deviceId(d), f.setup.userId);
      for (const [i, step] of f.steps.entries()) {
        const answer = step.call === 'push'
          ? await server.push(deviceId(step.device), step.request)
          : await server.pull(deviceId(step.device), step.request as unknown as PullQuery);
        expect(check(answer, step.expect), `step ${i} (${step.device} ${step.call})`).toEqual([]);
      }
    });
  }
});
