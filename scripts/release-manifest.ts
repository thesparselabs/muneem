/**
 * Writes a channel's latest.yml (ADR-0049) from an electron-builder output folder; never uploads anything.
 * Run: tsx scripts/release-manifest.ts --dir apps/desktop/release --channel beta --rollout 10 [--version 0.2.0] [--out <updates root>]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { writeChannelManifest } from '../apps/desktop/src/main/update/release.js';

const { values } = parseArgs({
  options: { dir: { type: 'string' }, channel: { type: 'string', default: 'stable' }, rollout: { type: 'string' }, version: { type: 'string' }, out: { type: 'string' } },
});
if (!values.dir) throw new Error('--dir <electron-builder output folder> is required');
const dir = resolve(values.dir);
const version = values.version ?? (JSON.parse(readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8')) as { version: string }).version;
const installers = readdirSync(dir).filter((f) => f.endsWith('.exe') && f.includes(version)).map((f) => join(dir, f));

const written = await writeChannelManifest({
  outRoot: resolve(values.out ?? join(dir, 'updates')), channel: values.channel, version, installers, releaseDate: new Date().toISOString(),
  rolloutPercentage: values.rollout === undefined ? null : Number(values.rollout),
});
console.log(`release-manifest: ${written}`);
