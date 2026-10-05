import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { parseManifest, sha512Base64, type LatestManifest } from './manifest.js';
import type { DownloadProgress, UpdateManifest, Updater } from './updater.js';
import { compareVersions } from './version.js';

export interface FolderUpdaterDeps {
  currentVersion: string;
  cacheDir: string;
  onInstall: (installer: string) => void;
}

// A static folder (a file:// feed) laid out like the update host: tests and dev runs use it instead of a server.
export class FolderUpdater implements Updater {
  private feedDir = '';
  private offered: LatestManifest | null = null;
  private downloaded: string | null = null;

  constructor(private readonly d: FolderUpdaterDeps) {}

  setFeed(feedUrl: string): void {
    this.feedDir = feedUrl.startsWith('file:') ? fileURLToPath(feedUrl) : feedUrl;
    this.offered = null;
  }

  async check(): Promise<UpdateManifest | null> {
    const file = join(this.feedDir, 'latest.yml');
    if (!existsSync(file)) throw new Error(`no update feed at ${file}`);
    const m = parseManifest(readFileSync(file, 'utf8'));
    if (compareVersions(m.version, this.d.currentVersion) <= 0) return null;
    this.offered = m;
    return { version: m.version, releaseDate: m.releaseDate ?? null, stagingPercentage: m.stagingPercentage ?? null };
  }

  async download(onProgress: (p: DownloadProgress) => void): Promise<void> {
    const m = this.offered;
    if (!m) throw new Error('check for an update first');
    const file = m.files[0]!;
    mkdirSync(this.d.cacheDir, { recursive: true });
    const target = join(this.d.cacheDir, file.url);
    if (existsSync(target) && (await sha512Base64(target)) === file.sha512) {
      this.downloaded = target;
      return;
    }
    const temp = `${target}.partial`;
    let transferred = 0;
    const source = createReadStream(join(this.feedDir, file.url));
    source.on('data', (chunk) => {
      transferred += chunk.length;
      onProgress({ percent: file.size ? (transferred / file.size) * 100 : 100, transferred, total: file.size });
    });
    await pipeline(source, createWriteStream(temp));
    if (statSync(temp).size !== file.size || (await sha512Base64(temp)) !== file.sha512) {
      rmSync(temp, { force: true });
      throw new Error('sha512 checksum mismatch: the download does not match latest.yml');
    }
    renameSync(temp, target);
    this.downloaded = target;
  }

  install(): void {
    if (!this.downloaded) throw new Error('nothing downloaded');
    this.d.onInstall(this.downloaded);
  }
}
