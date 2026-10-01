import { SaleDraft, type HeldBill } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { insertHeldBill, listHeldBills, takeHeldBill, type HeldBillRow } from '@muneem/db-sqlite';
import type { PosContext } from './posContext.js';
import type { RegisterService } from './register.js';

const toHeldBill = (r: HeldBillRow): HeldBill => {
  const cart = SaleDraft.parse(JSON.parse(r.cartJson));
  return { id: r.id, heldAt: r.heldAt, heldBy: r.heldBy, lineCount: cart.lines.length, cart, ...(r.label && { label: r.label }) };
};

// A held cart keeps products and quantities only; prices are worked out again when it comes back.
export class HeldBillService {
  constructor(private readonly ctx: PosContext, private readonly register: RegisterService) {}

  hold(label: string | undefined, cart: SaleDraft): HeldBill {
    const session = this.register.requireOpen();
    const till = this.ctx.till();
    const id = newUlid();
    insertHeldBill(this.ctx.db(), {
      id, businessId: till.businessId, terminalId: till.terminalId, sessionId: session.id, label: label ?? null,
      cartJson: JSON.stringify(cart), heldBy: this.ctx.userId(),
    });
    return this.list().find((b) => b.id === id)!;
  }

  list(): HeldBill[] {
    const till = this.ctx.till();
    return listHeldBills(this.ctx.db(), till.businessId, till.terminalId).map(toHeldBill);
  }

  take(id: string): HeldBill {
    const till = this.ctx.till();
    const row = takeHeldBill(this.ctx.db(), till.businessId, till.terminalId, id);
    if (!row) throw new Error('NOT_FOUND');
    return toHeldBill(row);
  }
}
