/**
 * Copies an already-built release into a channel and rewrites its latest.yml with a new rollout (ADR-0056).
 * Run: tsx scripts/release-promote.ts --from <folder with latest.yml> --version 1.4.0 --channel stable --rollout 10 --out <updates root>
 * --rollout 0 halts a rollout; 100 (or omitted) is everyone.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { promoteRelease } from '../apps/desktop/src/main/update/release.js';

const { values } = parseArgs({
  options: { from: { type: 'string' }, version: { type: 'string' }, channel: { type: 'string' }, rollout: { type: 'string' }, out: { type: 'string' } },
});
if (!values.from || !values.version || !values.out) throw new Error('--from, --version and --out are required');

const written = await promoteRelease({
  sourceDir: resolve(values.from), outRoot: resolve(values.out), channel: values.channel, version: values.version,
  rolloutPercentage: values.rollout === undefined ? null : Number(values.rollout),
});
console.log(`release-promote: ${written}`);
