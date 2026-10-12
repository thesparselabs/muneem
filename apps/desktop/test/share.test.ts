import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import type { Db } from '@muneem/db-sqlite';
import type { CompleteSaleResult, SaleQuote, SharePreview, ShareRecord } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import type { PdfOptions } from '../src/main/services/invoice/pdf.js';
import { retryDelayMs } from '../src/main/services/share/emailOutbox.js';
import { whatsappNumber } from '../src/main/services/share/recipient.js';
import { caller, defaultServer, grantRole, ownerAtTill, testApp, type FakeServer } from './helpers.js';

interface Mail { shareId: string; businessId: string; to: string; replyTo?: string; fromName: string; subject: string; text: string; attachment: { fileName: string; contentBase64: string } }

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let server: FakeServer;
let clock: number;
let mails: Mail[];
let relay: (body: Mail) => { status: number; body: unknown };
let opened: string[];
let downloads: { fileName: string; bytes: Buffer }[];
let pdfPadding: number;
let customerId: string;
let saleId: string;
let docNumber: string;

// A rendered "PDF" carries its HTML and page options, so a test can read what was printed.
const fakePdf = async (html: string, opts: PdfOptions) => Buffer.from(`%PDF-1.7\n${JSON.stringify(opts)}\n${html}${'x'.repeat(pdfPadding)}`);
const pdfText = (base64: string) => Buffer.from(base64, 'base64').toString('utf8');
const sent = (sentAt: string) => ({ status: 200, body: { shareId: '', status: 'sent', sentAt } });

async function setup() {
  clock = Date.parse('2026-10-12T10:00:00.000Z');
  mails = [];
  opened = [];
  downloads = [];
  pdfPadding = 0;
  relay = () => sent(new Date(clock).toISOString());
  server = defaultServer();
  const respond = server.respond;
  server.respond = (method, path, body) => {
    if (path === '/v1/share/email') { mails.push(body as Mail); return relay(body as Mail); }
    return respond(method, path, body);
  };
  ({ app, db } = await testApp({
    server, now: () => clock, documentPdf: fakePdf,
    saveDownload: async (fileName, bytes) => { downloads.push({ fileName, bytes }); return { saved: true, fileName }; },
    openExternal: async (url) => { opened.push(url); },
  }));
  api = caller(app);
  await ownerAtTill(app);
  await api.data('business.update', { id: app.business.get()!.id, version: app.business.get()!.version, email: 'shop@example.com' });
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const soap = (await api.data<{ id: string }>('products.create', { name: 'Lux Soap', sku: 'LUX', hsnCode: '3401', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 5000 })).id;
  customerId = (await api.data<{ id: string }>('customers.create', { name: 'Meena Gupta', phone: '9876543210', email: 'meena@example.com' })).id;
  await api.data('pos.openRegister', { openingCashPaise: 0 });
  const draft = { customerId, lines: [{ productId: soap, uomId: pcs, qtyMilli: 2000 }] };
  const q = await api.data<SaleQuote>('sales.quote', draft);
  const r = await api.data<CompleteSaleResult>('sales.complete', {
    ...draft, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise, tenders: [{ method: 'credit', amountPaise: q.totals.totalPaise }],
  });
  ({ saleId, docNumber } = r);
}

const invoice = { docType: 'invoice', id: '' } as const;
// share.send is rate limited per second against the test's clock.
const send = (over: Record<string, unknown>) => { clock += 1000; return api.call<ShareRecord>('share.send', { ...invoice, id: saleId, ...over }); };

describe('sharing a document (FR-085)', () => {
  beforeEach(setup);

  it('previews an invoice for the customer on file with the standard message', async () => {
    const wa = await api.data<SharePreview>('share.preview', { ...invoice, id: saleId, channel: 'whatsapp' });
    expect(wa).toMatchObject({ docLabel: `Tax invoice ${docNumber}`, to: '9876543210', subject: `Tax invoice ${docNumber} from Sharma Store` });
    expect(wa.fileName).toBe(`invoice-${docNumber.replaceAll('/', '_')}.pdf`);
    expect(wa.message).toBe(`Dear Meena Gupta, thank you for shopping at Sharma Store. Your tax invoice ${docNumber} dated 12 Oct 2026 for ₹100.00 is attached.`);
    expect((await api.data<SharePreview>('share.preview', { ...invoice, id: saleId, channel: 'email' })).to).toBe('meena@example.com');
  });

  it('opens a WhatsApp chat with the message and leaves the PDF in Downloads to attach', async () => {
    const audits = db.prepare(`SELECT COUNT(*) FROM audit_log WHERE action = 'ipc.share.send'`).pluck();
    const r = await send({ channel: 'whatsapp', to: '098765 43210', message: 'Your bill is attached.' });
    expect(r).toMatchObject({ ok: true, data: { channel: 'whatsapp', to: '+919876543210', status: 'opened', attempts: 0, docLabel: `Tax invoice ${docNumber}` } });
    expect(opened).toEqual([`https://wa.me/919876543210?text=${encodeURIComponent('Your bill is attached.')}`]);
    expect(downloads.map((d) => d.fileName)).toEqual([`invoice-${docNumber.replaceAll('/', '_')}.pdf`]);
    expect(downloads[0]!.bytes.toString()).toContain(docNumber);
    expect(mails).toEqual([]);
    expect(audits.get()).toBe(1);
    const history = await api.data<ShareRecord[]>('share.history', { ...invoice, id: saleId });
    expect(history.map((h) => [h.channel, h.status])).toEqual([['whatsapp', 'opened']]);
  });

  it('emails the PDF through the cloud at once when online, and keeps no copy once sent', async () => {
    const r = await send({ channel: 'email', to: 'meena@example.com', message: 'Please find your bill attached.' });
    expect(r).toMatchObject({ ok: true, data: { channel: 'email', to: 'meena@example.com', status: 'sent', attempts: 1, sentAt: new Date(clock).toISOString() } });
    expect(mails).toHaveLength(1);
    const mail = mails[0]!;
    expect(mail).toMatchObject({
      shareId: (r as { data: ShareRecord }).data.id, businessId: app.session.require().businessId, to: 'meena@example.com', replyTo: 'shop@example.com',
      fromName: 'Sharma Store', subject: `Tax invoice ${docNumber} from Sharma Store`, text: 'Please find your bill attached.',
      attachment: { fileName: `invoice-${docNumber.replaceAll('/', '_')}.pdf` },
    });
    expect(pdfText(mail.attachment.contentBase64)).toMatch(/^%PDF-1\.7\n\{"kind":"a4","pageSize":"A4"\}/u);
    expect(pdfText(mail.attachment.contentBase64)).toContain(docNumber);
    expect(server.calls.find((c) => c.path === '/v1/share/email')?.headers.Authorization).toBe('Bearer access.jwt');
    expect(db.prepare('SELECT pdf FROM share_log').pluck().get()).toBeNull();
  });

  it('queues an email while offline and sends it when the cloud is back', async () => {
    server.online = false;
    await app.connectivity.probe();
    const r = await send({ channel: 'email', to: 'meena@example.com', message: 'Your bill.' });
    expect(r).toMatchObject({ ok: true, data: { status: 'queued', attempts: 0 } });
    expect(mails).toEqual([]);
    expect(db.prepare('SELECT length(pdf) FROM share_log').pluck().get()).toBeGreaterThan(0);
    server.online = true;
    await app.connectivity.probe();
    await app.share.outbox.idle();
    expect(mails).toHaveLength(1);
    const [h] = await api.data<ShareRecord[]>('share.history', { ...invoice, id: saleId });
    expect(h).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('retries a relay that is down with a growing wait, and gives up at once on a refusal', async () => {
    relay = () => ({ status: 503, body: { error: { code: 'MAIL_UNAVAILABLE', class: 'transient', message: 'email is not configured on this server' } } });
    const r = await send({ channel: 'email', to: 'meena@example.com', message: 'Your bill.' });
    expect(r).toMatchObject({ ok: true, data: { status: 'queued', attempts: 1, lastError: 'email is not configured on this server' } });
    expect(db.prepare('SELECT next_attempt_at FROM share_log').pluck().get()).toBe(new Date(clock + 30_000).toISOString());
    app.share.outbox.drain();
    await app.share.outbox.idle();
    expect(mails).toHaveLength(1);
    clock += 30_000;
    app.share.outbox.drain();
    await app.share.outbox.idle();
    expect(mails).toHaveLength(2);
    expect(db.prepare('SELECT next_attempt_at FROM share_log').pluck().get()).toBe(new Date(clock + 60_000).toISOString());
    relay = () => ({ status: 422, body: { error: { code: 'VALIDATION_FAILED', class: 'validation', message: 'to must be one email address' } } });
    clock += 60_000;
    app.share.outbox.drain();
    await app.share.outbox.idle();
    expect(db.prepare('SELECT status, attempts, last_error, pdf FROM share_log').get()).toEqual({ status: 'failed', attempts: 3, last_error: 'to must be one email address', pdf: null });
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(30)).toBe(3_600_000);
  });

  it('sends again an email a crash left half-sent; the cloud answers a repeat without a second email', async () => {
    server.online = false;
    await app.connectivity.probe();
    await send({ channel: 'email', to: 'meena@example.com', message: 'Your bill.' });
    db.prepare(`UPDATE share_log SET status = 'sending'`).run();
    server.online = true;
    await app.connectivity.probe();
    await app.share.outbox.idle();
    expect(mails).toEqual([]);
    app.share.outbox.start(3_600_000);
    app.share.outbox.stop();
    await app.share.outbox.idle();
    expect(mails).toHaveLength(1);
    expect(db.prepare('SELECT status FROM share_log').pluck().get()).toBe('sent');
  });

  it('shares a customer statement with the balance due, and a credit note as its receipt', async () => {
    const cust = await api.data<SharePreview>('share.preview', { docType: 'customer_statement', id: customerId, channel: 'email' });
    expect(cust).toMatchObject({ to: 'meena@example.com', subject: 'Statement of account from Sharma Store', docLabel: 'Statement of account for Meena Gupta' });
    expect(cust.message).toBe('Dear Meena Gupta, your statement of account with Sharma Store is attached. Balance due: ₹100.00.');
    await api.data('share.send', { docType: 'customer_statement', id: customerId, channel: 'email', to: 'meena@example.com', message: cust.message });
    const statement = pdfText(mails[0]!.attachment.contentBase64);
    expect(statement).toMatch(/^%PDF-1\.7\n\{"kind":"a4","pageSize":"A4"\}[\s\S]*Statement of account/u);
    expect(statement).toContain('Customer: Meena Gupta');
    expect(statement).toContain(docNumber);
    expect(statement).toContain('To: 2026-10-12');

    // The period on screen is the statement's; the recipient never stands in for its end date.
    const period = { from: '2026-10-01', to: '2026-10-11' };
    const ranged = await api.data<SharePreview>('share.preview', { docType: 'customer_statement', id: customerId, channel: 'email', period });
    expect(ranged.message).toContain('from 01 Oct 2026 to 11 Oct 2026');
    clock += 1000;
    await api.data('share.send', { docType: 'customer_statement', id: customerId, channel: 'email', period, to: 'meena@example.com', message: ranged.message });
    const periodPdf = pdfText(mails[1]!.attachment.contentBase64);
    expect(periodPdf).toContain('From: 2026-10-01');
    expect(periodPdf).toContain('To: 2026-10-11');
    expect(periodPdf).not.toContain(docNumber);
    expect(mails[1]!.attachment.fileName).toBe('statement-Meena Gupta-2026-10-11.pdf');

    const note = await api.data<{ creditNoteId: string }>('sales.cancel', { saleId, reason: 'wrong bill' });
    const cn = await api.data<SharePreview>('share.preview', { docType: 'credit_note', id: note.creditNoteId, channel: 'whatsapp' });
    expect(cn).toMatchObject({ to: '9876543210' });
    expect(cn.docLabel).toMatch(/^Credit note /u);
    expect(cn.message).toContain(`for ₹100.00 against invoice ${docNumber}`);
    clock += 1000;
    await api.data('share.send', { docType: 'credit_note', id: note.creditNoteId, channel: 'email', to: 'meena@example.com', message: cn.message });
    expect(pdfText(mails[2]!.attachment.contentBase64)).toMatch(/^%PDF-1\.7\n\{"kind":"thermal","widthMm":80\}[\s\S]*CREDIT NOTE/u);
    expect((await api.data<SharePreview>('share.preview', { docType: 'customer_statement', id: customerId, channel: 'email' })).message)
      .toMatch(/The account is settled\.$/u);
  });

  it('checks the recipient, the size and who may share what', async () => {
    expect(await send({ channel: 'whatsapp', to: '12345', message: 'x' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { to: expect.any(String) } } });
    expect(await send({ channel: 'email', to: 'meena@', message: 'x' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { to: 'one email address' } } });
    pdfPadding = 1_048_576;
    expect(await send({ channel: 'email', to: 'meena@example.com', message: 'x' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'This PDF is too large to email' } });
    expect(db.prepare('SELECT COUNT(*) FROM share_log').pluck().get()).toBe(0);
    grantRole(db, app, 'inventory');
    expect(await api.call('share.preview', { ...invoice, id: saleId, channel: 'email' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await api.call('share.history', { docType: 'customer_statement', id: customerId })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'cashier');
    expect(await api.call('share.preview', { ...invoice, id: saleId, channel: 'whatsapp' })).toMatchObject({ ok: true });
    expect(await api.call('share.preview', { docType: 'customer_statement', id: customerId, channel: 'whatsapp' })).toMatchObject({ ok: true });
  });
});

describe('WhatsApp numbers', () => {
  it('normalises Indian mobiles to the country code and keeps international ones', () => {
    expect(['9876543210', '98765 43210', '098765-43210', '+91 98765 43210', '919876543210', '(+91) 98765.43210'].map(whatsappNumber)).toEqual(Array(6).fill('919876543210'));
    expect(whatsappNumber('+44 7700 900123')).toBe('447700900123');
    expect(['12345', '5876543210', 'abc', '+1', '', '+91 98765 43210 ext 4'].map(whatsappNumber)).toEqual(Array(6).fill(null));
  });
});
