import {
  AppError, SHARE_EMAIL_MAX_PDF_BYTES, type Permission, type SendShareInput, type ShareDocType, type ShareHistoryInput, type SharePreview, type SharePreviewInput,
  type ShareRecord,
} from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { getShare, insertShare, listShares, type Db } from '@muneem/db-sqlite';
import { SHARE_PERMISSION, type ShareDocuments, type SharedDocument } from './documents.js';
import type { EmailOutbox } from './emailOutbox.js';
import { recipientFor, whatsappLink } from './recipient.js';

export interface ShareServiceDeps {
  db: () => Db;
  documents: ShareDocuments;
  outbox: Pick<EmailOutbox, 'sendNow'>;
  can: (p: Permission) => boolean;
  businessId: () => string;
  userId: () => string;
  openExternal: (url: string) => Promise<void>;
  saveDownload: (fileName: string, bytes: Buffer) => Promise<{ saved: boolean; fileName: string }>;
  now: () => number;
}

// FR-085 (ADR-0067): WhatsApp opens a chat with the message and leaves the PDF in Downloads to attach; email is queued
// with its PDF and sent through the cloud, at once when online.
export class ShareService {
  constructor(private readonly d: ShareServiceDeps) {}

  preview(i: SharePreviewInput): SharePreview {
    const doc = this.document(i.docType, i);
    const to = (i.channel === 'email' ? doc.contact.email : doc.contact.phone) ?? '';
    return { docLabel: doc.label, to, subject: doc.subject, message: doc.message, fileName: doc.fileName };
  }

  async send(i: SendShareInput): Promise<ShareRecord> {
    const doc = this.document(i.docType, i);
    const to = recipientFor(i.channel, i.to);
    const pdf = await doc.pdf();
    const businessId = this.d.businessId();
    const share = {
      id: newUlid(), businessId, docType: i.docType, docId: i.id, docLabel: doc.label, channel: i.channel, subject: doc.subject, message: i.message,
      fileName: doc.fileName, createdBy: this.d.userId(),
    };
    if (i.channel === 'whatsapp') {
      await this.d.saveDownload(doc.fileName, pdf);
      await this.d.openExternal(whatsappLink(to, i.message));
      insertShare(this.d.db(), { ...share, recipient: `+${to}`, pdf: null, status: 'opened' }, this.at());
    } else {
      if (pdf.length > SHARE_EMAIL_MAX_PDF_BYTES) {
        throw new AppError('VALIDATION_FAILED', 'This PDF is too large to email', { docType: 'over 1 MB; share a shorter period, or save the PDF and attach it yourself' });
      }
      insertShare(this.d.db(), { ...share, recipient: to, pdf, status: 'queued' }, this.at());
      await this.d.outbox.sendNow(share.id);
    }
    return getShare(this.d.db(), businessId, share.id)!;
  }

  history(i: ShareHistoryInput): ShareRecord[] {
    this.allow(i.docType);
    return listShares(this.d.db(), this.d.businessId(), i.docType, i.id);
  }

  private document(docType: ShareDocType, target: SharePreviewInput): SharedDocument {
    this.allow(docType);
    return this.d.documents.resolve(target);
  }

  private allow(docType: ShareDocType): void {
    if (!this.d.can(SHARE_PERMISSION[docType])) throw new AppError('PERMISSION_DENIED', 'You cannot share this document');
  }

  private at(): string { return new Date(this.d.now()).toISOString(); }
}
