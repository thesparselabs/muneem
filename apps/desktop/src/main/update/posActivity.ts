// Ringing up or settling a bill, or working the register; reads and the update channels themselves do not count.
const POS_WORK = /^(sales\.(quote|complete|cancel)|returns\.(quote|complete)|pos\.(openRegister|cashMovement|closeRegister|holdBill|discardBill)|drawer\.open|printer\.reprint)$/u;
const NOT_A_COMMAND = /^(update\.|pos\.reportCart$)/u;

export interface PosActivitySnapshot { cartLines: number; commandsInFlight: number; lastActivityAt: number }

// What main can see of the till: the cart the POS screen reports, IPC commands still running, and the last POS action.
export class PosActivity {
  private cartLines = 0;
  private inFlight = 0;
  private lastActivityAt: number;

  constructor(private readonly now: () => number) {
    this.lastActivityAt = now();
  }

  reportCart(lines: number): void {
    if (lines > 0 || this.cartLines > 0) this.touch();
    this.cartLines = lines;
  }

  // The cart dies with the session or the window, so neither leaves the till looking busy for ever.
  clearCart(): void { this.cartLines = 0; }

  dispatch(channel: string): () => void {
    if (POS_WORK.test(channel)) this.touch();
    if (NOT_A_COMMAND.test(channel)) return () => undefined;
    this.inFlight++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.inFlight--;
      if (POS_WORK.test(channel)) this.touch();
    };
  }

  snapshot(): PosActivitySnapshot {
    return { cartLines: this.cartLines, commandsInFlight: this.inFlight, lastActivityAt: this.lastActivityAt };
  }

  private touch(): void { this.lastActivityAt = this.now(); }
}
