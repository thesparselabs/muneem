import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompleteSaleResult, Customer, ProductHit, QuoteContext, RegisterReport, SaleQuote, TenderLine } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { api, errorMessage, isClientError } from '../../api.js';
import { formatPaise, formatRateBp, parseOptional, scaledToText } from '../../lib/money.js';
import { addHit, applyQuote, emptyCart, localTotals, removeLine, setLineDiscount, setQty, toDraft, type Cart } from '../../lib/pos/cart.js';
import { commandFor, type PendingCommand } from '../../lib/pos/payment.js';
import { retrieveHeldBill } from '../../lib/pos/retrieve.js';
import { useScanner } from '../../lib/pos/useScanner.js';
import { useDebounced } from '../../lib/useDebounced.js';
import CustomerDialog from './CustomerDialog.js';
import DiscountDialog from './DiscountDialog.js';
import HeldBillsDialog from './HeldBillsDialog.js';
import PaymentDialog from './PaymentDialog.js';
import { CashMovementDialog, CloseRegisterDialog, OpenRegister, ReportView, XReportDialog } from './RegisterPanel.js';
import Dialog from '../../components/Dialog.js';
import InvoicePreview from '../../components/InvoicePreview.js';
import StockStaleness from '../../components/StockStaleness.js';
import NumberTicker from '../../components/NumberTicker.js';
import SuccessCheck from '../../components/SuccessCheck.js';
import { useToasts } from '../../lib/toast.js';
import { CreditCard, Pause, Percent, Printer, RotateCcw, Wallet, FileBarChart, FileText, Lock } from 'lucide-react';

type Modal = 'customer' | 'discount' | 'payment' | 'held' | 'cash' | 'x' | 'close' | { lineDiscount: string } | null;
const NEAR_DUPLICATE_MS = 60_000;

export default function PosScreen() {
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ['posSession'], queryFn: () => api.pos.getSession({}) });
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [context, setContext] = useState<QuoteContext | null>(null);
  const [payTotal, setPayTotal] = useState<number | null>(null);
  const [payCredit, setPayCredit] = useState<SaleQuote['credit'] | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<{ result: CompleteSaleResult; customerId: string | null; at: number } | null>(null);
  const [zReport, setZReport] = useState<RegisterReport | null>(null);
  const [previewSaleId, setPreviewSaleId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const toast = useToasts((s) => s.push);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const quoteSeq = useRef(0);
  const pendingCommand = useRef<PendingCommand | null>(null);
  useEffect(() => { if (lastSale) search.current?.focus(); }, [lastSale]); // ready for the next customer

  // 8i: an update never installs while a bill is on screen.
  const cartLines = cart.lines.length;
  useEffect(() => { void api.pos.reportCart({ lines: cartLines }).catch(() => undefined); }, [cartLines]);
  useEffect(() => () => { void api.pos.reportCart({ lines: 0 }).catch(() => undefined); }, []);

  const requote = useCallback(async (next: Cart) => {
    if (next.lines.length === 0) return;
    const seq = ++quoteSeq.current;
    try {
      const q = await api.sales.quote(toDraft(next));
      if (seq !== quoteSeq.current) return;
      setContext(q.context);
      setCart((c) => (c.lines.length === next.lines.length ? applyQuote(c, q) : c));
    } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); }
  }, []);
  const update = useCallback((next: Cart) => { setCart(next); void requote(next); }, [requote]);

  const addProduct = useCallback((hit: ProductHit) => { setMessage(null); setCart((c) => { const next = addHit(c, hit); void requote(next); return next; }); }, [requote]);
  const onScan = useCallback(async (code: string) => {
    setQuery('');
    try {
      const hit = await api.products.lookupBarcode({ code });
      if (hit) addProduct(hit); else setMessage({ kind: 'error', text: `No product with barcode ${code}` });
    } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); }
  }, [addProduct]);
  useScanner((code) => void onScan(code), modal === null && !!session.data);

  async function startPayment() {
    if (cart.lines.length === 0) return;
    try {
      const q = await api.sales.quote(toDraft(cart));
      setContext(q.context);
      setCart((c) => applyQuote(c, q));
      if (q.issues.length > 0) { setMessage({ kind: 'error', text: q.issues.map((i) => i.message).join('; ') }); return; }
      const blocked = q.warnings.filter((w) => w.blocking);
      if (blocked.length > 0) { setMessage({ kind: 'error', text: `Not enough stock: ${blocked.map((w) => w.message).join('; ')}` }); return; }
      setPayTotal(q.totals.totalPaise);
      setPayCredit(q.credit ?? null);
      pendingCommand.current = commandFor(pendingCommand.current, JSON.stringify(toDraft(cart)), newUlid);
      setModal('payment');
    } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); }
  }

  async function complete(tenders: TenderLine[]) {
    if (payTotal === null) return;
    setBusy(true);
    try {
      const draft = toDraft(cart);
      pendingCommand.current = commandFor(pendingCommand.current, JSON.stringify(draft), newUlid);
      const result = await api.sales.complete({ ...draft, commandId: pendingCommand.current.id, tenders, expectedTotalPaise: payTotal });
      pendingCommand.current = null;
      setLastSale({ result, customerId: cart.customer?.id ?? null, at: Date.now() });
      setCart(emptyCart());
      setModal(null);
      setMessage({ kind: 'ok', text: `Saved ${result.docNumber}${result.changePaise ? ` · give change ${formatPaise(result.changePaise)}` : ''}` });
      setPaid(true);
      setTimeout(() => setPaid(false), 1100);
      toast(`Saved ${result.docNumber}`, 'success');
      void qc.invalidateQueries(); // a sale changes stock, balances and the books
    } catch (e) {
      setModal(null);
      setMessage({ kind: 'error', text: errorMessage(e) });
      if (isClientError(e) && e.code === 'TOTAL_MISMATCH') void requote(cart);
    } finally { setBusy(false); }
  }

  const nearDuplicate = lastSale && payTotal === lastSale.result.totals.totalPaise && (cart.customer?.id ?? null) === lastSale.customerId
    && Date.now() - lastSale.at < NEAR_DUPLICATE_MS ? `The last bill (${lastSale.result.docNumber}) was the same amount a moment ago. Check this is not a repeat.` : null;

  async function hold() {
    if (cart.lines.length === 0) return;
    try {
      await api.pos.holdBill({ cart: toDraft(cart), ...(cart.customer && { label: cart.customer.name }) });
      setCart(emptyCart());
      setMessage({ kind: 'ok', text: 'Bill held. Press F7 to bring it back.' });
    } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); }
  }

  async function retrieve(id: string, holdCurrent: boolean) {
    setModal(null);
    if (holdCurrent && cart.lines.length > 0) {
      try { await api.pos.holdBill({ cart: toDraft(cart), ...(cart.customer && { label: cart.customer.name }) }); } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); return; }
    }
    const r = await retrieveHeldBill({
      getHeldBill: (billId) => api.pos.getHeldBill({ id: billId }),
      getCustomer: (customerId) => api.customers.get({ id: customerId }),
      quote: (draft) => api.sales.quote(draft),
      discardBill: (billId) => api.pos.discardBill({ id: billId }),
    }, id);
    if (!r.ok) { setMessage({ kind: 'error', text: r.error }); return; }
    setContext(r.quote.context);
    setCart(r.cart);
    setMessage(r.notes.length > 0 ? { kind: 'error', text: r.notes.join(' ') } : { kind: 'ok', text: 'Bill retrieved.' });
  }

  async function reprintLast() {
    if (!lastSale) return;
    try { await api.printer.reprint({ saleId: lastSale.result.saleId }); setMessage({ kind: 'ok', text: `Reprinting ${lastSale.result.docNumber}` }); } catch (e) { setMessage({ kind: 'error', text: errorMessage(e) }); }
  }

  useEffect(() => {
    if (!session.data || modal !== null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const keys: Record<string, () => void> = {
        F2: () => search.current?.focus(), F3: () => setModal('customer'), F4: () => setModal('discount'), F5: () => void startPayment(),
        F6: () => void hold(), F7: () => setModal('held'), F9: () => void reprintLast(),
        Escape: () => { if (cart.lines.length > 0) { setCart(emptyCart()); setMessage({ kind: 'ok', text: 'Cart cleared' }); } },
      };
      const action = keys[e.key];
      if (action) { e.preventDefault(); action(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (session.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (zReport) return <div className="card max-w-md space-y-4"><ReportView report={zReport} /><button className="btn-primary" onClick={() => setZReport(null)}>Done</button></div>;
  if (!session.data) return <OpenRegister onOpened={() => void qc.invalidateQueries({ queryKey: ['posSession'] })} />;

  const totals = localTotals(cart, context);
  return (
    <div className="grid h-full grid-cols-[1fr_340px] gap-4">
      <section className="flex min-h-0 flex-col gap-3">
        <ProductSearch inputRef={search} query={query} setQuery={setQuery} onPick={addProduct} />
        {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-green-800' : 'text-red-700'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
        <PrinterBanner />
        <CartTable cart={cart} onQty={(key, q) => update(setQty(cart, key, q))} onRemove={(key) => update(removeLine(cart, key))} onDiscount={(key) => setModal({ lineDiscount: key })} />
      </section>
      <aside className="flex flex-col gap-3">
        <StockStaleness />
        <div className="card text-sm">
          <p className="text-slate-500">Customer (F3)</p>
          <p className="font-medium">{cart.customer ? `${cart.customer.name}${cart.customer.gstin ? ` · ${cart.customer.gstin}` : ''}` : 'Walk-in'}</p>
        </div>
        <div className="card space-y-1 text-sm tabular-nums">
          <Row label="Items" value={String(cart.lines.length)} />
          {totals && <>
            <Row label="Gross" value={formatPaise(totals.grossPaise)} />
            {totals.lineDiscountPaise + totals.billDiscountPaise > 0 && <Row label="Discount" value={`-${formatPaise(totals.lineDiscountPaise + totals.billDiscountPaise)}`} />}
            <Row label="Taxable" value={formatPaise(totals.taxablePaise)} />
            <Row label="GST" value={formatPaise(totals.cgstPaise + totals.sgstPaise + totals.igstPaise + totals.cessPaise)} />
            {totals.roundOffPaise !== 0 && <Row label="Round off" value={formatPaise(totals.roundOffPaise)} />}
          </>}
          <div className="flex justify-between border-t pt-2 text-2xl font-semibold"><span>Total</span><NumberTicker value={totals?.totalPaise ?? 0} format={(n) => formatPaise(Math.round(n))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button className="btn-primary col-span-2 gap-2 py-3 text-base" onClick={() => void startPayment()} disabled={cart.lines.length === 0}><Wallet size={18} aria-hidden /> Pay (F5)</button>
          <button className="btn-secondary gap-1.5" onClick={() => setModal('discount')}><Percent size={14} aria-hidden /> Bill discount (F4)</button>
          <button className="btn-secondary gap-1.5" onClick={() => void hold()}><Pause size={14} aria-hidden /> Hold (F6)</button>
          <button className="btn-secondary gap-1.5" onClick={() => setModal('held')}><RotateCcw size={14} aria-hidden /> Held bills (F7)</button>
          <button className="btn-secondary gap-1.5" onClick={() => void reprintLast()} disabled={!lastSale}><Printer size={14} aria-hidden /> Reprint last (F9)</button>
          <button className="btn-secondary gap-1.5" onClick={() => lastSale && setPreviewSaleId(lastSale.result.saleId)} disabled={!lastSale}><FileText size={14} aria-hidden /> Invoice</button>
          <button className="btn-secondary gap-1.5" onClick={() => setModal('cash')}><CreditCard size={14} aria-hidden /> Cash in/out</button>
          <button className="btn-secondary gap-1.5" onClick={() => setModal('x')}><FileBarChart size={14} aria-hidden /> X report</button>
          <button className="btn-secondary gap-1.5" onClick={() => setModal('close')}><Lock size={14} aria-hidden /> Close register</button>
          <Link className="btn-secondary gap-1.5" to="/settings/printer"><Printer size={14} aria-hidden /> Printer</Link>
        </div>
      </aside>

      {modal === 'customer' && <CustomerDialog onClose={() => setModal(null)} onPick={(c: Customer | null) => { setModal(null); update({ ...cart, customer: c }); }} />}
      {modal === 'discount' && <DiscountDialog title="Bill discount (F4)" current={cart.billDiscount} onClose={() => setModal(null)} onApply={(d) => { setModal(null); update({ ...cart, billDiscount: d }); }} />}
      {modal && typeof modal === 'object' && (
        <DiscountDialog title="Line discount" current={cart.lines.find((l) => l.key === modal.lineDiscount)?.lineDiscount ?? { kind: 'amount', value: 0 }}
          onClose={() => setModal(null)} onApply={(d) => { setModal(null); update(setLineDiscount(cart, modal.lineDiscount, d)); }} />
      )}
      {modal === 'payment' && payTotal !== null && <PaymentDialog totalPaise={payTotal} credit={payCredit} busy={busy} warning={nearDuplicate} onClose={() => setModal(null)} onPay={(t) => void complete(t)} />}
      {modal === 'held' && <HeldBillsDialog cartInUse={cart.lines.length > 0} onClose={() => setModal(null)} onRetrieve={(id, holdCurrent) => void retrieve(id, holdCurrent)} />}
      {modal === 'cash' && <CashMovementDialog onClose={() => setModal(null)} />}
      {modal === 'x' && <XReportDialog onClose={() => setModal(null)} />}
      {modal === 'close' && <CloseRegisterDialog onClose={() => setModal(null)} onClosed={(z) => { setModal(null); setZReport(z); void qc.invalidateQueries({ queryKey: ['posSession'] }); }} />}
      {previewSaleId && <InvoicePreview saleId={previewSaleId} onClose={() => setPreviewSaleId(null)} />}
      {paid && <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center" aria-hidden><SuccessCheck size={88} /></div>}
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between"><span className="text-slate-600">{label}</span><span>{value}</span></div>;

function ProductSearch({ inputRef, query, setQuery, onPick }: { inputRef: RefObject<HTMLInputElement>; query: string; setQuery: (q: string) => void; onPick: (h: ProductHit) => void }) {
  const q = useDebounced(query.trim(), 120);
  const hits = useQuery({ queryKey: ['posSearch', q], queryFn: () => api.products.search({ query: q, limit: 8 }), enabled: q.length > 0 });
  const pick = (h: ProductHit) => { onPick(h); setQuery(''); };
  return (
    <div className="relative">
      <label className="label" htmlFor="pos-search">Scan or search a product (F2)</label>
      <input id="pos-search" ref={inputRef} data-scan-target="true" className="input text-base" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus autoComplete="off"
        onKeyDown={(e) => { if (e.key === 'Enter' && hits.data?.[0]) { e.preventDefault(); pick(hits.data[0]); } }} />
      {q && hits.data && hits.data.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full divide-y rounded-md border bg-white text-sm shadow">
          {hits.data.map((h) => (
            <li key={`${h.productId}-${h.uomId}`}><button type="button" className="flex w-full justify-between px-3 py-2 text-left hover:bg-blue-50" onClick={() => pick(h)}>
              <span>{h.name} <span className="text-slate-500">{h.sku}</span></span><span className="tabular-nums">{formatPaise(h.pricePaise)} /{h.uomCode} <span className={`text-xs ${h.stockMilli <= 0 ? 'text-red-700' : 'text-slate-500'}`}>· {scaledToText(h.stockMilli, 3)} {h.baseUomCode} in stock</span></span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CartTable({ cart, onQty, onRemove, onDiscount }: { cart: Cart; onQty: (key: string, qtyMilli: number) => void; onRemove: (key: string) => void; onDiscount: (key: string) => void }) {
  if (cart.lines.length === 0) return <p className="card text-sm text-slate-600">Scan a barcode or search to start a bill.</p>;
  return (
    <div className="min-h-0 overflow-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Item</th><th className="p-2 w-28">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">GST</th><th className="p-2 text-right">Discount</th><th className="p-2" /></tr></thead>
        <tbody>
          {cart.lines.map((l) => (
            <tr key={l.key} className="border-t animate-[row-in_0.8s_ease-out]">
              <td className="p-2">{l.name}{l.issue && <p className="err mt-0">{l.issue}</p>}
                {l.stockWarning && <p className={`mt-0 text-xs ${l.stockWarning.blocking ? 'text-red-700' : 'text-amber-800'}`}>{l.stockWarning.message}</p>}</td>
              <td className="p-2"><QtyInput qtyMilli={l.qtyMilli} uomCode={l.uomCode} onChange={(q) => onQty(l.key, q)} /></td>
              <td className="p-2 text-right tabular-nums">{formatPaise(l.pricing?.unitPricePaise ?? null)}</td>
              <td className="p-2 text-right">{l.pricing ? formatRateBp(l.pricing.gstRateBp) : ''}</td>
              <td className="p-2 text-right"><button type="button" className="text-blue-800 underline" onClick={() => onDiscount(l.key)}>{l.lineDiscount.value ? (l.lineDiscount.kind === 'percent' ? formatRateBp(l.lineDiscount.value) : formatPaise(l.lineDiscount.value)) : 'Add'}</button></td>
              <td className="p-2 text-right"><button type="button" className="btn-secondary py-1" onClick={() => onRemove(l.key)} aria-label={`Remove ${l.name}`}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QtyInput({ qtyMilli, uomCode, onChange }: { qtyMilli: number; uomCode: string; onChange: (q: number) => void }) {
  const [text, setText] = useState(scaledToText(qtyMilli, 3));
  useEffect(() => setText(scaledToText(qtyMilli, 3)), [qtyMilli]);
  const commit = () => { const q = parseOptional(text, 3); if (q && q > 0) onChange(q); else setText(scaledToText(qtyMilli, 3)); };
  return (
    <span className="flex items-center gap-1">
      <input aria-label="Quantity" className="input w-20 py-1" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      <span className="text-xs text-slate-500">{uomCode}</span>
    </span>
  );
}

function PrinterBanner() {
  const queue = useQuery({ queryKey: ['printQueue'], queryFn: () => api.printer.getQueue({ limit: 5 }), refetchInterval: 10_000 });
  const failed = queue.data?.find((j) => j.status === 'failed');
  const qc = useQueryClient();
  const [details, setDetails] = useState(false);
  if (!failed) return null;
  return (
    <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
      <span>Receipt not printed: {failed.errorMessage ?? 'printer problem'}. The sale is saved.</span>
      <span className="flex gap-2">
        <button className="btn-secondary py-1" onClick={() => void api.printer.retryJob({ jobId: failed.id }).then(() => qc.invalidateQueries({ queryKey: ['printQueue'] }))}>Retry</button>
        <button className="btn-secondary py-1" onClick={() => setDetails(true)}>Details</button>
      </span>
      {details && <Dialog title="Print queue" onClose={() => setDetails(false)}><ul className="text-sm">{queue.data?.map((j) => <li key={j.id}>{j.status} · copy {j.copyNo} · {j.errorMessage ?? ''}</li>)}</ul></Dialog>}
    </div>
  );
}
