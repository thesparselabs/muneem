import { z } from 'zod';
import type { Permission } from './permissions.js';
import {
  AuditVerification, Branch, BranchInput, Business, BusinessInput, DeviceInfo, DocSeries, Health, Identifier, Pin, Session,
  SessionUser, SyncStatus, Terminal, TerminalInput, Ulid,
} from './schemas.js';
import {
  Brand, BrandInput, Category, CategoryInput, ImportCommitInput, ImportPreview, ImportPreviewInput, ImportSummary, PriceList, PriceListInput, PriceListItem, PriceItemsQuery, Product, ProductHit,
  ProductInput, ProductListInput, ProductPage, ProductSearchInput, ProductUpdate, SetPriceItems, Uom, UomInput,
} from './catalog.js';
import {
  CashMovementInput, CloseRegisterInput, Customer, CustomerInput, CustomerSearchInput, OpenRegisterInput, RegisterReport, RegisterSession,
} from './pos.js';
import {
  EraseCustomerInput, ExportProfileInput, ExportProfileResult, LedgerInput, LedgerPage, OpeningBalanceInput, Outstanding, OutstandingInput, PartyOpening,
  SetConsentInput, SetCreditLimitInput, Supplier, SupplierInput, SupplierSearchInput, WithdrawConsentInput,
} from './parties.js';
import { ListNotificationsInput, NotificationChanged, NotificationCounts, NotificationIdsInput, NotificationPage } from './notifications.js';
import {
  CancelPurchaseInput, CreatePurchaseInput, DebitNote, Purchase, PurchaseDraft, PurchaseImportPreview, PurchaseImportPreviewInput, PurchaseListInput,
  PurchasePage, PurchaseQuote, ReturnPurchaseInput,
} from './purchases.js';
import {
  AllocateInput, AllocateResult, CancelDocumentInput, Expense, ExpenseCategory, ExpenseInput, ExpenseListInput, ExpensePage, OpenItems, PartyRefInput,
  Payment, PaymentInput, PaymentListInput, PaymentPage, WriteOff, WriteOffInput,
} from './payments.js';
import {
  AccountLedgerInput, AccountLedgerPage, AccountView, AsOfInput, BacklogResult, BalanceSheet, CreateAccountInput, DayBookInput, DayBookPage, JournalView, LatePosting,
  ListAccountsInput, LockPeriodInput, ManualJournalInput, Period, ProfitAndLoss, RangeInput, RenameAccountInput, ReverseJournalInput, TrialBalance, UnlockPeriodInput,
  FinancialYear, YearCloseInput,
} from './accounting.js';
import { CompleteSaleInput, CompleteSaleResult, HeldBill, HoldBillInput, Sale, SaleDraft, SaleListInput, SalePage, SaleQuote } from './sales.js';
import { CancelSaleInput, CompleteReturnInput, CompleteReturnResult, CreditNote, CreditNoteListInput, CreditNotePage, ReturnDraft, ReturnQuote } from './returns.js';
import { PrintJobSummary, PrinterConfig, ReceiptDoc } from './print.js';
import { SETTING_KEYS } from './settings.js';
import { CloudBusiness, HydrationStartInput, HydrationStatus } from './hydration.js';
import { Dashboard, ExportReportInput, ExportReportResult, ReportDefinitionView, ReportResult, RunReportInput } from './reports.js';
import { GstLedgerView, GstMonthInput, GstPayment, GstPaymentInput, GstReturnSummary, GstSetoff, GstSetoffPreview, PostGstSetoffInput } from './gst.js';
import { ReportCartInput, SetChannelInput, UpdateStatus } from './updates.js';
import { BackupList, BackupRef, BackupVerification, RestoreBackupInput, RestoreFromCloudInput, RestoreResult, RunBackupResult } from './backups.js';
import {
  AdjustmentResult, AdjustStockInput, MovementPage, MovementsInput, OpeningImportCommitInput, OpeningImportPreview, OpeningImportPreviewInput,
  OpeningStockInput, StockListInput, StockPage, StockRow, StockTakeInput, Valuation,
} from './inventory.js';
import {
  FailedOperation, ListFailedInput, ListReviewItemsInput, MarkReviewedInput, ReconciliationInput, ReconciliationRow, ResendInput, ReviewItem, SyncOverview,
} from './sync.js';

/**
 * LLD §10.1 — the IPC contract registry. The preload is GENERATED from this object, so the
 * renderer can only reach declared methods, and every method has a schema, a permission and a
 * rate limit by construction. `window.muneem` is typed from the same source.
 */
export interface ContractSpec<I extends z.ZodTypeAny = z.ZodTypeAny, O extends z.ZodTypeAny = z.ZodTypeAny> {
  input: I;
  output: O;
  /** null = callable without a session (login, health) */
  permission: Permission | null;
  rateLimit: { perSec: number };
  /** write an audit_log row inside the operation's transaction */
  audit?: boolean;
  /** name of the input field carrying the client-minted command id (FR-108) */
  idempotent?: string;
}

const spec = <I extends z.ZodTypeAny, O extends z.ZodTypeAny>(s: ContractSpec<I, O>) => s;
const Empty = z.object({}).strict();
const Ok = z.object({ ok: z.literal(true) });

export const contract = {
  'auth.register': spec({
    input: z.object({ name: z.string().min(1).max(120), identifier: Identifier, password: z.string().min(8).max(200), otp: z.string().optional() }),
    output: z.object({ userId: Ulid }), permission: null, rateLimit: { perSec: 1 },
  }),
  'auth.login': spec({
    input: z.object({ identifier: Identifier, password: z.string().min(1).max(200) }),
    output: Session, permission: null, rateLimit: { perSec: 2 }, audit: true,
  }),
  'auth.loginOffline': spec({
    input: z.object({ identifier: Identifier, password: z.string().min(1).max(200) }),
    output: Session, permission: null, rateLimit: { perSec: 2 }, audit: true,
  }),
  'auth.switchUser': spec({
    input: z.object({ userId: Ulid, pin: Pin }),
    output: Session, permission: null, rateLimit: { perSec: 2 }, audit: true,
  }),
  'auth.listCachedUsers': spec({
    input: Empty, output: z.array(SessionUser.pick({ id: true, name: true, identifier: true })), permission: null, rateLimit: { perSec: 5 },
  }),
  'auth.getSession': spec({ input: Empty, output: Session.nullable(), permission: null, rateLimit: { perSec: 30 } }),
  'auth.logout': spec({ input: Empty, output: Ok, permission: null, rateLimit: { perSec: 2 }, audit: true }),
  'auth.setPin': spec({ input: z.object({ pin: Pin }), output: Ok, permission: 'business.view', rateLimit: { perSec: 1 }, audit: true }),
  'auth.verifyPin': spec({ input: z.object({ pin: Pin }), output: Ok, permission: 'business.view', rateLimit: { perSec: 2 } }),

  'device.getInfo': spec({ input: Empty, output: DeviceInfo, permission: null, rateLimit: { perSec: 10 } }),
  'app.getConnectivity': spec({
    input: Empty,
    output: z.object({ online: z.boolean(), lastProbeAt: z.string().nullable(), serverSkewMs: z.number().int().nullable() }),
    permission: null, rateLimit: { perSec: 10 },
  }),

  'business.get': spec({ input: Empty, output: Business.nullable(), permission: 'business.view', rateLimit: { perSec: 10 } }),
  'business.create': spec({ input: BusinessInput, output: Business, permission: null, rateLimit: { perSec: 1 }, audit: true }),
  'business.update': spec({ input: BusinessInput.partial().extend({ id: Ulid, version: z.number().int() }), output: Business, permission: 'business.manage', rateLimit: { perSec: 2 }, audit: true }),
  'business.getBranches': spec({ input: Empty, output: z.array(Branch), permission: 'business.view', rateLimit: { perSec: 10 } }),
  'business.createBranch': spec({ input: BranchInput, output: Branch, permission: 'business.manage', rateLimit: { perSec: 2 }, audit: true }),
  'business.getTerminals': spec({ input: z.object({ branchId: Ulid.optional() }), output: z.array(Terminal), permission: 'business.view', rateLimit: { perSec: 10 } }),
  'business.createTerminal': spec({ input: TerminalInput, output: Terminal, permission: 'business.manage', rateLimit: { perSec: 2 }, audit: true }),
  'business.selectTerminal': spec({ input: z.object({ terminalId: Ulid }), output: Session, permission: 'business.view', rateLimit: { perSec: 2 }, audit: true }),

  'settings.get': spec({ input: z.object({ key: z.enum(SETTING_KEYS) }), output: z.object({ value: z.unknown().nullable() }), permission: 'settings.view', rateLimit: { perSec: 20 } }),
  'settings.set': spec({ input: z.object({ key: z.enum(SETTING_KEYS), value: z.unknown() }), output: Ok, permission: 'settings.manage', rateLimit: { perSec: 5 }, audit: true }),
  'settings.listSeries': spec({ input: Empty, output: z.array(DocSeries), permission: 'settings.view', rateLimit: { perSec: 10 } }),
  'settings.createSeries': spec({
    // The prefix's shape per document type is checked where series are created (5i #3).
    input: DocSeries.omit({ id: true, businessId: true, nextSeq: true }),
    output: DocSeries, permission: 'settings.manage', rateLimit: { perSec: 2 }, audit: true,
  }),

  'products.search': spec({ input: ProductSearchInput, output: z.array(ProductHit), permission: 'products.view', rateLimit: { perSec: 30 } }),
  'products.lookupBarcode': spec({ input: z.object({ code: z.string().trim().min(1).max(48) }), output: ProductHit.nullable(), permission: 'products.view', rateLimit: { perSec: 30 } }),
  'products.list': spec({ input: ProductListInput, output: ProductPage, permission: 'products.view', rateLimit: { perSec: 10 } }),
  'products.get': spec({ input: z.object({ id: Ulid }), output: Product, permission: 'products.view', rateLimit: { perSec: 20 } }),
  'products.create': spec({ input: ProductInput, output: Product, permission: 'products.create', rateLimit: { perSec: 5 }, audit: true }),
  'products.update': spec({ input: ProductUpdate, output: Product, permission: 'products.edit', rateLimit: { perSec: 5 }, audit: true }),
  'products.deactivate': spec({ input: z.object({ id: Ulid, version: z.number().int() }), output: Product, permission: 'products.edit', rateLimit: { perSec: 5 }, audit: true }),
  'products.reactivate': spec({ input: z.object({ id: Ulid, version: z.number().int() }), output: Product, permission: 'products.edit', rateLimit: { perSec: 5 }, audit: true }),
  'products.importPreview': spec({ input: ImportPreviewInput, output: ImportPreview, permission: 'products.create', rateLimit: { perSec: 2 }, audit: true }),
  'products.importCommit': spec({ input: ImportCommitInput, output: ImportSummary, permission: 'products.create', rateLimit: { perSec: 1 }, audit: true, idempotent: 'commandId' }),
  'catalog.listUoms': spec({ input: Empty, output: z.array(Uom), permission: 'products.view', rateLimit: { perSec: 10 } }),
  'catalog.createUom': spec({ input: UomInput, output: Uom, permission: 'products.create', rateLimit: { perSec: 2 }, audit: true }),
  'catalog.listCategories': spec({ input: Empty, output: z.array(Category), permission: 'products.view', rateLimit: { perSec: 10 } }),
  'catalog.createCategory': spec({ input: CategoryInput, output: Category, permission: 'products.create', rateLimit: { perSec: 5 }, audit: true }),
  'catalog.updateCategory': spec({ input: CategoryInput.extend({ id: Ulid, version: z.number().int() }), output: Category, permission: 'products.edit', rateLimit: { perSec: 5 }, audit: true }),
  'catalog.listBrands': spec({ input: Empty, output: z.array(Brand), permission: 'products.view', rateLimit: { perSec: 10 } }),
  'catalog.createBrand': spec({ input: BrandInput, output: Brand, permission: 'products.create', rateLimit: { perSec: 5 }, audit: true }),
  'catalog.updateBrand': spec({ input: BrandInput.extend({ id: Ulid, version: z.number().int() }), output: Brand, permission: 'products.edit', rateLimit: { perSec: 5 }, audit: true }),
  'pricing.listLists': spec({ input: Empty, output: z.array(PriceList), permission: 'products.view', rateLimit: { perSec: 10 } }),
  'pricing.createList': spec({ input: PriceListInput, output: PriceList, permission: 'products.edit', rateLimit: { perSec: 2 }, audit: true }),
  'pricing.getItems': spec({ input: PriceItemsQuery, output: z.array(PriceListItem), permission: 'products.view', rateLimit: { perSec: 20 } }),
  'pricing.setItems': spec({ input: SetPriceItems, output: z.array(PriceListItem), permission: 'products.edit', rateLimit: { perSec: 5 }, audit: true }),

  'customers.search': spec({ input: CustomerSearchInput, output: z.array(Customer), permission: 'customers.view', rateLimit: { perSec: 20 } }),
  'customers.get': spec({ input: z.object({ id: Ulid }), output: Customer, permission: 'customers.view', rateLimit: { perSec: 20 } }),
  'customers.create': spec({ input: CustomerInput, output: Customer, permission: 'customers.create', rateLimit: { perSec: 5 }, audit: true }),
  'customers.update': spec({ input: CustomerInput.extend({ id: Ulid, version: z.number().int() }), output: Customer, permission: 'customers.edit', rateLimit: { perSec: 5 }, audit: true }),
  'customers.setCreditLimit': spec({ input: SetCreditLimitInput, output: Customer, permission: 'customers.approve', rateLimit: { perSec: 2 }, audit: true }),
  'customers.setOpening': spec({ input: OpeningBalanceInput, output: PartyOpening, permission: 'customers.edit', rateLimit: { perSec: 2 }, audit: true }),
  'customers.getLedger': spec({ input: LedgerInput, output: LedgerPage, permission: 'customers.view', rateLimit: { perSec: 10 } }),
  'customers.getOutstanding': spec({ input: OutstandingInput, output: Outstanding, permission: 'customers.view', rateLimit: { perSec: 2 } }),
  // ADR-0050: consent is captured at the counter, so a cashier can record and withdraw it; export and erasure are a manager's.
  'customers.setConsent': spec({ input: SetConsentInput, output: Customer, permission: 'customers.create', rateLimit: { perSec: 2 }, audit: true }),
  'customers.withdrawConsent': spec({ input: WithdrawConsentInput, output: Customer, permission: 'customers.create', rateLimit: { perSec: 2 }, audit: true }),
  'customers.exportProfile': spec({ input: ExportProfileInput, output: ExportProfileResult, permission: 'customers.approve', rateLimit: { perSec: 1 }, audit: true }),
  'customers.erase': spec({ input: EraseCustomerInput, output: Customer, permission: 'customers.approve', rateLimit: { perSec: 1 }, audit: true }),

  'suppliers.search': spec({ input: SupplierSearchInput, output: z.array(Supplier), permission: 'suppliers.view', rateLimit: { perSec: 20 } }),
  'suppliers.get': spec({ input: z.object({ id: Ulid }), output: Supplier, permission: 'suppliers.view', rateLimit: { perSec: 20 } }),
  'suppliers.create': spec({ input: SupplierInput, output: Supplier, permission: 'suppliers.create', rateLimit: { perSec: 5 }, audit: true }),
  'suppliers.update': spec({ input: SupplierInput.extend({ id: Ulid, version: z.number().int() }), output: Supplier, permission: 'suppliers.edit', rateLimit: { perSec: 5 }, audit: true }),
  'suppliers.setOpening': spec({ input: OpeningBalanceInput, output: PartyOpening, permission: 'suppliers.edit', rateLimit: { perSec: 2 }, audit: true }),
  'suppliers.getLedger': spec({ input: LedgerInput, output: LedgerPage, permission: 'suppliers.view', rateLimit: { perSec: 10 } }),
  'suppliers.getOutstanding': spec({ input: OutstandingInput, output: Outstanding, permission: 'suppliers.view', rateLimit: { perSec: 2 } }),
  'pos.getSession': spec({ input: Empty, output: RegisterSession.nullable(), permission: 'pos.view', rateLimit: { perSec: 20 } }),
  'pos.openRegister': spec({ input: OpenRegisterInput, output: RegisterSession, permission: 'pos.create', rateLimit: { perSec: 1 }, audit: true }),
  'pos.cashMovement': spec({ input: CashMovementInput, output: Ok, permission: 'pos.create', rateLimit: { perSec: 2 }, audit: true }),
  'pos.xReport': spec({ input: Empty, output: RegisterReport, permission: 'pos.view', rateLimit: { perSec: 5 } }),
  'pos.zReport': spec({ input: z.object({ sessionId: Ulid.optional() }), output: RegisterReport.nullable(), permission: 'pos.view', rateLimit: { perSec: 5 } }),
  'pos.closeRegister': spec({ input: CloseRegisterInput, output: RegisterReport, permission: 'pos.create', rateLimit: { perSec: 1 }, audit: true }),

  'pos.holdBill': spec({ input: HoldBillInput, output: HeldBill, permission: 'pos.create', rateLimit: { perSec: 5 }, audit: true }),
  'pos.listHeldBills': spec({ input: Empty, output: z.array(HeldBill), permission: 'pos.view', rateLimit: { perSec: 10 } }),
  'pos.getHeldBill': spec({ input: z.object({ id: Ulid }), output: HeldBill, permission: 'pos.view', rateLimit: { perSec: 10 } }),
  'pos.discardBill': spec({ input: z.object({ id: Ulid }), output: Ok, permission: 'pos.create', rateLimit: { perSec: 5 }, audit: true }),
  // 8i: the POS screen tells main whether a bill is being rung up, so an update never installs mid-sale.
  'pos.reportCart': spec({ input: ReportCartInput, output: Ok, permission: 'pos.view', rateLimit: { perSec: 20 } }),
  'sales.quote': spec({ input: SaleDraft, output: SaleQuote, permission: 'sales.create', rateLimit: { perSec: 30 } }),
  'sales.complete': spec({ input: CompleteSaleInput, output: CompleteSaleResult, permission: 'sales.create', rateLimit: { perSec: 5 }, audit: true, idempotent: 'commandId' }),
  'sales.get': spec({ input: z.object({ id: Ulid }), output: Sale, permission: 'sales.view', rateLimit: { perSec: 20 } }),
  'sales.list': spec({ input: SaleListInput, output: SalePage, permission: 'sales.view', rateLimit: { perSec: 10 } }),
  'sales.getReceipt': spec({ input: z.object({ saleId: Ulid }), output: ReceiptDoc, permission: 'sales.view', rateLimit: { perSec: 10 } }),
  'sales.cancel': spec({ input: CancelSaleInput, output: CompleteReturnResult, permission: 'sales.cancel', rateLimit: { perSec: 1 }, audit: true }),
  'returns.quote': spec({ input: ReturnDraft, output: ReturnQuote, permission: 'sales.view', rateLimit: { perSec: 20 } }),
  'returns.complete': spec({ input: CompleteReturnInput, output: CompleteReturnResult, permission: 'sales.edit', rateLimit: { perSec: 2 }, audit: true, idempotent: 'commandId' }),
  'returns.get': spec({ input: z.object({ id: Ulid }), output: CreditNote, permission: 'sales.view', rateLimit: { perSec: 20 } }),
  'returns.list': spec({ input: CreditNoteListInput, output: CreditNotePage, permission: 'sales.view', rateLimit: { perSec: 10 } }),
  'returns.getReceipt': spec({ input: z.object({ creditNoteId: Ulid }), output: ReceiptDoc, permission: 'sales.view', rateLimit: { perSec: 10 } }),
  'returns.reprint': spec({ input: z.object({ creditNoteId: Ulid }), output: z.object({ jobId: Ulid }), permission: 'pos.create', rateLimit: { perSec: 2 }, audit: true }),

  'printer.getConfig': spec({ input: Empty, output: PrinterConfig, permission: 'pos.view', rateLimit: { perSec: 5 } }),
  'printer.setConfig': spec({ input: PrinterConfig, output: PrinterConfig, permission: 'settings.manage', rateLimit: { perSec: 2 }, audit: true }),
  'printer.testPrint': spec({ input: Empty, output: Ok, permission: 'pos.view', rateLimit: { perSec: 1 } }),
  'printer.getQueue': spec({ input: z.object({ limit: z.number().int().min(1).max(100).default(20) }), output: z.array(PrintJobSummary), permission: 'pos.view', rateLimit: { perSec: 5 } }),
  'printer.retryJob': spec({ input: z.object({ jobId: Ulid }), output: Ok, permission: 'pos.create', rateLimit: { perSec: 2 } }),
  'printer.reprint': spec({ input: z.object({ saleId: Ulid }), output: z.object({ jobId: Ulid }), permission: 'pos.create', rateLimit: { perSec: 2 }, audit: true }),
  'drawer.open': spec({ input: Empty, output: Ok, permission: 'pos.create', rateLimit: { perSec: 1 }, audit: true }),

  'inventory.getStock': spec({ input: StockListInput, output: StockPage, permission: 'inventory.view', rateLimit: { perSec: 10 } }),
  'inventory.getMovements': spec({ input: MovementsInput, output: MovementPage, permission: 'inventory.view', rateLimit: { perSec: 10 } }),
  'inventory.valuation': spec({ input: Empty, output: Valuation, permission: 'inventory.view', rateLimit: { perSec: 2 } }),
  'inventory.listLowStock': spec({ input: Empty, output: z.array(StockRow), permission: 'inventory.view', rateLimit: { perSec: 5 } }),
  'inventory.rebuildProjections': spec({ input: Empty, output: z.object({ rebuilt: z.number().int() }), permission: 'inventory.manage', rateLimit: { perSec: 1 }, audit: true }),
  'inventory.listWarehouses': spec({ input: Empty, output: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })), permission: 'inventory.view', rateLimit: { perSec: 5 } }),
  'inventory.setOpeningStock': spec({ input: OpeningStockInput, output: AdjustmentResult, permission: 'inventory.create', rateLimit: { perSec: 2 }, audit: true }),
  'inventory.adjust': spec({ input: AdjustStockInput, output: AdjustmentResult, permission: 'inventory.adjust', rateLimit: { perSec: 2 }, audit: true }),
  'inventory.stockTake': spec({ input: StockTakeInput, output: AdjustmentResult, permission: 'inventory.adjust', rateLimit: { perSec: 1 }, audit: true }),
  'inventory.importOpeningPreview': spec({ input: OpeningImportPreviewInput, output: OpeningImportPreview, permission: 'inventory.create', rateLimit: { perSec: 2 }, audit: true }),
  'inventory.importOpeningCommit': spec({ input: OpeningImportCommitInput, output: AdjustmentResult, permission: 'inventory.create', rateLimit: { perSec: 1 }, audit: true, idempotent: 'commandId' }),
  'inventory.stockReconciliation': spec({ input: ReconciliationInput, output: z.array(ReconciliationRow), permission: 'inventory.view', rateLimit: { perSec: 2 } }),

  'purchases.quote': spec({ input: PurchaseDraft, output: PurchaseQuote, permission: 'purchases.create', rateLimit: { perSec: 10 } }),
  'purchases.create': spec({ input: CreatePurchaseInput, output: Purchase, permission: 'purchases.create', rateLimit: { perSec: 2 }, audit: true, idempotent: 'commandId' }),
  'purchases.get': spec({ input: z.object({ id: Ulid }), output: Purchase, permission: 'purchases.view', rateLimit: { perSec: 20 } }),
  'purchases.list': spec({ input: PurchaseListInput, output: PurchasePage, permission: 'purchases.view', rateLimit: { perSec: 10 } }),
  'purchases.return': spec({ input: ReturnPurchaseInput, output: DebitNote, permission: 'purchases.create', rateLimit: { perSec: 2 }, audit: true, idempotent: 'commandId' }),
  'purchases.cancel': spec({ input: CancelPurchaseInput, output: Purchase, permission: 'purchases.cancel', rateLimit: { perSec: 1 }, audit: true }),
  'purchases.importLinesPreview': spec({ input: PurchaseImportPreviewInput, output: PurchaseImportPreview, permission: 'purchases.create', rateLimit: { perSec: 2 }, audit: true }),

  'payments.create': spec({ input: PaymentInput, output: Payment, permission: 'payments.create', rateLimit: { perSec: 2 }, audit: true, idempotent: 'commandId' }),
  'payments.get': spec({ input: z.object({ id: Ulid }), output: Payment, permission: 'payments.view', rateLimit: { perSec: 20 } }),
  'payments.list': spec({ input: PaymentListInput, output: PaymentPage, permission: 'payments.view', rateLimit: { perSec: 10 } }),
  'payments.openItems': spec({ input: PartyRefInput, output: OpenItems, permission: 'payments.view', rateLimit: { perSec: 10 } }),
  'payments.allocate': spec({ input: AllocateInput, output: AllocateResult, permission: 'payments.create', rateLimit: { perSec: 2 }, audit: true }),
  'payments.cancel': spec({ input: CancelDocumentInput, output: Payment, permission: 'payments.cancel', rateLimit: { perSec: 1 }, audit: true }),
  'payments.writeOff': spec({ input: WriteOffInput, output: WriteOff, permission: 'payments.approve', rateLimit: { perSec: 1 }, audit: true, idempotent: 'commandId' }),

  'expenses.listCategories': spec({ input: Empty, output: z.array(ExpenseCategory), permission: 'expenses.view', rateLimit: { perSec: 5 } }),
  'expenses.create': spec({ input: ExpenseInput, output: Expense, permission: 'expenses.create', rateLimit: { perSec: 2 }, audit: true, idempotent: 'commandId' }),
  'expenses.get': spec({ input: z.object({ id: Ulid }), output: Expense, permission: 'expenses.view', rateLimit: { perSec: 20 } }),
  'expenses.list': spec({ input: ExpenseListInput, output: ExpensePage, permission: 'expenses.view', rateLimit: { perSec: 10 } }),
  'expenses.cancel': spec({ input: CancelDocumentInput, output: Expense, permission: 'expenses.cancel', rateLimit: { perSec: 1 }, audit: true }),

  'accounting.listAccounts': spec({ input: ListAccountsInput, output: z.array(AccountView), permission: 'accounting.view', rateLimit: { perSec: 5 } }),
  'accounting.createAccount': spec({ input: CreateAccountInput, output: AccountView, permission: 'accounting.manage', rateLimit: { perSec: 2 }, audit: true }),
  'accounting.updateAccount': spec({ input: RenameAccountInput, output: AccountView, permission: 'accounting.manage', rateLimit: { perSec: 2 }, audit: true }),
  'accounting.getTrialBalance': spec({ input: AsOfInput, output: TrialBalance, permission: 'reports.financial', rateLimit: { perSec: 2 } }),
  'accounting.getProfitAndLoss': spec({ input: RangeInput, output: ProfitAndLoss, permission: 'reports.financial', rateLimit: { perSec: 2 } }),
  'accounting.getBalanceSheet': spec({ input: AsOfInput, output: BalanceSheet, permission: 'reports.financial', rateLimit: { perSec: 2 } }),
  'accounting.getLedger': spec({ input: AccountLedgerInput, output: AccountLedgerPage, permission: 'accounting.view', rateLimit: { perSec: 10 } }),
  'accounting.getCashBook': spec({ input: AccountLedgerInput, output: AccountLedgerPage, permission: 'accounting.view', rateLimit: { perSec: 10 } }),
  'accounting.getBankBook': spec({ input: AccountLedgerInput, output: AccountLedgerPage, permission: 'accounting.view', rateLimit: { perSec: 10 } }),
  'accounting.getDayBook': spec({ input: DayBookInput, output: DayBookPage, permission: 'accounting.view', rateLimit: { perSec: 10 } }),
  'accounting.postManualJournal': spec({ input: ManualJournalInput, output: JournalView, permission: 'accounting.create', rateLimit: { perSec: 2 }, audit: true, idempotent: 'commandId' }),
  'accounting.reverseJournal': spec({ input: ReverseJournalInput, output: JournalView, permission: 'accounting.create', rateLimit: { perSec: 1 }, audit: true }),
  'accounting.getPeriods': spec({ input: Empty, output: z.array(Period), permission: 'accounting.view', rateLimit: { perSec: 5 } }),
  'accounting.lockPeriod': spec({ input: LockPeriodInput, output: Period, permission: 'accounting.manage', rateLimit: { perSec: 1 }, audit: true }),
  'accounting.unlockPeriod': spec({ input: UnlockPeriodInput, output: Period, permission: 'accounting.manage', rateLimit: { perSec: 1 }, audit: true }),
  'accounting.listLatePostings': spec({ input: Empty, output: z.array(LatePosting), permission: 'accounting.view', rateLimit: { perSec: 5 } }),
  'accounting.getYearEnd': spec({ input: Empty, output: z.array(FinancialYear), permission: 'accounting.view', rateLimit: { perSec: 5 } }),
  'accounting.closeYear': spec({ input: YearCloseInput, output: FinancialYear, permission: 'accounting.close', rateLimit: { perSec: 1 }, audit: true }),
  'accounting.recloseYear': spec({ input: YearCloseInput, output: FinancialYear, permission: 'accounting.close', rateLimit: { perSec: 1 }, audit: true }),
  'accounting.postBacklog': spec({ input: Empty, output: BacklogResult, permission: 'accounting.manage', rateLimit: { perSec: 1 }, audit: true }),
  'accounting.rebuildBalances': spec({ input: Empty, output: z.object({ rebuilt: z.number().int() }), permission: 'accounting.manage', rateLimit: { perSec: 1 }, audit: true }),

  // ADR-0046: each report checks its own permission too (financial statements need reports.financial).
  'reports.listDefinitions': spec({ input: Empty, output: z.array(ReportDefinitionView), permission: 'reports.view', rateLimit: { perSec: 5 } }),
  'reports.run': spec({ input: RunReportInput, output: ReportResult, permission: 'reports.view', rateLimit: { perSec: 5 } }),
  'reports.export': spec({ input: ExportReportInput, output: ExportReportResult, permission: 'reports.export', rateLimit: { perSec: 1 }, audit: true }),
  'reports.dashboard': spec({ input: Empty, output: Dashboard, permission: 'reports.view', rateLimit: { perSec: 5 } }),

  // ADR-0050: every role holds business.view; each kind is further filtered by the permission its subject needs.
  'notifications.list': spec({ input: ListNotificationsInput, output: NotificationPage, permission: 'business.view', rateLimit: { perSec: 10 } }),
  'notifications.counts': spec({ input: Empty, output: NotificationCounts, permission: 'business.view', rateLimit: { perSec: 10 } }),
  'notifications.markRead': spec({ input: NotificationIdsInput, output: NotificationChanged, permission: 'business.view', rateLimit: { perSec: 5 } }),
  'notifications.dismiss': spec({ input: NotificationIdsInput, output: NotificationChanged, permission: 'business.view', rateLimit: { perSec: 5 } }),

  // ADR-0044: returns are read with gst.view; posting a set-off or a challan is gst.create (managers and accountants).
  'gst.returnSummary': spec({ input: GstMonthInput, output: GstReturnSummary, permission: 'gst.view', rateLimit: { perSec: 2 } }),
  'gst.previewSetoff': spec({ input: GstMonthInput, output: GstSetoffPreview, permission: 'gst.view', rateLimit: { perSec: 2 } }),
  'gst.postSetoff': spec({ input: PostGstSetoffInput, output: GstSetoff, permission: 'gst.create', rateLimit: { perSec: 1 }, audit: true, idempotent: 'commandId' }),
  'gst.recordPayment': spec({ input: GstPaymentInput, output: GstPayment, permission: 'gst.create', rateLimit: { perSec: 1 }, audit: true, idempotent: 'commandId' }),
  'gst.ledger': spec({ input: Empty, output: GstLedgerView, permission: 'gst.view', rateLimit: { perSec: 5 } }),

  'sync.getStatus': spec({ input: Empty, output: SyncStatus, permission: null, rateLimit: { perSec: 10 } }),
  'sync.retry': spec({ input: Empty, output: SyncStatus, permission: 'sync.view', rateLimit: { perSec: 1 } }),
  'sync.getOverview': spec({ input: Empty, output: SyncOverview, permission: 'sync.view', rateLimit: { perSec: 5 } }),
  'sync.listFailed': spec({ input: ListFailedInput, output: z.array(FailedOperation), permission: 'sync.view', rateLimit: { perSec: 5 } }),
  'sync.resend': spec({ input: ResendInput, output: z.object({ resent: z.number().int() }), permission: 'sync.manage', rateLimit: { perSec: 1 }, audit: true }),
  'sync.listReviewItems': spec({ input: ListReviewItemsInput, output: z.array(ReviewItem), permission: 'sync.view', rateLimit: { perSec: 5 } }),
  'sync.markReviewed': spec({ input: MarkReviewedInput, output: z.object({ reviewed: z.number().int() }), permission: 'sync.manage', rateLimit: { perSec: 2 }, audit: true }),
  // 7f: a device being added has a session but no business yet, so these check the session and the membership themselves.
  'sync.listCloudBusinesses': spec({ input: Empty, output: z.array(CloudBusiness), permission: null, rateLimit: { perSec: 2 } }),
  'sync.hydrationStart': spec({ input: HydrationStartInput, output: HydrationStatus, permission: null, rateLimit: { perSec: 2 }, audit: true }),
  'sync.hydrationStatus': spec({ input: Empty, output: HydrationStatus, permission: null, rateLimit: { perSec: 10 } }),

  'diagnostics.getHealth': spec({ input: Empty, output: Health, permission: 'diagnostics.view', rateLimit: { perSec: 5 } }),
  'diagnostics.integrityCheck': spec({
    input: Empty,
    output: z.object({ quickCheck: z.enum(['ok', 'failed']), foreignKeys: z.enum(['ok', 'failed']), auditChain: z.enum(['ok', 'broken']), stock: z.enum(['ok', 'healed', 'not_run']), parties: z.enum(['ok', 'mismatch', 'not_run']), journals: z.enum(['ok', 'healed', 'mismatch', 'not_run']), summaries: z.enum(['ok', 'healed', 'not_run']), detail: z.array(z.string()) }),
    permission: 'diagnostics.view', rateLimit: { perSec: 1 }, audit: true,
  }),
  'diagnostics.verifyAudit': spec({ input: Empty, output: AuditVerification, permission: 'diagnostics.view', rateLimit: { perSec: 1 } }),
  'diagnostics.exportSupportBundle': spec({ input: Empty, output: z.object({ handle: z.string(), bytes: z.number().int() }), permission: 'diagnostics.view', rateLimit: { perSec: 1 }, audit: true }),
  'diagnostics.getLogsTail': spec({ input: z.object({ log: z.enum(['app', 'sync', 'sql-slow', 'hardware']), lines: z.number().int().min(1).max(2000).default(200) }), output: z.array(z.string()), permission: 'diagnostics.view', rateLimit: { perSec: 5 } }),

  // ADR-0047 (8f). A restore swaps the database and restarts, so it writes its own audit row into the restored file.
  'backups.list': spec({ input: Empty, output: BackupList, permission: 'diagnostics.view', rateLimit: { perSec: 2 } }),
  'backups.runNow': spec({ input: Empty, output: RunBackupResult, permission: 'diagnostics.view', rateLimit: { perSec: 1 }, audit: true }),
  'backups.verify': spec({ input: BackupRef, output: BackupVerification, permission: 'diagnostics.view', rateLimit: { perSec: 1 } }),
  'backups.restore': spec({ input: RestoreBackupInput, output: RestoreResult, permission: 'diagnostics.manage', rateLimit: { perSec: 1 } }),
  // A new device (setup) has a session but no business yet, so this checks the session and the membership itself, as hydration does.
  'backups.restoreFromCloud': spec({ input: RestoreFromCloudInput, output: RestoreResult, permission: null, rateLimit: { perSec: 1 } }),

  // ADR-0049 (8i). Status is readable by anyone at the till so the banner shows; installing restarts the app.
  'update.getStatus': spec({ input: Empty, output: UpdateStatus, permission: null, rateLimit: { perSec: 5 } }),
  'update.checkNow': spec({ input: Empty, output: UpdateStatus, permission: 'settings.view', rateLimit: { perSec: 1 } }),
  'update.installNow': spec({ input: Empty, output: UpdateStatus, permission: 'diagnostics.manage', rateLimit: { perSec: 1 }, audit: true }),
  'update.setChannel': spec({ input: SetChannelInput, output: UpdateStatus, permission: 'settings.manage', rateLimit: { perSec: 1 }, audit: true }),
} as const satisfies Record<string, ContractSpec>;

export type Contract = typeof contract;
export type Channel = keyof Contract;
export type InputOf<C extends Channel> = z.input<Contract[C]['input']>;
export type OutputOf<C extends Channel> = z.output<Contract[C]['output']>;

/** Shape of `window.muneem` as seen by the renderer: `muneem.auth.login(input)`. */
export type Namespace = Channel extends `${infer N}.${string}` ? N : never;
export type MuneemApi = {
  [NS in Namespace]: {
    [M in Channel as M extends `${NS}.${infer Name}` ? Name : never]: (input: InputOf<M>) => Promise<OutputOf<M>>;
  };
};

export const channels = Object.keys(contract) as Channel[];
