import electronUpdater, { type ProgressInfo } from 'electron-updater';
import type { Loggers } from '../infra/logger.js';
import type { DownloadProgress, UpdateManifest, Updater } from './updater.js';

/**
 * electron-updater over the generic provider. Integrity: the installer's sha512 from latest.yml is always checked;
 * on Windows the installer's Authenticode signature must also match the publisher the running build was signed by.
 * Resuming: a finished download is cached and reused across restarts; with a blockmap only changed blocks are fetched,
 * but an interrupted transfer starts that download again.
 */
export function electronUpdaterAdapter(log: Loggers['app']): Updater {
  const { autoUpdater } = electronUpdater;
  autoUpdater.logger = { info: (m: unknown) => log.info({ updater: m }), warn: (m: unknown) => log.warn({ updater: m }), error: (m: unknown) => log.error({ updater: m }), debug: () => undefined };
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  // The cohort is decided by UpdateService from the installation id, not electron-updater's random staging id.
  autoUpdater.isUserWithinRollout = () => true;
  return {
    setFeed: (url) => autoUpdater.setFeedURL({ provider: 'generic', url }),
    async check(): Promise<UpdateManifest | null> {
      const r = await autoUpdater.checkForUpdates();
      if (!r?.isUpdateAvailable) return null;
      const info = r.updateInfo;
      return { version: info.version, releaseDate: info.releaseDate ?? null, stagingPercentage: info.stagingPercentage ?? null };
    },
    async download(onProgress: (p: DownloadProgress) => void): Promise<void> {
      const listener = (p: ProgressInfo) => onProgress({ percent: p.percent, transferred: p.transferred, total: p.total });
      autoUpdater.on('download-progress', listener);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.off('download-progress', listener);
      }
    },
    install: () => autoUpdater.quitAndInstall(false, true),
  };
}
