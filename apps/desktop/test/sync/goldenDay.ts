import { newUlid } from '@muneem/domain';
import {
  CompleteSaleInput, CreatePurchaseInput, CustomerInput, ExpenseInput, ManualJournalInput, PaymentInput, ProductInput, ProductUpdate, ReturnPurchaseInput, SaleDraft,
  SupplierInput, WriteOffInput,
} from '@muneem/contracts';
import { findUomByCode, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill } from '../helpers.js';

const complete = (app: App, draft: SaleDraft, tenders: (total: number) => CompleteSaleInput['tenders']) => {
  const total = app.sales.quote(draft).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: tenders(total) }));
};

// The two golden flows (Stages 3–6) in one day on one device, through the services: catalog, stock, billing, parties and the books.
export async function goldenDay(app: App, db: Db): Promise<{ businessId: string; soapId: string }> {
  const { businessId } = await ownerAtTill(app);
  await caller(app).data('printer.setConfig', { kind: 'none' });
  const today = new Date().toLocaleDateString('en-CA');
  const pcs = (app.catalog.listUoms().find((u) => u.code === 'PCS'))!.id;
  const box = findUomByCode(db, businessId, 'BOX')!.id;
  const parle = app.products.create(ProductInput.parse({ name: 'Parle-G 100g', baseUomId: pcs, gstRateBp: 500, mrpPaise: 1000, sellingPricePaise: 1000, barcodes: [{ code: '8901030865275' }] }));
  const soap = app.products.create(ProductInput.parse({
    name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4500, conversions: [{ fromUomId: box, factorMilli: 12_000 }], barcodes: [{ code: 'SOAP1' }],
  }));
  app.inventory.setOpeningStock({ lines: [{ productId: parle.id, qtyMilli: 50_000, unitCostPaise: 800 }, { productId: soap.id, qtyMilli: 30_000, unitCostPaise: 3000 }] });

  await app.register.open(200_000);
  const meena = app.customers.create(CustomerInput.parse({ name: 'Meena Iyer', phone: '9876500000', creditDays: 15 }));
  const limited = app.customers.setCreditLimit({ id: meena.id, version: meena.version, limitPaise: 100_000 });
  complete(app, SaleDraft.parse({ customerId: meena.id, lines: [{ productId: parle.id, uomId: pcs, qtyMilli: 3000 }, { productId: soap.id, uomId: pcs, qtyMilli: 1000 }], billDiscount: { kind: 'amount', value: 500 } }),
    (t) => [{ method: 'upi', amountPaise: 1000, reference: 'UPI-55' }, { method: 'cash', amountPaise: t - 1000 + 2000 }]);
  const credit = complete(app, SaleDraft.parse({ customerId: limited.id, lines: [{ productId: soap.id, uomId: box, qtyMilli: 1000 }] }), (t) => [{ method: 'cash', amountPaise: t - 30_000 }, { method: 'credit', amountPaise: 30_000 }]);
  app.writeOffs.create(WriteOffInput.parse({ customerId: limited.id, items: [{ type: 'sale', id: credit.saleId, amountPaise: 100 }], reason: 'not recoverable', commandId: newUlid() }));
  app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: meena.id, amountPaise: 40_000, method: 'cash', commandId: newUlid() }));

  const acme = app.suppliers.create(SupplierInput.parse({ name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', creditDays: 30 }));
  app.supplierLedger.setOpening({ partyId: acme.id, amountPaise: 50_000, asOfDate: today });
  const purchase = app.purchases.create(CreatePurchaseInput.parse({
    supplierId: acme.id, supplierInvoiceNo: 'A-77', supplierInvoiceDate: today, commandId: newUlid(), billTotalPaise: 115_000,
    lines: [{ productId: parle.id, uomId: pcs, qtyMilli: 100_000, unitPricePaise: 1000 }], charges: [{ kind: 'freight', amountPaise: 10_000 }],
  }));
  app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({ purchaseId: purchase.id, reason: 'torn packs', commandId: newUlid(), lines: [{ purchaseItemId: purchase.lines[0]!.id, qtyMilli: 2000 }] }));
  app.payments.create(PaymentInput.parse({ partyType: 'supplier', partyId: acme.id, amountPaise: 100_000, method: 'cash', commandId: newUlid() }));
  const other = app.expenses.categories().find((c) => c.code === 'OTHER')!;
  app.expenses.create(ExpenseInput.parse({ categoryId: other.id, method: 'cash', amountPaise: 20_000, description: 'Tea', commandId: newUlid() }));
  app.expenses.create(ExpenseInput.parse({ categoryId: other.id, method: 'credit', supplierId: acme.id, amountPaise: 30_000, gstRateBp: 1800, commandId: newUlid() }));
  const bounced = app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: meena.id, amountPaise: 5_000, method: 'cheque', commandId: newUlid() }));
  app.payments.cancel(bounced.id, 'cheque bounced');
  app.register.cashMovement({ kind: 'cash_out', amountPaise: 5000, reason: 'delivery boy' });
  const accounts = new Map(app.statements.accounts().map((a) => [a.code, a.id]));
  app.manualJournals.post(ManualJournalInput.parse({ narration: 'Owner drawings', commandId: newUlid(), lines: [{ accountId: accounts.get('3200')!, debitPaise: 1000, creditPaise: 0 }, { accountId: accounts.get('1100')!, debitPaise: 0, creditPaise: 1000 }] }));
  const x = app.register.xReport();
  app.register.close({ countedCashPaise: (x.expectedCashPaise ?? 0) + 300 });
  const p = app.products.get(parle.id);
  app.products.update(ProductUpdate.parse({ ...p, name: 'Parle-G Gold 100g', sellingPricePaise: 950, barcodes: p.barcodes.map((b) => ({ code: b.code })), conversions: [] }));
  return { businessId, soapId: soap.id };
}
