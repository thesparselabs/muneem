import { claimDueEmail, claimEmail, requeueSending, settleShare, type Db, type QueuedEmail, type ShareOutcome } from '@muneem/db-sqlite';
import type { MailResult, ShareMailer } from './cloudMailer.js';

export interface EmailOutboxDeps {
  db: () => Db;
  mailer: ShareMailer;
  // Only the open business's emails go out: the cloud checks the signed-in user is its member.
  businessId: () => string | null;
  shop: () => { name: string; email?: string | undefined };
  online: () => boolean;
  now: () => number;
  log: (err: unknown) => void;
}

export const MAX_EMAIL_ATTEMPTS = 24;
const FIRST_RETRY_MS = 30_000;
const LONGEST_WAIT_MS = 3_600_000;

// 30 s, 1 min, 2 min … then hourly, so a day offline still delivers.
export const retryDelayMs = (attempts: number): number => Math.min(LONGEST_WAIT_MS, FIRST_RETRY_MS * 2 ** Math.max(0, attempts - 1));

// FR-085 (ADR-0067): emails wait in share_log and go out through the cloud when it can be reached, at most once at a time.
export class EmailOutbox {
  private running: Promise<void> | null = null;
  private again = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly d: EmailOutboxDeps) {}

  start(everyMs = 60_000): void {
    requeueSending(this.d.db(), this.at());
    this.drain();
    this.timer = setInterval(() => this.drain(), everyMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // The one email just queued, tried now so the share dialog can say "sent"; offline it simply waits.
  async sendNow(id: string): Promise<void> {
    const businessId = this.d.businessId();
    if (!businessId || !this.d.online()) return;
    const email = claimEmail(this.d.db(), businessId, id, this.at());
    if (email) await this.attempt(email);
  }

  drain(): void {
    if (this.running) { this.again = true; return; }
    this.running = this.loop().finally(() => { this.running = null; });
  }

  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  private async loop(): Promise<void> {
    do {
      this.again = false;
      const businessId = this.d.businessId();
      if (!businessId || !this.d.online()) return;
      for (let email = claimDueEmail(this.d.db(), businessId, this.at()); email; email = claimDueEmail(this.d.db(), businessId, this.at())) {
        await this.attempt(email);
      }
    } while (this.again);
  }

  private async attempt(e: QueuedEmail): Promise<void> {
    const shop = this.d.shop();
    let result: MailResult;
    try {
      result = await this.d.mailer.send({
        shareId: e.id, businessId: e.businessId, to: e.recipient, replyTo: shop.email, fromName: shop.name, subject: e.subject, text: e.message,
        fileName: e.fileName, pdf: e.pdf,
      });
    } catch (err) {
      this.d.log(err);
      result = { ok: false, retry: true, error: String(err) };
    }
    settleShare(this.d.db(), e.id, this.outcome(result, e.attempts + 1), this.at());
  }

  private outcome(r: MailResult, tries: number): ShareOutcome {
    if (r.ok) return { status: 'sent', sentAt: r.sentAt };
    if (r.retry && tries < MAX_EMAIL_ATTEMPTS) return { status: 'queued', nextAttemptAt: new Date(this.d.now() + retryDelayMs(tries)).toISOString(), error: r.error };
    return { status: 'failed', error: r.error };
  }

  private at(): string { return new Date(this.d.now()).toISOString(); }
}
