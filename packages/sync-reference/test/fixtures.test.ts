import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Change, PullResponse, PushResponse } from '@muneem/contracts';
import { ReferenceServer, type PullQuery } from '../src/index.js';

interface Step { device: string; call: 'push' | 'pull'; request: Record<string, unknown>; expect: Record<string, unknown> }
interface Fixture { name: string; description: string; setup: { organizationId: string; userId: string; devices: string[] }; steps: Step[] }

const DIR = new URL('../../contracts/fixtures/sync/', import.meta.url);
const load = (dir: URL) => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Fixture);
const fixtures = load(DIR);
// ADR-0049: the previous protocol's fixtures, frozen, replayed against a server one protocol ahead.
const previous = load(new URL('v1/', DIR));
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

async function replay(f: Fixture, server: ReferenceServer): Promise<void> {
  server.addMember(f.setup.userId, f.setup.organizationId);
  for (const d of f.setup.devices) server.registerDevice(deviceId(d), f.setup.userId);
  for (const [i, step] of f.steps.entries()) {
    const answer = step.call === 'push'
      ? await server.push(deviceId(step.device), step.request)
      : await server.pull(deviceId(step.device), step.request as unknown as PullQuery);
    expect(check(answer, step.expect), `step ${i} (${step.device} ${step.call})`).toEqual([]);
  }
}

describe('protocol fixtures against the reference server (ADR-0042)', () => {
  it('finds the fixtures', () => expect(fixtures.length).toBeGreaterThanOrEqual(5));

  for (const f of fixtures) it(`${f.name}: ${f.description}`, () => replay(f, new ReferenceServer()));
});

describe('protocol N−1 against a server at N=2, min 1 (ADR-0049)', () => {
  it('finds the frozen v1 fixtures', () => expect(previous.length).toBeGreaterThanOrEqual(5));

  for (const f of previous) it(f.name, () => replay(f, new ReferenceServer({ protocol: 2, minProtocol: 1 })));

  it('refuses a protocol below the minimum or above the current one', async () => {
    const f = previous.find((x) => x.steps[0]?.call === 'push')!;
    for (const protocol of [0, 3]) {
      const server = new ReferenceServer({ protocol: 2, minProtocol: 1 });
      server.addMember(f.setup.userId, f.setup.organizationId);
      server.registerDevice(deviceId('A'), f.setup.userId);
      await expect(server.push(deviceId('A'), { ...f.steps[0]!.request, protocol })).rejects.toMatchObject({ status: 426, code: 'VERSION_UNSUPPORTED' });
    }
  });
});
