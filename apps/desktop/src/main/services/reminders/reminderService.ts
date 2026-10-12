import {
  AppError, type Customer, type DueReminder, type DueReminders, type ReminderHistoryInput, type ReminderPreview, type ReminderRecord, type SendReminderInput,
  type SendShareInput, type SharePreview, type SharePreviewInput, type ShareRecord,
} from '@muneem/contracts';
import { addDays, formatRupees as rupees, newUlid } from '@muneem/domain';
import { hasReminderConsent, insertReminder, lastReceiptOn, lastReminderAt, listReminders, partyBalance, partyDues, type Db, type PartyDue } from '@muneem/db-sqlite';
import { fmtDate } from '../invoice/templates/base.js';

export interface ReminderServiceDeps {
  db: () => Db;
  businessId: () => string;
  userId: () => string;
  now: () => number;
  everyDays: () => number;
  shopName: () => string;
  customer: (id: string) => Customer;
  share: { preview(i: SharePreviewInput): SharePreview; send(i: SendShareInput): Promise<ShareRecord> };
}

const localDate = (ms: number): string => new Date(ms).toLocaleDateString('en-CA');
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// FR-088 (ADR-0070): who is past due (the party ageing the overdue notifications use), whether a reminder may go today,
// and sending one over WhatsApp with the statement through the share module.
export class ReminderService {
  constructor(private readonly d: ReminderServiceDeps) {}

  due(): DueReminders {
    const everyDays = this.d.everyDays();
    const today = localDate(this.d.now());
    return { everyDays, items: partyDues(this.d.db(), this.d.businessId(), 'customer', today).map((due) => this.reminderFor(due, everyDays, today)) };
  }

  preview(customerId: string): ReminderPreview {
    const due = this.dueFor(customerId);
    const statement = this.d.share.preview({ docType: 'customer_statement', id: customerId, channel: 'whatsapp' });
    return { to: due.phone ?? '', message: this.message(due), fileName: statement.fileName };
  }

  async send(i: SendReminderInput): Promise<ReminderRecord> {
    const due = this.dueFor(i.customerId);
    if (due.state === 'no_consent') {
      throw new AppError('INVALID_STATE', `${due.name} has not agreed to payment reminders on WhatsApp; record their consent on their page first`);
    }
    if (due.state !== 'due') {
      const recent = due.state === 'paid_recently' ? `paid on ${fmtDate(due.lastPaidOn!)}` : `was reminded on ${fmtDate(localDate(Date.parse(due.lastRemindedAt!)))}`;
      throw new AppError('INVALID_STATE', `${due.name} ${recent}; the next reminder can go on ${fmtDate(due.nextOn!)}`);
    }
    const share = await this.d.share.send({ docType: 'customer_statement', id: i.customerId, channel: 'whatsapp', to: i.to, message: i.message });
    const id = newUlid();
    insertReminder(this.d.db(), {
      id, businessId: this.d.businessId(), customerId: i.customerId, recipient: share.to, shareId: share.id, overduePaise: due.overduePaise,
      balancePaise: due.balancePaise, oldestDueDate: due.oldestDueDate, createdBy: this.d.userId(),
    }, new Date(this.d.now()).toISOString());
    return listReminders(this.d.db(), this.d.businessId(), { customerId: i.customerId, limit: 1 })[0]!;
  }

  history(f: ReminderHistoryInput): ReminderRecord[] {
    return listReminders(this.d.db(), this.d.businessId(), f);
  }

  private dueFor(customerId: string): DueReminder {
    const due = this.due().items.find((d) => d.customerId === customerId);
    if (!due) throw new AppError('INVALID_STATE', 'Nothing is overdue on this customer\'s account');
    return due;
  }

  // One reminder per cadence, and none for a cadence after the customer last paid; without consent, none at all.
  private reminderFor(due: PartyDue, everyDays: number, today: string): DueReminder {
    const db = this.d.db();
    const businessId = this.d.businessId();
    const customer = this.d.customer(due.partyId);
    const remindedAt = lastReminderAt(db, businessId, due.partyId);
    const paidOn = lastReceiptOn(db, businessId, due.partyId);
    const afterReminder = remindedAt ? addDays(localDate(Date.parse(remindedAt)), everyDays) : null;
    const afterPayment = paidOn ? addDays(paidOn, everyDays) : null;
    const state = !hasReminderConsent(db, due.partyId, 'whatsapp') ? 'no_consent'
      : afterReminder && afterReminder > today ? 'reminded_recently' : afterPayment && afterPayment > today ? 'paid_recently' : 'due';
    const nextOn = [afterReminder, afterPayment].filter((d): d is string => !!d && d > today).sort().at(-1);
    return {
      customerId: due.partyId, name: due.name, overduePaise: due.duePaise, oldestDueDate: due.oldestDueDate, documents: due.documents,
      balancePaise: partyBalance(db, { businessId, partyType: 'customer', partyId: due.partyId }), daysOverdue: daysBetween(due.oldestDueDate, today), state,
      ...(customer.phone && { phone: customer.phone }), ...(remindedAt && { lastRemindedAt: remindedAt }), ...(paidOn && { lastPaidOn: paidOn }),
      ...(nextOn && state !== 'due' && state !== 'no_consent' && { nextOn }),
    };
  }

  private message(due: DueReminder): string {
    return `Dear ${due.name}, a gentle reminder from ${this.d.shopName()}: ${rupees(due.overduePaise)} on your account has been due since `
      + `${fmtDate(due.oldestDueDate)}. Your balance is ${rupees(due.balancePaise)}; your statement is attached. Please pay at your earliest convenience. Thank you!`;
  }
}
