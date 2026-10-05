import { CustomerInput, ProductInput, SupplierInput } from '@muneem/contracts';
import { createCustomer, createProduct, findUomByCode, setCustomerCreditLimit, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill } from '../helpers.js';
import type { Prng } from '../soak/generator.js';

export interface ScaleSize { products: number; customers: number; sales: number; days: number }
export interface ScaleShop {
  businessId: string; warehouseId: string; pcs: string; suppliers: string[];
  products: { id: string; name: string; barcode: string; costPaise: number }[];
  customers: { id: string; name: string; phone: string }[];
}

// Products in the same class share price, rate and cost, so a cloned bill can swap one for another and stay exact.
export const PRICE_CLASSES = 20;
const GST_RATES = [0, 500, 1200, 1800];
const BRANDS = ['Tata', 'Amul', 'Parle', 'Britannia', 'Haldiram', 'Nestle', 'Dabur', 'Patanjali', 'Fortune', 'Aashirvaad', 'Surf', 'Lux', 'Colgate', 'Maggi', 'Kissan', 'Lipton', 'Bru', 'Dettol', 'Vim', 'Everest'];
const ITEMS = ['Salt', 'Milk', 'Biscuit', 'Atta', 'Namkeen', 'Noodles', 'Honey', 'Ghee', 'Tea', 'Coffee', 'Oil', 'Soap', 'Toothpaste', 'Ketchup', 'Rice', 'Dal', 'Sugar', 'Juice', 'Chips', 'Masala'];
const SIZES = ['100g', '200g', '500g', '1kg', '2kg', '5kg', '250ml', '500ml', '1L', 'Pack of 4'];
const FIRST = ['Ramesh', 'Suresh', 'Anita', 'Priya', 'Vikram', 'Sunita', 'Amit', 'Kavita', 'Rahul', 'Neha', 'Sanjay', 'Pooja', 'Deepak', 'Meena', 'Arjun', 'Lakshmi', 'Manoj', 'Geeta', 'Rakesh', 'Asha'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Agarwal', 'Jain', 'Mehta', 'Patel', 'Yadav', 'Mishra', 'Reddy', 'Nair', 'Iyer', 'Bansal'];
const SUPPLIERS = ['Acme Traders', 'Bharat Wholesale', 'Delhi Distributors', 'Gupta Supply', 'National FMCG'];

export const classOf = (productIndex: number) => productIndex % PRICE_CLASSES;
const priceOf = (cls: number) => 1_000 + cls * 2_500;
const rateOf = (cls: number) => GST_RATES[cls % GST_RATES.length]!;
export const costOf = (cls: number) => Math.round(((priceOf(cls) * 10_000) / (10_000 + rateOf(cls))) * 0.7);

export function ean13(n: number): string {
  const body = `890${String(n).padStart(9, '0')}`;
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return body + String((10 - (sum % 10)) % 10);
}

const productName = (i: number) => `${BRANDS[i % BRANDS.length]} ${ITEMS[Math.floor(i / BRANDS.length) % ITEMS.length]} ${SIZES[Math.floor(i / 400) % SIZES.length]} ${Math.floor(i / 4000) + 1}`;

// The catalogue, customers and suppliers go in through the repositories; the opening stock through the inventory service.
export async function setUpScaleShop(app: App, db: Db, size: ScaleSize, rng: Prng, today: string): Promise<ScaleShop> {
  const { businessId } = await ownerAtTill(app);
  await caller(app).data('printer.setConfig', { kind: 'none' });
  const pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  const products = withTransaction(db, () => Array.from({ length: size.products }, (_, i) => {
    const cls = classOf(i);
    const name = productName(i);
    const barcode = ean13(i + 1);
    const p = createProduct(db, businessId, ProductInput.parse({
      name, sku: `SKU${i + 1}`, baseUomId: pcs, gstRateBp: rateOf(cls), sellingPricePaise: priceOf(cls), purchasePricePaise: costOf(cls), priceIsInclusive: true,
      reorderLevelMilli: i % 97 === 0 ? 2_000_000 : 5_000, barcodes: [{ code: barcode, isPrimary: true }],
    }), actor, today);
    return { id: p.id, name, barcode, costPaise: costOf(cls) };
  }));
  const customers = withTransaction(db, () => Array.from({ length: size.customers }, (_, i) => {
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]} ${Math.floor(i / 300) + 1}`;
    const phone = `9${String(100_000_000 + i * 7).slice(-9)}`;
    const c = createCustomer(db, businessId, CustomerInput.parse({ name, phone, creditDays: 30 }), actor);
    setCustomerCreditLimit(db, c.id, c.version, 100_000_000, actor);
    return { id: c.id, name, phone };
  }));
  const suppliers = SUPPLIERS.map((name, i) => app.suppliers.create(SupplierInput.parse({ name, stateCode: '07', gstin: `07${'ABCDE'[i]!.repeat(5)}0000${'ABCDE'[i]}1Z5`, creditDays: 0 })).id);
  const warehouseId = app.inventory.warehouseId();
  for (let i = 0; i < products.length; i += 5_000) {
    app.inventory.setOpeningStock({ note: 'Opening count', lines: products.slice(i, i + 5_000).map((p) => ({ productId: p.id, qtyMilli: 2_000_000, unitCostPaise: p.costPaise })) });
  }
  app.register.open(rng.int(20, 50) * 10_000);
  return { businessId, warehouseId, pcs, suppliers, products, customers };
}
