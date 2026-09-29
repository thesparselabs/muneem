/**
 * Composition root. Builds services + IPC handlers from explicit dependencies so tests can wire
 * an in-memory SQLite, a memory secret store and a fake fetch without touching Electron.
 */
import { readSyncStatus, type Db } from '@muneem/db-sqlite';
import { CloudClient } from './infra/cloudClient.js';
import { Connectivity } from './infra/connectivity.js';
import { EventBus } from './infra/events.js';
import type { Loggers } from './infra/logger.js';
import { SECRET_KEYS, type SecretStore } from './infra/secrets.js';
import { createGateway, type Handlers } from './ipc/gateway.js';
import { Rbac } from './rbac.js';
import { AuthService } from './services/auth.js';
import { BusinessService } from './services/business.js';
import { CatalogService } from './services/catalog.js';
import { CatalogContext } from './services/catalogContext.js';
import { PricingService } from './services/pricing.js';
import { ProductSearch } from './services/productSearch.js';
import { ProductService } from './services/products.js';
import { DeviceService } from './services/device.js';
import { DiagnosticsService } from './services/diagnostics.js';
import { SessionService } from './services/session.js';
import { SettingsService } from './services/settings.js';
import { setMeta, META_KEYS, currentSchemaVersion } from '@muneem/db-sqlite';

export interface AppConfig {
  db: () => Db;
  dbFile: string;
  backupsDir: string;
  bundlesDir: string;
  secrets: SecretStore;
  loggers: Loggers;
  apiBaseUrl: string;
  appVersion: string;
  platform: string;
  fetchImpl?: typeof fetch;
  probeIntervalMs?: number;
  isTrustedSender?: (id: number) => boolean;
  now?: () => number;
}

export function createApp(cfg: AppConfig) {
  const events = new EventBus();
  const session = new SessionService(events);
  const rbac = new Rbac(cfg.db);
  const cloudRef: { current: CloudClient | null } = { current: null }; // device ↔ cloud are mutually dependent
  const device = new DeviceService({ db: cfg.db, secrets: cfg.secrets, cloud: () => cloudRef.current!, loggers: cfg.loggers, appVersion: cfg.appVersion, schemaVersion: () => currentSchemaVersion(cfg.db()), platform: cfg.platform });
  const cloud = new CloudClient({
    baseUrl: cfg.apiBaseUrl, appVersion: cfg.appVersion, schemaVersion: currentSchemaVersion(cfg.db()),
    getDeviceId: () => device.cloudDeviceId(), getPrivateKeyPem: () => cfg.secrets.get(SECRET_KEYS.devicePrivateKey),
    getAccessToken: () => session.getAccessToken(),
    onServerTime: (iso, skew) => { try { setMeta(cfg.db(), META_KEYS.serverSkewMs, String(skew)); setMeta(cfg.db(), META_KEYS.lastServerContactAt, iso); } catch { /* db closed */ } },
    loggers: cfg.loggers, ...(cfg.fetchImpl && { fetchImpl: cfg.fetchImpl }),
  });
  cloudRef.current = cloud;
  const connectivity = new Connectivity(cloud, events, cfg.probeIntervalMs ?? 30_000);
  const auth = new AuthService({ db: cfg.db, cloud: () => cloud, secrets: cfg.secrets, session, device, loggers: cfg.loggers, isOnline: () => connectivity.online, ...(cfg.now && { now: cfg.now }) });
  const business = new BusinessService({ db: cfg.db, session, device });
  const settings = new SettingsService({ db: cfg.db, session, device });
  const catalogCtx = new CatalogContext({ db: cfg.db, session, device, ...(cfg.now && { now: cfg.now }) });
  const productSearch = new ProductSearch(catalogCtx);
  const invalidateSearch = () => productSearch.invalidate();
  const products = new ProductService(catalogCtx, productSearch);
  const catalog = new CatalogService(catalogCtx, invalidateSearch);
  const pricing = new PricingService(catalogCtx, invalidateSearch);
  const diagnostics = new DiagnosticsService({
    db: cfg.db, dbFile: cfg.dbFile, backupsDir: cfg.backupsDir, bundlesDir: cfg.bundlesDir, loggers: cfg.loggers, session, device,
    appVersion: cfg.appVersion, secretStoreAvailable: cfg.secrets.encrypted, connectivity: () => connectivity.snapshot(),
  });
  const syncStatus = () => readSyncStatus(cfg.db(), connectivity.online, connectivity.serverSkewMs);

  const handlers: Handlers = {
    'auth.register': (i) => auth.register(i),
    'auth.login': (i) => auth.login(i),
    'auth.loginOffline': (i) => auth.loginOffline(i),
    'auth.switchUser': (i) => auth.switchUser(i),
    'auth.listCachedUsers': () => auth.listCachedUsers(),
    'auth.getSession': () => session.get(),
    'auth.logout': async () => { await auth.logout(); return { ok: true as const }; },
    'auth.setPin': async (i) => { await auth.setPin(i.pin); return { ok: true as const }; },
    'auth.verifyPin': async (i) => { await auth.verifyPin(i.pin); return { ok: true as const }; },
    'device.getInfo': () => device.info(),
    'app.getConnectivity': () => connectivity.snapshot(),
    'business.get': () => business.get(),
    'business.create': (i) => business.create(i),
    'business.update': (i) => business.update(i),
    'business.getBranches': () => business.getBranches(),
    'business.createBranch': (i) => business.createBranch(i),
    'business.getTerminals': (i) => business.getTerminals(i.branchId),
    'business.createTerminal': (i) => business.createTerminal(i),
    'business.selectTerminal': (i) => business.selectTerminal(i.terminalId),
    'settings.get': (i) => settings.get(i.key),
    'settings.set': (i) => settings.set(i.key, i.value),
    'settings.listSeries': () => settings.listSeries(),
    'settings.createSeries': (i) => settings.createSeries(i),
    'products.search': (i) => products.search(i),
    'products.lookupBarcode': (i) => products.lookupBarcode(i.code),
    'products.list': (i) => products.list(i),
    'products.get': (i) => products.get(i.id),
    'products.create': (i) => products.create(i),
    'products.update': (i) => products.update(i),
    'products.deactivate': (i) => products.setActive(i.id, i.version, false),
    'products.reactivate': (i) => products.setActive(i.id, i.version, true),
    'catalog.listUoms': () => catalog.listUoms(),
    'catalog.createUom': (i) => catalog.createUom(i),
    'catalog.listCategories': () => catalog.listCategories(),
    'catalog.createCategory': (i) => catalog.createCategory(i),
    'catalog.updateCategory': (i) => catalog.updateCategory(i),
    'catalog.listBrands': () => catalog.listBrands(),
    'catalog.createBrand': (i) => catalog.createBrand(i),
    'catalog.updateBrand': (i) => catalog.updateBrand(i),
    'pricing.listLists': () => pricing.listLists(),
    'pricing.createList': (i) => pricing.createList(i),
    'pricing.getItems': (i) => pricing.getItems(i),
    'pricing.setItems': (i) => pricing.setItems(i),
    'sync.getStatus': () => syncStatus(),
    'diagnostics.getHealth': () => diagnostics.getHealth(),
    'diagnostics.integrityCheck': () => diagnostics.integrityCheck(),
    'diagnostics.backupNow': () => diagnostics.backupNow('manual'),
    'diagnostics.exportSupportBundle': () => diagnostics.exportSupportBundle(),
    'diagnostics.getLogsTail': (i) => diagnostics.getLogsTail(i.log, i.lines),
  };

  const gateway = createGateway({
    handlers, session, rbac, db: cfg.db, deviceId: () => device.localDeviceId(), loggers: cfg.loggers, events,
    connectivity: () => connectivity.snapshot(), isTrustedSender: cfg.isTrustedSender ?? (() => true), ...(cfg.now && { now: cfg.now }),
  });

  return { events, session, rbac, cloud, connectivity, device, auth, business, settings, products, catalog, pricing, diagnostics, gateway, handlers, syncStatus };
}
export type App = ReturnType<typeof createApp>;
