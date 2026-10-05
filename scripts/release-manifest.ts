/**
 * Writes a channel's latest.yml (ADR-0049) from an electron-builder output folder; never uploads anything.
 * Run: tsx scripts/release-manifest.ts --dir apps/desktop/release --channel beta --rollout 10 [--version 0.2.0] [--out <updates root>] [--archive]
 * --archive also writes <out>/releases/<version>/, the immutable copy promotions start from (ADR-0056).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { writeChannelManifest, writeReleaseArchive } from '../apps/desktop/src/main/update/release.js';

const { values } = parseArgs({
  options: {
    dir: { type: 'string' }, channel: { type: 'string', default: 'stable' }, rollout: { type: 'string' }, version: { type: 'string' }, out: { type: 'string' },
    archive: { type: 'boolean', default: false },
  },
});
if (!values.dir) throw new Error('--dir <electron-builder output folder> is required');
const dir = resolve(values.dir);
const version = values.version ?? (JSON.parse(readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8')) as { version: string }).version;
const installers = readdirSync(dir).filter((f) => f.endsWith('.exe') && f.includes(version)).map((f) => join(dir, f));
const outRoot = resolve(values.out ?? join(dir, 'updates'));
const releaseDate = new Date().toISOString();

const written = await writeChannelManifest({
  outRoot, channel: values.channel, version, installers, releaseDate,
  rolloutPercentage: values.rollout === undefined ? null : Number(values.rollout),
});
console.log(`release-manifest: ${written}`);
if (values.archive) console.log(`release-manifest: ${await writeReleaseArchive({ outRoot, version, installers, releaseDate })}`);
