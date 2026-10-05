import Papa from 'papaparse';
import type { Customer, EraseCustomerInput, ExportProfileInput, SetConsentInput, WithdrawConsentInput } from '@muneem/contracts';
import { customerDocuments, eraseCustomer, giveConsent, withdrawConsent, type CustomerDocument } from '@muneem/db-sqlite';
import type { SaveFile } from '../../reports/service.js';
import type { CustomerService } from '../pos/customers.js';
import type { PosContext } from '../pos/posContext.js';

export interface CustomerProfileExport {
  exportedAt: string;
  business: { name: string };
  customer: Customer;
  documents: CustomerDocument[];
}

// One table for every section, so a spreadsheet opens it as is: section, item, date, reference, amount, detail.
export function profileCsv(p: CustomerProfileExport): string {
  const { consents = [], ...profile } = p.customer;
  const rows: unknown[][] = [['section', 'item', 'date', 'reference', 'amount_paise', 'detail']];
  for (const [k, v] of Object.entries(profile)) rows.push(['profile', k, '', '', '', v]);
  for (const c of consents) rows.push(['consent', `${c.purpose}/${c.channel}`, c.givenAt, c.id, '', c.withdrawnAt ? `withdrawn ${c.withdrawnAt}` : `given (${c.method})`]);
  for (const d of p.documents) rows.push(['document', d.type, d.docDate, d.docNumber ?? d.id, d.amountPaise, d.status]);
  return `﻿${Papa.unparse(rows, { escapeFormulae: true })}\r\n`;
}

// FR-104 / ADR-0050: consent capture, a copy of what is held about a customer, and erasure of the profile.
export class CustomerPrivacyService {
  constructor(
    private readonly ctx: PosContext, private readonly customers: CustomerService, private readonly businessName: () => string,
    private readonly saveFile: SaveFile, private readonly now: () => number,
  ) {}

  setConsent(input: SetConsentInput): Customer {
    this.customers.get(input.customerId);
    return giveConsent(this.ctx.db(), input, this.ctx.actor());
  }

  withdrawConsent(input: WithdrawConsentInput): Customer {
    this.customers.get(input.customerId);
    return withdrawConsent(this.ctx.db(), input.customerId, input.consentId, this.ctx.actor());
  }

  erase(input: EraseCustomerInput): Customer {
    this.customers.get(input.customerId);
    return eraseCustomer(this.ctx.db(), input.customerId, input.version, input.reason, this.ctx.actor());
  }

  profile(customerId: string): CustomerProfileExport {
    const customer = this.customers.get(customerId);
    return {
      exportedAt: new Date(this.now()).toISOString(), business: { name: this.businessName() }, customer,
      documents: customerDocuments(this.ctx.db(), this.ctx.businessId(), customerId),
    };
  }

  async exportProfile(input: ExportProfileInput): Promise<{ saved: boolean; fileName: string; bytes: number }> {
    const p = this.profile(input.customerId);
    const body = Buffer.from(input.format === 'csv' ? profileCsv(p) : JSON.stringify(p, null, 2), 'utf8');
    const r = await this.saveFile(`customer-${input.customerId}-${this.ctx.today()}.${input.format}`, body);
    return { ...r, bytes: body.length };
  }
}
