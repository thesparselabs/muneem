import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, type App } from './app.js';
import { dbPaths, DbCorruptError, openAndMigrate } from './infra/db.js';
import { latestBackupFile, restoreBackupFile } from './backups/recovery.js';
import { createLoggers } from './infra/logger.js';
import { createElectronSecretStore } from './infra/secrets.js';
import { electronHtmlToPdf, electronSaveFile } from './infra/files.js';
import { registerIpc } from './ipc/gateway.js';
import { currentSchemaVersion, restoreDatabaseFile, type Db } from '@muneem/db-sqlite';
import { rmSync } from 'node:fs';
import { startSyncWorker } from './sync/syncWorker.js';

app.setName('Muneem'); // userData → %APPDATA%/Muneem (before 'ready')
const isDev = !app.isPackaged;
const here = fileURLToPath(new URL('.', import.meta.url));
const PRELOAD = join(here, '../preload/index.cjs');
const RENDERER_INDEX = join(here, '../renderer/index.html');
const SYNC_WORKER = join(here, 'sync-worker.js');
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
// Vite's dev server injects an inline React Refresh preamble and talks to its HMR websocket; packaged builds never use this.
const DEV_SERVER_CSP = CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("connect-src 'self'", "connect-src 'self' ws://localhost:*");

if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow: BrowserWindow | null = null;
let muneem: App | null = null;
let db: Db | null = null;
let stopSyncWorker: (() => void) | null = null;

function nativeBindingPath(): string | undefined {
  // Electron-ABI build of better-sqlite3 produced by scripts/build-native.ts (dev) / bundled under native/ (packaged).
  const candidates = [join(here, '../../native/better_sqlite3.node'), join(process.resourcesPath ?? '', 'app.asar.unpacked', 'native', 'better_sqlite3.node')];
  return candidates.find((p) => existsSync(p));
}

async function boot(): Promise<void> {
  const userData = app.getPath('userData');
  const loggers = createLoggers(join(userData, 'logs'), isDev ? 'debug' : 'info');
  loggers.app.info({ version: app.getVersion(), electron: process.versions.electron, userData }, 'boot');
  const paths = dbPaths(userData);
  const secrets = createElectronSecretStore(join(userData, 'secrets.bin'), safeStorage, isDev, (m) => loggers.app.warn(m));
  try {
    ({ db } = await openAndMigrate(paths, loggers, nativeBindingPath()));
  } catch (e) {
    if (e instanceof DbCorruptError) {
      loggers.app.error({ detail: e.detail }, 'DB_CORRUPT on open');
      const backup = latestBackupFile(paths.backups);
      const { response } = await dialog.showMessageBox({
        type: 'error', title: 'Muneem — database problem', buttons: backup ? ['Restore latest backup', 'Quit'] : ['Quit'], defaultId: 0,
        message: 'The local database failed its integrity check.',
        detail: backup ? `A verified backup is available:\n${backup}\n\nRestore it? Transactions after the backup will need to be recovered from the cloud.` : 'No local backup was found. Please contact support with a support bundle.',
      });
      if (backup && response === 0) {
        try {
          await restoreBackupFile(backup, paths.file, secrets, nativeBindingPath());
          loggers.app.warn({ backup }, 'restored database from backup; restarting');
          app.relaunch();
        } catch (err) {
          loggers.app.error({ backup, err: String(err) }, 'restoring the latest backup failed');
          dialog.showErrorBox('Muneem — restore failed', `The backup could not be restored: ${String(err instanceof Error ? err.message : err)}`);
        }
      }
      app.exit(1);
      return;
    }
    throw e;
  }
  const apiBaseUrl = process.env.MUNEEM_API_URL ?? 'http://localhost:8080/v1';
  muneem = createApp({
    db: () => db!, dbFile: paths.file, receiptsDir: join(userData, 'receipts'), backupsDir: paths.backups, bundlesDir: join(userData, 'support-bundles'), secrets, loggers,
    hydrationDir: join(userData, 'hydration'),
    saveFile: electronSaveFile(() => mainWindow), pdfRenderer: electronHtmlToPdf,
    apiBaseUrl, appVersion: app.getVersion(), platform: process.platform,
    isTrustedSender: (id) => mainWindow?.webContents.id === id,
    // 8f: a restore closes everything, swaps the database file and relaunches; the IPC reply goes out first.
    restoreHost: {
      install: (restored) => {
        setTimeout(() => {
          try {
            muneem?.connectivity.stop();
            muneem?.sync.stop();
            stopSyncWorker?.();
            muneem?.closeReadConnections();
            db?.close();
            restoreDatabaseFile(restored, paths.file);
            for (const s of ['', '-wal', '-shm']) rmSync(restored + s, { force: true });
            loggers.app.warn('database restored from a backup; relaunching');
          } catch (err) {
            loggers.app.error({ err: String(err) }, 'restore swap failed; relaunching on whatever is on disk');
          }
          app.relaunch();
          app.exit(0);
        }, 250);
      },
    },
    // 7d: HTTP, gzip and signing run in a utility process; main stays the only writer of SQLite.
    syncTransport: (credentials) => {
      const worker = startSyncWorker(SYNC_WORKER, { baseUrl: apiBaseUrl, appVersion: app.getVersion(), schemaVersion: currentSchemaVersion(db!) }, credentials, loggers.sync);
      stopSyncWorker = worker.stop;
      return worker.transport;
    },
  });
  muneem.device.ensureIdentity();
  registerIpc(ipcMain, muneem.gateway);
  muneem.events.attach({ send: (ch, p) => mainWindow?.webContents.send(ch, p) });
  muneem.connectivity.start();
  muneem.sync.start();
  void muneem.hydration.resume().catch((e) => loggers.sync.error({ err: String(e) }, 'hydration resume failed'));
  // ADR-0034: each business seeds its chart and posts its backlog once per run, when a session first has it.
  muneem.events.attach({
    send: (channel, payload) => {
      const businessId = (payload as { businessId?: string | null } | null)?.businessId;
      // 7f: nothing is seeded into a business still being imported; it runs once the import is ready.
      if (channel !== 'session.changed' || !businessId || muneem?.hydrationGate.holds(businessId)) return;
      try {
        void muneem?.backlog.startForSession()
          ?.then((r) => { if (r.posted > 0 || r.remaining > 0) loggers.app.info(r, 'journal backlog posted'); })
          .catch((e) => loggers.app.error({ err: String(e) }, 'journal backlog failed'));
      } catch (e) { loggers.app.error({ err: String(e) }, 'chart of accounts seed failed'); }
    },
  });
  // HLD §12 / ADR-0047: an encrypted local backup every 6 hours (first after 10 minutes), one a day uploaded, with the checks.
  const scheduledBackup = () => void muneem?.backups.scheduler.scheduled().catch((e) => loggers.app.error({ err: String(e) }, 'scheduled backup failed'));
  const backupTimer = setInterval(() => {
    scheduledBackup();
    void muneem?.diagnostics.checkStock({ slice: true }).catch((e) => loggers.app.error({ err: String(e) }, 'scheduled stock check failed'));
    try { muneem?.diagnostics.checkParties(); } catch (e) { loggers.app.error({ err: String(e) }, 'scheduled party check failed'); }
    try { muneem?.diagnostics.checkJournals(); } catch (e) { loggers.app.error({ err: String(e) }, 'scheduled journal check failed'); }
  }, 6 * 3600_000);
  backupTimer.unref();
  setTimeout(scheduledBackup, 10 * 60_000).unref();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366, height: 768, minWidth: 1024, minHeight: 700, show: false, autoHideMenuBar: true, title: 'Muneem',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: isDev, spellcheck: false },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(www\.)?muneem\.app\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = process.env.ELECTRON_RENDERER_URL ? url.startsWith(process.env.ELECTRON_RENDERER_URL) : url.startsWith('file://');
    if (!allowed) e.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  if (isDev && process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void mainWindow.loadFile(RENDERER_INDEX);
}

app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
});

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const policy = isDev && process.env.ELECTRON_RENDERER_URL ? DEV_SERVER_CSP : CSP;
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } });
  });
  await boot();
  if (muneem) createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((e) => {
  dialog.showErrorBox('Muneem failed to start', String(e instanceof Error ? e.message : e));
  app.exit(1);
});

app.on('window-all-closed', () => { app.quit(); });
app.on('before-quit', () => {
  muneem?.connectivity.stop();
  muneem?.sync.stop();
  stopSyncWorker?.();
  try { db?.close(); } catch { /* already closed */ }
});
