import { z } from 'zod';
import type { Permission } from './permissions.js';
import {
  Branch, BranchInput, Business, BusinessInput, DeviceInfo, DocSeries, Health, Identifier, Pin, Session,
  SessionUser, SyncStatus, Terminal, TerminalInput, Ulid,
} from './schemas.js';
import {
  Brand, BrandInput, Category, CategoryInput, ImportCommitInput, ImportPreview, ImportPreviewInput, ImportSummary, PriceList, PriceListInput, PriceListItem, PriceItemsQuery, Product, ProductHit,
  ProductInput, ProductListInput, ProductPage, ProductSearchInput, ProductUpdate, SetPriceItems, Uom, UomInput,
} from './catalog.js';
import {
  CashMovementInput, CloseRegisterInput, Customer, CustomerInput, CustomerSearchInput, OpenRegisterInput, RegisterReport, RegisterSession,
} from './pos.js';
import { CompleteSaleInput, CompleteSaleResult, HeldBill, HoldBillInput, Sale, SaleDraft, SaleListInput, SalePage, SaleQuote } from './sales.js';
import { PrintJobSummary, PrinterConfig, ReceiptDoc } from './print.js';
import { SETTING_KEYS } from './settings.js';

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
  'sales.quote': spec({ input: SaleDraft, output: SaleQuote, permission: 'sales.create', rateLimit: { perSec: 30 } }),
  'sales.complete': spec({ input: CompleteSaleInput, output: CompleteSaleResult, permission: 'sales.create', rateLimit: { perSec: 5 }, audit: true, idempotent: 'commandId' }),
  'sales.get': spec({ input: z.object({ id: Ulid }), output: Sale, permission: 'sales.view', rateLimit: { perSec: 20 } }),
  'sales.list': spec({ input: SaleListInput, output: SalePage, permission: 'sales.view', rateLimit: { perSec: 10 } }),
  'sales.getReceipt': spec({ input: z.object({ saleId: Ulid }), output: ReceiptDoc, permission: 'sales.view', rateLimit: { perSec: 10 } }),

  'printer.getConfig': spec({ input: Empty, output: PrinterConfig, permission: 'pos.view', rateLimit: { perSec: 5 } }),
  'printer.setConfig': spec({ input: PrinterConfig, output: PrinterConfig, permission: 'settings.manage', rateLimit: { perSec: 2 }, audit: true }),
  'printer.testPrint': spec({ input: Empty, output: Ok, permission: 'pos.view', rateLimit: { perSec: 1 } }),
  'printer.getQueue': spec({ input: z.object({ limit: z.number().int().min(1).max(100).default(20) }), output: z.array(PrintJobSummary), permission: 'pos.view', rateLimit: { perSec: 5 } }),
  'printer.retryJob': spec({ input: z.object({ jobId: Ulid }), output: Ok, permission: 'pos.create', rateLimit: { perSec: 2 } }),
  'printer.reprint': spec({ input: z.object({ saleId: Ulid }), output: z.object({ jobId: Ulid }), permission: 'pos.create', rateLimit: { perSec: 2 }, audit: true }),
  'drawer.open': spec({ input: Empty, output: Ok, permission: 'pos.create', rateLimit: { perSec: 1 }, audit: true }),

  'sync.getStatus': spec({ input: Empty, output: SyncStatus, permission: null, rateLimit: { perSec: 10 } }),

  'diagnostics.getHealth': spec({ input: Empty, output: Health, permission: 'diagnostics.view', rateLimit: { perSec: 5 } }),
  'diagnostics.integrityCheck': spec({
    input: Empty,
    output: z.object({ quickCheck: z.enum(['ok', 'failed']), foreignKeys: z.enum(['ok', 'failed']), auditChain: z.enum(['ok', 'broken']), detail: z.array(z.string()) }),
    permission: 'diagnostics.view', rateLimit: { perSec: 1 }, audit: true,
  }),
  'diagnostics.backupNow': spec({ input: Empty, output: z.object({ path: z.string(), bytes: z.number().int(), verified: z.boolean() }), permission: 'diagnostics.view', rateLimit: { perSec: 1 }, audit: true }),
  'diagnostics.exportSupportBundle': spec({ input: Empty, output: z.object({ handle: z.string(), bytes: z.number().int() }), permission: 'diagnostics.view', rateLimit: { perSec: 1 }, audit: true }),
  'diagnostics.getLogsTail': spec({ input: z.object({ log: z.enum(['app', 'sync', 'sql-slow', 'hardware']), lines: z.number().int().min(1).max(2000).default(200) }), output: z.array(z.string()), permission: 'diagnostics.view', rateLimit: { perSec: 5 } }),
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
