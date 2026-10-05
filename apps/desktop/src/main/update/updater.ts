// What a channel's latest.yml offers, as the updater read it.
export interface UpdateManifest { version: string; releaseDate: string | null; stagingPercentage: number | null }
export interface DownloadProgress { percent: number; transferred: number; total: number }

// The update mechanism (electron-updater in the app, a folder feed in tests and dev); rollout and gating live above it.
export interface Updater {
  setFeed(feedUrl: string): void;
  // The newest release on the feed when it is newer than this build, else null.
  check(): Promise<UpdateManifest | null>;
  // Downloads and verifies the release check() returned (sha512 from the manifest; Authenticode on Windows).
  download(onProgress: (p: DownloadProgress) => void): Promise<void>;
  // Quits and runs the downloaded installer, which relaunches the app.
  install(): void;
}
