import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { UpdateChannel } from '@muneem/contracts';
import { defaultChannelFor } from './version.js';
import { assertRollout, buildManifest, parseManifest, renderManifest, sha512Base64, type LatestManifest } from './manifest.js';

export interface ChannelRelease {
  outRoot: string;
  channel: string | undefined;
  version: string;
  installers: string[];
  releaseDate: string;
  rolloutPercentage: number | null;
}

export const RELEASE_ARCHIVE = 'releases';

// Lays out <outRoot>/<channel>/ as the update host serves it: the installers, their blockmaps and latest.yml.
export async function writeChannelManifest(r: ChannelRelease): Promise<string> {
  const channel = UpdateChannel.parse(r.channel);
  const manifest = await buildManifest({ version: r.version, installers: r.installers, releaseDate: r.releaseDate, rolloutPercentage: r.rolloutPercentage });
  return writeReleaseDir(join(r.outRoot, channel), manifest, r.installers);
}

// The immutable copy every promotion and rollback starts from: <outRoot>/releases/<version>/, with no rollout.
export async function writeReleaseArchive(r: Omit<ChannelRelease, 'channel' | 'rolloutPercentage'>): Promise<string> {
  const manifest = await buildManifest({ version: r.version, installers: r.installers, releaseDate: r.releaseDate });
  return writeReleaseDir(join(r.outRoot, RELEASE_ARCHIVE, parseReleaseVersion(r.version)), manifest, r.installers);
}

export interface Promotion {
  sourceDir: string;
  outRoot: string;
  channel: string | undefined;
  version: string;
  rolloutPercentage: number | null;
}

// Copies an already-built release into a channel byte for byte; only the rollout percentage in latest.yml changes.
export async function promoteRelease(p: Promotion): Promise<string> {
  const channel = UpdateChannel.parse(p.channel);
  assertRollout(p.rolloutPercentage);
  const source = parseManifest(readFileSync(join(p.sourceDir, 'latest.yml'), 'utf8'));
  if (source.version !== p.version) throw new Error(`${p.sourceDir} holds ${source.version}, not ${p.version}`);
  if (source.files.some((f) => basename(f.url) !== f.url)) throw new Error('latest.yml names a file outside its folder');
  const installers = source.files.map((f) => join(p.sourceDir, f.url));
  await Promise.all(source.files.map((f, i) => assertUnchanged(installers[i]!, f)));
  const manifest: LatestManifest = { ...source };
  delete manifest.stagingPercentage;
  const pct = p.rolloutPercentage;
  if (pct !== null && pct < 100) manifest.stagingPercentage = pct;
  return writeReleaseDir(join(p.outRoot, channel), manifest, installers);
}

async function assertUnchanged(path: string, expected: { url: string; sha512: string; size: number }): Promise<void> {
  if (!existsSync(path)) throw new Error(`${expected.url} is missing beside latest.yml`);
  if (statSync(path).size !== expected.size || (await sha512Base64(path)) !== expected.sha512) throw new Error(`${expected.url} does not match its sha512 in latest.yml`);
}

function writeReleaseDir(dir: string, manifest: LatestManifest, installers: string[]): string {
  mkdirSync(dir, { recursive: true });
  for (const installer of installers) {
    const target = join(dir, basename(installer));
    if (target !== installer) copyFileSync(installer, target);
    if (existsSync(`${installer}.blockmap`) && `${target}.blockmap` !== `${installer}.blockmap`) copyFileSync(`${installer}.blockmap`, `${target}.blockmap`);
  }
  const file = join(dir, 'latest.yml');
  writeFileSync(file, renderManifest(manifest));
  return file;
}

const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/u;

// "refs/tags/v1.4.0-beta.2", "v1.4.0-beta.2" or "1.4.0-beta.2" → "1.4.0-beta.2".
export function parseReleaseVersion(ref: string): string {
  const version = ref.trim().replace(/^refs\/tags\//u, '').replace(/^v/u, '');
  if (!RELEASE_VERSION.test(version)) throw new Error(`"${ref}" is not a release version (x.y.z or x.y.z-pre)`);
  return version;
}

// A fresh build goes to dev or beta; stable is reached only by promoting a build that beta already ran.
export function publishChannelFor(version: string, requested?: string): UpdateChannel {
  if (requested && requested !== 'auto') {
    const channel = UpdateChannel.parse(requested);
    if (channel === 'stable') throw new Error('a build is never published straight to stable; promote it from beta');
    return channel;
  }
  const named = defaultChannelFor(version);
  return named === 'stable' ? 'beta' : named;
}
