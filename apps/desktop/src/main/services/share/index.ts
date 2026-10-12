import type { Permission } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import type { Handlers } from '../../ipc/gateway.js';
import { ShareDocuments, type ShareSources } from './documents.js';
import { EmailOutbox } from './emailOutbox.js';
import type { ShareMailer } from './cloudMailer.js';
import { ShareService } from './shareService.js';

export { CloudMailer, type EmailRequest, type MailResult, type ShareMailer } from './cloudMailer.js';
export { buildStatement } from './statement.js';

export interface ShareDeps {
  db: () => Db;
  sources: ShareSources;
  mailer: ShareMailer;
  openBusiness: () => string | null;
  businessId: () => string;
  userId: () => string;
  can: (p: Permission) => boolean;
  shop: () => { name: string; email?: string | undefined };
  online: () => boolean;
  openExternal: (url: string) => Promise<void>;
  saveDownload: (fileName: string, bytes: Buffer) => Promise<{ saved: boolean; fileName: string }>;
  now: () => number;
  log: (err: unknown) => void;
}

export function createShare(d: ShareDeps) {
  const outbox = new EmailOutbox({ db: d.db, mailer: d.mailer, businessId: d.openBusiness, shop: d.shop, online: d.online, now: d.now, log: d.log });
  const service = new ShareService({
    db: d.db, documents: new ShareDocuments(d.sources), outbox, can: d.can, businessId: d.businessId, userId: d.userId,
    openExternal: d.openExternal, saveDownload: d.saveDownload, now: d.now,
  });
  const handlers: Pick<Handlers, 'share.preview' | 'share.send' | 'share.history'> = {
    'share.preview': (i) => service.preview(i),
    'share.send': (i) => service.send(i),
    'share.history': (i) => service.history(i),
  };
  return { service, outbox, handlers };
}
export type Share = ReturnType<typeof createShare>;
