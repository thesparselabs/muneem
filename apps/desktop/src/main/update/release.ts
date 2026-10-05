import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { UpdateChannel } from '@muneem/contracts';
import { buildManifest, renderManifest } from './manifest.js';

export interface ChannelRelease {
  outRoot: string;
  channel: string | undefined;
  version: string;
  installers: string[];
  releaseDate: string;
  rolloutPercentage: number | null;
}

// Lays out <outRoot>/<channel>/ as the update host serves it: the installers, their blockmaps and latest.yml.
export async function writeChannelManifest(r: ChannelRelease): Promise<string> {
  const channel = UpdateChannel.parse(r.channel);
  const dir = join(r.outRoot, channel);
  mkdirSync(dir, { recursive: true });
  const manifest = await buildManifest({ version: r.version, installers: r.installers, releaseDate: r.releaseDate, rolloutPercentage: r.rolloutPercentage });
  for (const installer of r.installers) {
    copyFileSync(installer, join(dir, basename(installer)));
    if (existsSync(`${installer}.blockmap`)) copyFileSync(`${installer}.blockmap`, join(dir, `${basename(installer)}.blockmap`));
  }
  const file = join(dir, 'latest.yml');
  writeFileSync(file, renderManifest(manifest));
  return file;
}
