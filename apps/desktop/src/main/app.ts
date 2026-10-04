/**
 * Composition root. Builds services + IPC handlers from explicit dependencies so tests can wire
 * an in-memory SQLite, a memory secret store and a fake fetch without touching Electron.
 */
import { backupHealth, defaultWarehouseId, listAllLowStock, listStock, listWarehouses, nativeBindingOf, openDatabase, openReviewCounts, partyDues, productMovements, readSyncStatus, rebuildStockLevels, stockValuation, type Db } from '@muneem/db-sqlite';
import { CloudClient } from './infra/cloudClient.js';
import { Connectivity } from './infra/connectivity.js';
import { EventBus } from './infra/events.js';
import type { Loggers } from './infra/logger.js';
import { SECRET_KEYS, type SecretStore } from './infra/secrets.js';
import { createGateway, DEVICE_AUDIT_SCOPE, type Handlers } from './ipc/gateway.js';
import { createBackups, type BackupTransport, type RestoreHost } from './backups/index.js';
import { HttpBackupTransport } from './backups/httpBackupTransport.js';
import { swapHost } from './backups/recovery.js';
import { isBackupTransport } from './backups/transport.js';
import { Rbac } from './rbac.js';
import { AuthService } from './services/auth.js';
import { BusinessService } from './services/business.js';
import { CatalogService } from './services/catalog.js';
import { CatalogContext } from './services/catalogContext.js';
import { ImportService } from './services/import/importService.js';
import { PrintQueue } from './services/print/printQueue.js';
import { PrinterConfigStore } from './services/print/printerConfig.js';
import type { LineRasteriser } from './services/print/raster.js';
import type { SpoolerTransport } from './services/print/spooler.js';
import { PreviewStore } from './services/import/previewStore.js';
import { PricingService } from './services/pricing.js';
import { CustomerService } from './services/pos/customers.js';
import { PartyLedgerService } from './services/parties/partyLedger.js';
import { SupplierService } from './services/parties/suppliers.js';
import { PurchaseImportService } from './services/purchases/purchaseImport.js';
import { Drawer } from './services/payments/drawer.js';
import { PaymentService } from './services/payments/paymentService.js';
import { SettlementAllocator } from './services/payments/settlementAllocator.js';
import { WriteOffService } from './services/payments/writeOffs.js';
import { ExpenseService } from './services/expenses/expenseService.js';
import { JournalBacklog } from './services/accounting/backlog.js';
import { PeriodService } from './services/accounting/periods.js';
import { YearEndService } from './services/accounting/yearEnd.js';
import { ChartService } from './services/accounting/chart.js';
import { ManualJournalService } from './services/accounting/manualJournals.js';
import { GstContext } from './services/gst/gstContext.js';
import { GstPaymentService } from './services/gst/paymentService.js';
import { GstReturnService } from './services/gst/returnService.js';
import { GstSetoffService } from './services/gst/setoffService.js';
import { StatementService } from './services/accounting/statements.js';
import { PurchasePricing } from './services/purchases/purchasePricing.js';
import { PurchaseReturnService } from './services/purchases/purchaseReturns.js';
import { PurchaseService } from './services/purchases/purchases.js';
import { InventoryService } from './services/inventory/inventoryService.js';
import { OpeningImportService } from './services/inventory/openingImport.js';
import { HeldBillService } from './services/pos/heldBills.js';
import { PosContext } from './services/pos/posContext.js';
import { RegisterService } from './services/pos/register.js';
import { SalePricing } from './services/pos/salePricing.js';
import { SaleService } from './services/pos/sales.js';
import { ReturnService } from './services/returns/returnService.js';
import { ProductSearch } from './services/productSearch.js';
import { ProductService } from './services/products.js';
import { DeviceService } from './services/device.js';
import { DiagnosticsService } from './services/diagnostics.js';
import { SessionService } from './services/session.js';
import { SettingsService } from './services/settings.js';
import { setMeta, META_KEYS, currentSchemaVersion } from '@muneem/db-sqlite';
import { HttpTransport } from './sync/httpTransport.js';
import { SyncEngine } from './sync/syncEngine.js';
import { SyncScheduler } from './sync/scheduler.js';
import { syncScreenHandlers } from './sync/screens.js';
import { isBundleFetcher, type BundleFetcher, type Credentials, type Transport } from './sync/transport.js';
import { HttpBundleDownloader } from './sync/bundleDownloader.js';
import { HydrationGate, type ColdStart } from './sync/hydration/hydrationGate.js';
import { HydrationService } from './sync/hydration/hydrationService.js';
import { Hydrator } from './sync/hydration/hydrator.js';
import { dirname, join } from 'node:path';

import { ReportCatalogue } from './reports/catalogue.js';
import { REPORTS } from './reports/definitions/index.js';
import { CsvWriter } from './reports/exports/csv.js';
import { PdfWriter, type PdfRenderer } from './reports/exports/pdf.js';
import { XlsxWriter } from './reports/exports/xlsx.js';
import { ReportService, type SaveFile } from './reports/service.js';
import { DashboardService } from './reports/dashboard.js';
import { InlineReads, type BackgroundReads } from './background/backgroundReads.js';
import { createUpdates } from './update/index.js';
import { DEFAULT_UPDATE_BASE_URL } from './update/channels.js';
import type { Updater } from './update/updater.js';
import { createNotifications } from './notifications/index.js';
import { CustomerPrivacyService } from './services/parties/customerPrivacy.js';
import { createTelemetry } from './telemetry/index.js';
import type { CrashSend } from './telemetry/crashReports.js';
import type { SyncStatus, UpdateStatus } from '@muneem/contracts';
export interface AppConfig {
  db: () => Db;
  dbFile: string;
  receiptsDir: string;
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
  syncTransport?: (credentials: () => Credentials | null) => Transport;
  random?: () => number;
  coldStart?: ColdStart;
  hydrationDir?: string;
  bundleFetcher?: BundleFetcher;
  sleep?: (ms: number) => Promise<void>;
  saveFile?: SaveFile;
  pdfRenderer?: PdfRenderer;
  backupTransport?: (credentials: () => Credentials | null) => BackupTransport;
  restoreHost?: RestoreHost;
  updater?: Updater | null;
  updateBaseUrl?: string;
  registerIdleMs?: number;
  printSpooler?: SpoolerTransport;
  lineRasteriser?: LineRasteriser;
  // ADR-0053: the crash collector's DSN (null: never send); crashSend replaces the HTTP sender in tests.
  crashDsn?: string | null;
  crashSend?: CrashSend;
  isDev?: boolean;
  // ADR-0058: where reports and integrity checks run; by default on the read-only connection in this thread.
  backgroundReads?: BackgroundReads;
}

// The main connection checked the file at start-up; a second quick_check here would read the whole database again.
function openReadOnly(file: string, main: Db): Db {
  const nativeBinding = nativeBindingOf(main);
  return openDatabase(file, { readonly: true, quickCheck: false, ...(nativeBinding && { nativeBinding }) });
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
  const posCtx = new PosContext(catalogCtx, session, rbac);
  const customers = new CustomerService(posCtx);
  const suppliers = new SupplierService(posCtx);
  const customerLedger = new PartyLedgerService(posCtx, 'customer', (id) => customers.get(id));
  const supplierLedger = new PartyLedgerService(posCtx, 'supplier', (id) => suppliers.get(id));
  const purchases = new PurchaseService(posCtx, new PurchasePricing(posCtx));
  const purchaseReturns = new PurchaseReturnService(posCtx);
  const purchaseImport = new PurchaseImportService(posCtx, new PreviewStore(cfg.now ?? (() => Date.now())));
  const allocator = new SettlementAllocator(posCtx);
  const drawer = new Drawer(posCtx);
  const payments = new PaymentService(posCtx, allocator, drawer);
  const writeOffs = new WriteOffService(posCtx, allocator);
  const expenses = new ExpenseService(posCtx, drawer);
  const periods = new PeriodService(posCtx);
  const yearEnd = new YearEndService(posCtx);
  const backlog = new JournalBacklog(posCtx);
  const statements = new StatementService(posCtx);
  let readDb: Db | null = null;
  const reportDb = () => (cfg.dbFile === ':memory:' ? cfg.db() : (readDb ??= openReadOnly(cfg.dbFile, cfg.db())));
  const reads = cfg.backgroundReads ?? new InlineReads(reportDb);
  const closeReadConnections = () => { readDb?.close(); readDb = null; void reads.close(); };
  const reports = new ReportService({
    catalogue: new ReportCatalogue(REPORTS),
    reads,
    businessId: () => posCtx.businessId(), today: () => posCtx.today(), can: (p) => posCtx.can(p),
    business: () => { const b = business.get(); return { name: b?.name ?? '', gstin: b?.gstin ?? null }; },
    writers: [new CsvWriter(), new XlsxWriter(), ...(cfg.pdfRenderer ? [new PdfWriter(cfg.pdfRenderer)] : [])],
    saveFile: cfg.saveFile ?? ((fileName) => Promise.resolve({ saved: false, fileName })),
  });
  const chart = new ChartService(posCtx, statements);
  const dashboard = new DashboardService({ readDb: reportDb, businessId: () => posCtx.businessId(), today: () => posCtx.today(), lowStock: () => listStock(cfg.db(), posCtx.businessId(), inventory.warehouseId(), { lowOnly: true, limit: 50 }).items });
  const manualJournals = new ManualJournalService(posCtx);
  const gstCtx = new GstContext(posCtx);
  const gst = { returns: new GstReturnService(gstCtx), setoffs: new GstSetoffService(gstCtx), payments: new GstPaymentService(gstCtx) };
  const register = new RegisterService(posCtx);
  const heldBills = new HeldBillService(posCtx, register);
  const inventory = new InventoryService(posCtx);
  const openingImport = new OpeningImportService(posCtx, inventory, new PreviewStore(cfg.now ?? (() => Date.now())));
  const printerConfig = new PrinterConfigStore(cfg.db);
  const printQueue = new PrintQueue({
    db: cfg.db, config: printerConfig, receiptsDir: cfg.receiptsDir, log: cfg.loggers.hardware,
    ...(cfg.printSpooler && { spooler: cfg.printSpooler }), ...(cfg.lineRasteriser && { rasteriser: cfg.lineRasteriser }),
  });
  const sales = new SaleService(posCtx, new SalePricing(posCtx), register, () => session.require().user.name, (r) => printQueue.enqueue(r.printJobId));
  const returns = new ReturnService(posCtx, () => session.require().user.name, (r) => printQueue.enqueue(r.printJobId));
  const productImport = new ImportService(catalogCtx, new PreviewStore(cfg.now ?? (() => Date.now())), invalidateSearch);
  const diagnostics = new DiagnosticsService({
    db: cfg.db, reads, dbFile: cfg.dbFile, bundlesDir: cfg.bundlesDir, loggers: cfg.loggers, session, device,
    appVersion: cfg.appVersion, secretStoreAvailable: cfg.secrets.encrypted, connectivity: () => connectivity.snapshot(),
  });
  const telemetry = createTelemetry({
    db: cfg.db, businessId: () => session.get()?.businessId ?? null, installationId: () => device.installationId(), appVersion: cfg.appVersion,
    platform: cfg.platform, dsn: cfg.crashDsn ?? null, isDev: cfg.isDev ?? false, log: cfg.loggers.app,
    ...(cfg.fetchImpl && { fetchImpl: cfg.fetchImpl }), ...(cfg.crashSend && { send: cfg.crashSend }), ...(cfg.now && { now: cfg.now }),
  });
  const syncStatus = () => readSyncStatus(cfg.db(), connectivity.online, connectivity.serverSkewMs);
  const credentials = (): Credentials | null => {
    const deviceId = device.cloudDeviceId();
    const privateKeyPem = device.privateKeyPem();
    return deviceId && privateKeyPem ? { deviceId, privateKeyPem, accessToken: session.getAccessToken() } : null;
  };
  const syncTransport = cfg.syncTransport?.(credentials) ?? new HttpTransport({
    baseUrl: cfg.apiBaseUrl, appVersion: cfg.appVersion, schemaVersion: currentSchemaVersion(cfg.db()), credentials, ...(cfg.fetchImpl && { fetchImpl: cfg.fetchImpl }),
  });
  const bundleFetcher = cfg.bundleFetcher ?? (isBundleFetcher(syncTransport) ? syncTransport : new HttpBundleDownloader(cfg.fetchImpl));
  const backupTransport = cfg.backupTransport?.(credentials) ?? (isBackupTransport(syncTransport) ? syncTransport : new HttpBackupTransport({
    baseUrl: cfg.apiBaseUrl, appVersion: cfg.appVersion, schemaVersion: currentSchemaVersion(cfg.db()), credentials, ...(cfg.fetchImpl && { fetchImpl: cfg.fetchImpl }),
  }, cfg.fetchImpl));
  const backups = createBackups({
    db: cfg.db, dir: cfg.backupsDir, secrets: cfg.secrets, device, session, transport: () => backupTransport, fetcher: bundleFetcher,
    host: cfg.restoreHost ?? swapHost(() => { closeReadConnections(); cfg.db().close(); }, cfg.dbFile),
    appVersion: cfg.appVersion, now: cfg.now ?? (() => Date.now()), sleep: cfg.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    loggers: cfg.loggers, auditScope: DEVICE_AUDIT_SCOPE,
  });
  const updates = createUpdates({
    db: cfg.db, updater: cfg.updater ?? null, baseUrl: cfg.updateBaseUrl ?? DEFAULT_UPDATE_BASE_URL, appVersion: cfg.appVersion, installationId: () => device.installationId(),
    registerOpen: () => { try { return register.current() !== null; } catch { return false; } },
    emit: (status) => { events.emit('update.status', status); announceUpdate(status); }, now: cfg.now ?? (() => Date.now()), log: cfg.loggers.app,
    ...(cfg.registerIdleMs !== undefined && { registerIdleMs: cfg.registerIdleMs }),
  });
  const gate = new HydrationGate(cfg.db, cfg.coldStart ?? 'hydrate');
  const syncEngine = new SyncEngine({
    db: cfg.db, transport: syncTransport, device, businessId: () => session.get()?.businessId ?? null, schemaVersion: () => currentSchemaVersion(cfg.db()),
    refreshAuth: () => auth.refreshAccessToken(), now: cfg.now ?? (() => Date.now()), random: cfg.random ?? Math.random, log: cfg.loggers.sync,
    onStatus: () => events.emit('sync.status', syncStatus()), onApplied: () => productSearch.invalidate(), holds: (id) => gate.holds(id),
  });
  const sync = new SyncScheduler(syncEngine, { now: cfg.now ?? (() => Date.now()), onError: (e) => cfg.loggers.sync.error({ err: String(e) }, 'sync run failed') });
  const hydrator = new Hydrator({
    db: cfg.db, transport: syncTransport, fetcher: bundleFetcher,
    dir: cfg.hydrationDir ?? join(dirname(cfg.bundlesDir), 'hydration'), refreshAuth: () => auth.refreshAccessToken(), now: cfg.now ?? (() => Date.now()),
    sleep: cfg.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))), log: cfg.loggers.sync,
    onProgress: (h, linesTotal) => hydration.progress(h, linesTotal),
  });
  const hydration: HydrationService = new HydrationService({
    db: cfg.db, session, gate, runner: hydrator, cloudDeviceId: () => device.cloudDeviceId(),
    listCloudBusinesses: async () => (await cloud.request<{ id: string; name: string; state_code?: string | null }[]>('GET', '/businesses')).data,
    emit: (status) => events.emit('sync.hydration', status), afterReady: () => sync.pullNow(), log: cfg.loggers.sync,
  });
  events.attach({
    send: (channel, payload) => {
      if (channel === 'connectivity.changed' && (payload as { online?: boolean }).online) sync.online();
      if (channel === 'session.changed' && (payload as { businessId?: string | null } | null)?.businessId) sync.online();
      if (channel === 'session.changed') updates.activity.clearCart();
    },
  });
  const openBusiness = () => { const id = session.get()?.businessId ?? null; return id && !gate.holds(id) ? id : null; };
  const notifications = createNotifications({
    db: cfg.db, businessId: openBusiness, now: cfg.now ?? (() => Date.now()), emit: (n) => events.emit('notification.new', n),
    can: (p) => { const s = session.get(); return !!s && rbac.has(s, p) !== null; },
    log: (err, kind) => cfg.loggers.app.error({ err: String(err), kind }, 'notification check failed'),
    sources: {
      today: () => posCtx.today(), now: cfg.now ?? (() => Date.now()), syncStatus, backupHealth: () => backupHealth(cfg.db()),
      // Read-only: a check must not create the branch's warehouse; before it exists every product simply has none.
      lowStock: () => listAllLowStock(cfg.db(), posCtx.businessId(), defaultWarehouseId(cfg.db(), session.require().branchId ?? '') ?? ''),
      dues: (partyType, dueBefore) => partyDues(cfg.db(), posCtx.businessId(), partyType, dueBefore),
      businessCreatedAt: () => business.get()?.createdAt ?? null,
      reviewCounts: () => openReviewCounts(cfg.db(), posCtx.businessId()),
    },
  });  // ADR-0050: the updater's ready state is a notification for everyone; a later status resolves it.
  function announceUpdate(status: UpdateStatus): void {
    const release = status.availableVersion;
    if (status.state === 'ready' && release) {
      notifications.service.notify('update_ready', {
        severity: 'info', entityType: 'release', entityId: release, title: `Update ${release} is ready`,
        body: 'It installs when the register is closed, or from Settings → Updates.', link: '/settings/updates',
      });
    }
  }

  // ADR-0050: detectors run when a business opens and when sync's health changes; the 6-hourly timer runs them all.
  events.attach({
    send: (channel, payload) => {
      if (channel === 'session.changed' && openBusiness()) notifications.runner.run();
      if (channel === 'sync.status') notifications.runner.onSyncStatus(payload as SyncStatus);
    },
  });
  const customerPrivacy = new CustomerPrivacyService(posCtx, customers, () => business.get()?.name ?? '',
    cfg.saveFile ?? ((fileName) => Promise.resolve({ saved: false, fileName })), cfg.now ?? (() => Date.now()));

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
    'products.importPreview': (i) => productImport.preview(i),
    'products.importCommit': (i) => productImport.commit(i),
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
    'customers.search': (i) => customers.search(i.query, i.limit),
    'customers.get': (i) => customers.get(i.id),
    'customers.create': (i) => customers.create(i),
    'customers.update': (i) => customers.update(i),
    'customers.setCreditLimit': (i) => customers.setCreditLimit(i),
    'customers.setOpening': (i) => customerLedger.setOpening(i),
    'customers.getLedger': (i) => customerLedger.ledger(i),
    'customers.getOutstanding': (i) => customerLedger.outstanding(i),
    'customers.setConsent': (i) => customerPrivacy.setConsent(i),
    'customers.withdrawConsent': (i) => customerPrivacy.withdrawConsent(i),
    'customers.exportProfile': (i) => customerPrivacy.exportProfile(i),
    'customers.erase': (i) => customerPrivacy.erase(i),
    'suppliers.search': (i) => suppliers.search(i.query, i.limit),
    'suppliers.get': (i) => suppliers.get(i.id),
    'suppliers.create': (i) => suppliers.create(i),
    'suppliers.update': (i) => suppliers.update(i),
    'suppliers.setOpening': (i) => supplierLedger.setOpening(i),
    'suppliers.getLedger': (i) => supplierLedger.ledger(i),
    'suppliers.getOutstanding': (i) => supplierLedger.outstanding(i),
    'purchases.quote': (i) => purchases.quote(i),
    'purchases.create': (i) => purchases.create(i),
    'purchases.get': (i) => purchases.get(i.id),
    'purchases.list': (i) => purchases.list(i),
    'purchases.return': (i) => purchaseReturns.returnGoods(i),
    'purchases.cancel': (i) => purchaseReturns.cancel(i.id, i.reason),
    'purchases.importLinesPreview': (i) => purchaseImport.preview(i),
    'payments.create': (i) => payments.create(i),
    'payments.get': (i) => payments.get(i.id),
    'payments.list': (i) => payments.list(i),
    'payments.openItems': (i) => payments.openItems(i.partyType, i.partyId),
    'payments.allocate': (i) => payments.allocate(i),
    'payments.cancel': (i) => payments.cancel(i.id, i.reason),
    'payments.writeOff': (i) => writeOffs.create(i),
    'expenses.listCategories': () => expenses.categories(),
    'expenses.create': (i) => expenses.create(i),
    'expenses.get': (i) => expenses.get(i.id),
    'expenses.list': (i) => expenses.list(i),
    'expenses.cancel': (i) => expenses.cancel(i.id, i.reason),
    'accounting.listAccounts': (i) => statements.accounts(i.asOf),
    'accounting.createAccount': (i) => chart.create(i),
    'accounting.updateAccount': (i) => chart.rename(i.id, i.name),
    'accounting.getTrialBalance': (i) => statements.trialBalance(i),
    'accounting.getProfitAndLoss': (i) => statements.profitAndLoss(i),
    'accounting.getBalanceSheet': (i) => statements.balanceSheet(i),
    'accounting.getLedger': (i) => statements.ledger(i),
    'accounting.getCashBook': (i) => statements.book('cash', i),
    'accounting.getBankBook': (i) => statements.book('bank', i),
    'accounting.getDayBook': (i) => statements.dayBook(i),
    'accounting.postManualJournal': (i) => manualJournals.post(i),
    'accounting.reverseJournal': (i) => manualJournals.reverse(i.id, i.reason, i.date),
    'accounting.getPeriods': () => periods.list(),
    'accounting.lockPeriod': (i) => periods.lock(i.periodStart),
    'accounting.unlockPeriod': (i) => periods.unlock(i.periodStart, i.reason),
    'accounting.listLatePostings': () => periods.latePostings(),
    'accounting.getYearEnd': () => yearEnd.list(),
    'accounting.closeYear': (i) => yearEnd.close(i.fy),
    'accounting.recloseYear': (i) => yearEnd.reclose(i.fy),
    'accounting.postBacklog': () => backlog.run(),
    'accounting.rebuildBalances': () => ({ rebuilt: backlog.rebuildBalances() }),
    'pos.getSession': () => register.current(),
    'pos.openRegister': (i) => register.open(i.openingCashPaise),
    'pos.cashMovement': (i) => { register.cashMovement(i); return { ok: true as const }; },
    'pos.xReport': () => register.xReport(),
    'pos.zReport': (i) => register.zReport(i.sessionId),
    'pos.closeRegister': (i) => {
      const report = register.close(i);
      backups.scheduler.afterRegisterClose();
      return report;
    },
    'pos.holdBill': (i) => heldBills.hold(i.label, i.cart),
    'pos.listHeldBills': () => heldBills.list(),
    'pos.getHeldBill': (i) => heldBills.get(i.id),
    'pos.discardBill': (i) => { heldBills.take(i.id); return { ok: true as const }; },
    'sales.quote': (i) => sales.quote(i),
    'sales.complete': (i) => sales.complete(i),
    'sales.get': (i) => sales.get(i.id),
    'sales.list': (i) => sales.list(i),
    'sales.getReceipt': (i) => sales.receipt(i.saleId),
    'sales.cancel': (i) => returns.cancel(i),
    'returns.quote': (i) => returns.quote(i),
    'returns.complete': (i) => returns.complete(i),
    'returns.get': (i) => returns.get(i.id),
    'returns.list': (i) => returns.list(i),
    'returns.getReceipt': (i) => returns.receipt(i.creditNoteId),
    'returns.reprint': (i) => { returns.get(i.creditNoteId); return { jobId: printQueue.reprint(i.creditNoteId, posCtx.userId()) }; },
    'printer.getConfig': () => printerConfig.get(),
    'printer.setConfig': (i) => printerConfig.set(i),
    'printer.listInstalled': () => printQueue.installedPrinters(),
    'printer.testPrint': async () => { await printQueue.testPrint(); return { ok: true as const }; },
    'printer.getQueue': (i) => printQueue.list(posCtx.businessId(), i.limit),
    'printer.retryJob': (i) => { printQueue.retry(i.jobId, posCtx.businessId()); return { ok: true as const }; },
    'printer.reprint': (i) => { sales.get(i.saleId); return { jobId: printQueue.reprint(i.saleId, posCtx.userId()) }; },
    'drawer.open': async () => { await printQueue.openDrawer(); return { ok: true as const }; },
    'inventory.getStock': (i) => listStock(cfg.db(), posCtx.businessId(), inventory.warehouseId(), i),
    'inventory.getMovements': (i) => productMovements(cfg.db(), posCtx.businessId(), i.productId, i),
    'inventory.valuation': () => stockValuation(cfg.db(), posCtx.businessId()),
    'inventory.listLowStock': () => listStock(cfg.db(), posCtx.businessId(), inventory.warehouseId(), { lowOnly: true, limit: 50 }).items,
    'inventory.rebuildProjections': () => ({ rebuilt: rebuildStockLevels(cfg.db(), posCtx.businessId()) }),
    'inventory.listWarehouses': () => { inventory.warehouseId(); return listWarehouses(cfg.db(), posCtx.businessId()); },
    'inventory.setOpeningStock': (i) => inventory.setOpeningStock(i),
    'inventory.adjust': (i) => inventory.adjust(i),
    'inventory.stockTake': (i) => inventory.stockTake(i),
    'inventory.importOpeningPreview': (i) => openingImport.preview(i),
    'inventory.importOpeningCommit': (i) => openingImport.commit(i.importId, i.commandId),
    'reports.listDefinitions': () => reports.list(),
    'reports.run': (i) => reports.run(i.id, i.params),
    'reports.export': (i) => reports.export(i.id, i.params, i.format),
    'gst.returnSummary': (i) => gst.returns.summary(i.month),
    'gst.previewSetoff': (i) => gst.setoffs.preview(i.month),
    'gst.postSetoff': (i) => gst.setoffs.post(i),
    'gst.recordPayment': (i) => gst.payments.record(i),
    'gst.ledger': () => gst.payments.ledger(),
    'reports.dashboard': () => dashboard.get(),
    'sync.getStatus': () => syncStatus(),
    'sync.retry': () => { void sync.retry(); return syncStatus(); },
    ...syncScreenHandlers({
      db: cfg.db, businessId: () => posCtx.businessId(), userId: () => posCtx.userId(), localDeviceId: () => device.localDeviceId(), onResent: () => { void sync.retry(); },
    }),
    'sync.listCloudBusinesses': () => hydration.listCloudBusinesses(),
    'sync.hydrationStart': (i) => hydration.start(i.businessId),
    'sync.hydrationStatus': () => hydration.status(),
    'diagnostics.getHealth': () => diagnostics.getHealth(),
    'diagnostics.integrityCheck': () => diagnostics.integrityCheck(),
    'diagnostics.verifyAudit': () => diagnostics.verifyAudit(),
    'diagnostics.exportSupportBundle': () => diagnostics.exportSupportBundle(),
    'diagnostics.getLogsTail': (i) => diagnostics.getLogsTail(i.log, i.lines),
    ...backups.handlers,
    ...telemetry.handlers,
    ...updates.handlers,
    ...notifications.handlers,
  };

  printQueue.resumeUnfinished(catalogCtx.today());

  const gateway = createGateway({
    handlers, session, rbac, db: cfg.db, deviceId: () => device.localDeviceId(), loggers: cfg.loggers, events,
    connectivity: () => connectivity.snapshot(), isTrustedSender: cfg.isTrustedSender ?? (() => true), ...(cfg.now && { now: cfg.now }),
    onCommitted: (channel) => { sync.nudge(); notifications.runner.afterCommit(channel); }, holds: (id) => gate.holds(id), onDispatch: (channel) => updates.activity.dispatch(channel),
  });

  return { events, session, reports, dashboard, rbac, cloud, connectivity, device, auth, business, settings, products, catalog, pricing, productImport, customers, suppliers, customerLedger, supplierLedger, purchases, purchaseReturns, purchaseImport, payments, writeOffs, expenses, periods, yearEnd, backlog, statements, chart, manualJournals, gst, register, sales, returns, printQueue, inventory, openingImport, diagnostics, backups, closeReadConnections, gateway, handlers, syncStatus, syncEngine, sync, hydration, hydrationGate: gate, updates, notifications, customerPrivacy, telemetry };
}
export type App = ReturnType<typeof createApp>;
