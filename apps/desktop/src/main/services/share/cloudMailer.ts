import { AppError, type HttpComponents } from '@muneem/contracts';
import type { CloudClient } from '../../infra/cloudClient.js';

export interface EmailRequest {
  shareId: string; businessId: string; to: string; replyTo?: string | undefined; fromName: string; subject: string; text: string; fileName: string; pdf: Buffer;
}
export type MailResult = { ok: true; sentAt: string } | { ok: false; retry: boolean; error: string };

// Where an email goes out; the cloud's SMTP relay in the app, a recorder in tests.
export interface ShareMailer { send(r: EmailRequest): Promise<MailResult> }

type Body = HttpComponents['schemas']['ShareEmailRequest'];
type Result = HttpComponents['schemas']['ShareEmailResult'];

// Only a request the cloud will never take is given up at once; offline, a busy relay or a business not synced yet all retry.
const PERMANENT = new Set<string>(['VALIDATION_FAILED', 'PERMISSION_DENIED', 'DEVICE_REVOKED']);

export class CloudMailer implements ShareMailer {
  constructor(private readonly cloud: () => CloudClient, private readonly refreshAuth: () => Promise<unknown>) {}

  async send(r: EmailRequest): Promise<MailResult> {
    try {
      return await this.post(r);
    } catch (e) {
      if (e instanceof AppError && e.code === 'INVALID_CREDENTIALS') {
        try {
          await this.refreshAuth();
          return await this.post(r);
        } catch (again) { return failure(again); }
      }
      return failure(e);
    }
  }

  private async post(r: EmailRequest): Promise<MailResult> {
    const body: Body = {
      shareId: r.shareId, businessId: r.businessId, to: r.to, fromName: r.fromName, subject: r.subject, text: r.text,
      attachment: { fileName: r.fileName, contentBase64: r.pdf.toString('base64') }, ...(r.replyTo && { replyTo: r.replyTo }),
    };
    const res = await this.cloud().request<Result>('POST', '/share/email', body);
    return { ok: true, sentAt: res.data.sentAt };
  }
}

function failure(e: unknown): MailResult {
  const code = e instanceof AppError ? e.code : 'INTERNAL';
  return { ok: false, retry: !PERMANENT.has(code), error: e instanceof Error ? e.message : String(e) };
}
