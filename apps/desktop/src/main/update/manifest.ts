import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { basename } from 'node:path';
import { parse, stringify } from 'yaml';

export interface ManifestFile { url: string; sha512: string; size: number }

// electron-updater's latest.yml, with the staged rollout in its own `stagingPercentage` field.
export interface LatestManifest {
  version: string;
  files: ManifestFile[];
  path: string;
  sha512: string;
  releaseDate: string;
  stagingPercentage?: number;
}

export async function sha512Base64(path: string): Promise<string> {
  const h = createHash('sha512');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('base64');
}

export interface ManifestInput { version: string; installers: string[]; releaseDate: string; rolloutPercentage?: number | null }

export async function buildManifest(i: ManifestInput): Promise<LatestManifest> {
  if (i.installers.length === 0) throw new Error('no installer to describe');
  const pct = i.rolloutPercentage;
  if (pct !== undefined && pct !== null && (!Number.isInteger(pct) || pct < 0 || pct > 100)) throw new Error('the rollout percentage must be a whole number from 0 to 100');
  const files = await Promise.all(i.installers.map(async (p) => ({ url: basename(p), sha512: await sha512Base64(p), size: statSync(p).size })));
  const main = files[0]!;
  return { version: i.version, files, path: main.url, sha512: main.sha512, releaseDate: i.releaseDate, ...(pct !== undefined && pct !== null && pct < 100 && { stagingPercentage: pct }) };
}

export function renderManifest(m: LatestManifest): string {
  // Quoted, as electron-builder writes it: js-yaml would otherwise read releaseDate as a Date.
  return stringify(m, { lineWidth: 0, defaultStringType: 'QUOTE_SINGLE', defaultKeyType: 'PLAIN' });
}

export function parseManifest(text: string): LatestManifest {
  const m = parse(text) as Partial<LatestManifest> | null;
  if (!m || typeof m.version !== 'string' || !Array.isArray(m.files) || m.files.length === 0) throw new Error('latest.yml has no version or files');
  return m as LatestManifest;
}
