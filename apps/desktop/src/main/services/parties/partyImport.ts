import {
  CustomerInput, SupplierInput, type OpeningBalanceInput, type PartyImportCommitInput, type PartyImportField, type PartyImportMapping,
  type PartyImportPreview, type PartyImportPreviewInput, type PartyImportSummary, type Permission,
} from '@muneem/contracts';
import type { PartyType } from '@muneem/domain';
import { findPartyId, getMeta, setMeta, withTransaction } from '@muneem/db-sqlite';
import type { z } from 'zod';
import { suggestFrom } from '../import/columnMapping.js';
import { applyRow } from '../import/importService.js';
import type { PreviewSession, PreviewStore } from '../import/previewStore.js';
import { readTable } from '../import/tableReader.js';
import type { PosContext } from '../pos/posContext.js';
import { parsePartyRow, type OpeningDraft, type PartyRowErrors } from './partyRowParser.js';

const ALIASES: Record<PartyImportField, readonly string[]> = {
  name: ['name', 'partyname', 'customername', 'suppliername', 'vendorname', 'customer', 'supplier', 'party', 'vendor'],
  phone: ['phone', 'mobile', 'mobileno', 'phoneno', 'mobilenumber', 'phonenumber', 'contact', 'contactno'],
  email: ['email', 'emailid', 'emailaddress'],
  gstin: ['gstin', 'gstno', 'gstnumber', 'gst'],
  stateCode: ['statecode', 'state'],
  taxScheme: ['taxscheme', 'gsttype', 'registrationtype'],
  addressLine1: ['address', 'addressline1', 'billingaddress'],
  city: ['city', 'town'],
  pinCode: ['pincode', 'pin', 'postalcode', 'zip'],
  creditDays: ['creditdays', 'creditperiod', 'paymentterms'],
  openingBalance: ['openingbalance', 'opening', 'balance', 'outstanding', 'dues'],
  openingDate: ['openingdate', 'asof', 'asofdate', 'balancedate'],
};

// What differs between importing customers and suppliers; the services behind it stay the single place a party is written.
export interface PartyImportTarget {
  partyType: PartyType;
  schema: z.ZodTypeAny;
  openingPermission: Permission;
  create(input: unknown): string;
  setOpening(input: OpeningBalanceInput): void;
}

export const customerImportTarget = (create: (i: CustomerInput) => { id: string }, setOpening: (i: OpeningBalanceInput) => unknown): PartyImportTarget => ({
  partyType: 'customer', schema: CustomerInput, openingPermission: 'customers.edit', create: (i) => create(i as CustomerInput).id, setOpening: (i) => { setOpening(i); },
});
export const supplierImportTarget = (create: (i: SupplierInput) => { id: string }, setOpening: (i: OpeningBalanceInput) => unknown): PartyImportTarget => ({
  partyType: 'supplier', schema: SupplierInput, openingPermission: 'suppliers.edit', create: (i) => create(i as SupplierInput).id, setOpening: (i) => { setOpening(i); },
});

interface PlannedParty { line: number; status: 'ok' | 'error' | 'duplicate'; name?: string; input?: unknown; opening?: OpeningDraft; errors: Record<string, string> }

const REQUIRED: Record<string, string> = { name: 'name is required', stateCode: 'enter a 2-digit state code or a GSTIN' };
const MAX_PROBLEM_ROWS = 500;
const SAMPLE_OK_ROWS = 20;

export class PartyImportService {
  constructor(private readonly ctx: PosContext, private readonly target: PartyImportTarget, private readonly previews: PreviewStore<PartyImportMapping>) {}

  async preview(input: PartyImportPreviewInput): Promise<PartyImportPreview> {
    const businessId = this.ctx.businessId();
    const session = input.importId ? this.previews.get(input.importId, businessId) : await this.load(businessId, input.fileName!, input.contentBase64!);
    if (input.mapping) this.previews.update(Object.assign(session, { mapping: input.mapping }));
    const rows = this.plan(session);
    const count = (s: PlannedParty['status']) => rows.filter((r) => r.status === s).length;
    return {
      importId: session.id, fileName: session.fileName, columns: session.table.columns, mapping: session.mapping,
      counts: { total: rows.length, ok: count('ok'), errors: count('error'), duplicates: count('duplicate'), openings: rows.filter((r) => r.status === 'ok' && r.opening).length },
      rows: [...rows.filter((r) => r.status !== 'ok').slice(0, MAX_PROBLEM_ROWS), ...rows.filter((r) => r.status === 'ok').slice(0, SAMPLE_OK_ROWS)]
        .map((r) => ({ line: r.line, status: r.status, errors: r.errors, ...(r.name && { name: r.name }) })),
    };
  }

  commit(input: PartyImportCommitInput): PartyImportSummary {
    const db = this.ctx.db();
    const doneKey = `party-import:${input.commandId}`;
    const done = getMeta(db, doneKey);
    if (done) return JSON.parse(done) as PartyImportSummary;
    const session = this.previews.get(input.importId, this.ctx.businessId());
    const summary = withTransaction(db, () => {
      const s: PartyImportSummary = { created: 0, openingsSet: 0, skippedDuplicates: 0, skippedErrors: 0, skippedAtCommit: [] };
      for (const row of this.plan(session)) {
        if (row.status === 'error') { s.skippedErrors++; continue; }
        if (row.status === 'duplicate') { s.skippedDuplicates++; continue; }
        const failure = applyRow(db, () => {
          const partyId = this.target.create(row.input);
          if (row.opening) this.target.setOpening({ partyId, ...row.opening });
        });
        if (failure) { s.skippedErrors++; s.skippedAtCommit.push({ line: row.line, reason: failure }); continue; }
        s.created++;
        if (row.opening) s.openingsSet++;
      }
      setMeta(db, doneKey, JSON.stringify(s));
      return s;
    });
    this.previews.delete(session.id);
    return summary;
  }

  private async load(businessId: string, fileName: string, contentBase64: string): Promise<PreviewSession<PartyImportMapping>> {
    const table = await readTable(fileName, Buffer.from(contentBase64, 'base64'));
    return this.previews.put({ businessId, fileName, table, mapping: suggestFrom(table.columns, ALIASES) });
  }

  private plan(session: PreviewSession<PartyImportMapping>): PlannedParty[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const maySetOpening = this.ctx.can(this.target.openingPermission);
    const seen = { gstin: new Map<string, number>(), phone: new Map<string, number>() };
    return session.table.rows.map(({ line, cells }): PlannedParty => {
      const { draft, errors } = parsePartyRow(cells, session.mapping, this.target.partyType, this.ctx.today());
      const parsed = this.target.schema.safeParse(draft.fields);
      const all: PartyRowErrors = { ...errors };
      if (!parsed.success) for (const issue of parsed.error.issues) all[issue.path[0] as PartyImportField] ??= REQUIRED[String(issue.path[0])] ?? issue.message;
      if (draft.opening && !maySetOpening) all.openingBalance = 'you are not allowed to set opening balances';
      const { gstin, phone } = draft.fields as { gstin?: string; phone?: string };
      for (const [key, value] of [['gstin', gstin], ['phone', phone]] as const) {
        if (!value) continue;
        const first = seen[key].get(value);
        if (first !== undefined) all[key] = `same ${key === 'gstin' ? 'GSTIN' : 'phone'} as row ${first}`;
        else seen[key].set(value, line);
      }
      const name = draft.fields.name ? String(draft.fields.name) : undefined;
      const base = { line, ...(name && { name }) };
      if (Object.keys(all).length > 0) return { ...base, status: 'error', errors: all as Record<string, string> };
      if (findPartyId(db, businessId, this.target.partyType, { gstin, phone })) return { ...base, status: 'duplicate', errors: {} };
      return { ...base, status: 'ok', input: parsed.data, errors: {}, ...(draft.opening && { opening: draft.opening }) };
    });
  }
}
