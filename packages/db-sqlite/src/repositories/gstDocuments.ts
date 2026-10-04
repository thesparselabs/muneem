import type { GstHeads, GstPayment, GstSetoff } from '@muneem/contracts';
import type { SetoffUtilisation } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';

interface Numbered { id: string; businessId: string; branchId: string; terminalId: string; seriesId: string; docNumber: string; docSeq: number; docDate: string; fy: string; commandId: string; createdAt?: string }

export interface GstSetoffRecord extends Numbered { month: string; liability: GstHeads; credit: GstHeads; utilisation: SetoffUtilisation; cash: GstHeads }
export interface GstPaymentRecord extends Numbered, GstHeads { month: string | null; challanRef: string; totalPaise: number; note: string | null }

const HEAD_COLUMNS = ['igst', 'cgst', 'sgst', 'cess'] as const;
const headCols = (prefix: string): string => HEAD_COLUMNS.map((h) => `${prefix}_${h}_paise`).join(', ');
const headParams = (prefix: string): string => HEAD_COLUMNS.map((h) => `@${prefix}_${h}`).join(', ');
const flat = (prefix: string, h: GstHeads): Record<string, number> =>
  ({ [`${prefix}_igst`]: h.igstPaise, [`${prefix}_cgst`]: h.cgstPaise, [`${prefix}_sgst`]: h.sgstPaise, [`${prefix}_cess`]: h.cessPaise });
const UTILISATION = [
  ['igst_to_igst_paise', 'igstToIgstPaise'], ['igst_to_cgst_paise', 'igstToCgstPaise'], ['igst_to_sgst_paise', 'igstToSgstPaise'],
  ['cgst_to_cgst_paise', 'cgstToCgstPaise'], ['cgst_to_igst_paise', 'cgstToIgstPaise'], ['sgst_to_sgst_paise', 'sgstToSgstPaise'],
  ['sgst_to_igst_paise', 'sgstToIgstPaise'], ['cess_to_cess_paise', 'cessToCessPaise'],
] as const;

export function insertGstSetoff(db: Db, r: GstSetoffRecord, actor: Actor): void {
  const t = r.createdAt ?? nowIso();
  stmt(db, `INSERT INTO gst_setoff (id, business_id, branch_id, terminal_id, series_id, doc_number, doc_seq, doc_date, fy, period_month,
      ${headCols('liability')}, ${headCols('credit')}, ${UTILISATION.map(([c]) => c).join(', ')}, ${headCols('cash')},
      command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @seriesId, @docNumber, @docSeq, @docDate, @fy, @month,
      ${headParams('liability')}, ${headParams('credit')}, ${UTILISATION.map(([, k]) => `@${k}`).join(', ')}, ${headParams('cash')},
      @commandId, @t, @t, @by, @device)`).run({
    id: r.id, businessId: r.businessId, branchId: r.branchId, terminalId: r.terminalId, seriesId: r.seriesId, docNumber: r.docNumber, docSeq: r.docSeq,
    docDate: r.docDate, fy: r.fy, month: r.month, ...flat('liability', r.liability), ...flat('credit', r.credit), ...r.utilisation, ...flat('cash', r.cash),
    commandId: r.commandId, t, by: actor.userId, device: actor.deviceId,
  });
}

export function insertGstPayment(db: Db, r: GstPaymentRecord, actor: Actor): void {
  const t = r.createdAt ?? nowIso();
  stmt(db, `INSERT INTO gst_payment (id, business_id, branch_id, terminal_id, series_id, doc_number, doc_seq, doc_date, fy, period_month, challan_ref,
      igst_paise, cgst_paise, sgst_paise, cess_paise, total_paise, note, command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @seriesId, @docNumber, @docSeq, @docDate, @fy, @month, @challanRef,
      @igstPaise, @cgstPaise, @sgstPaise, @cessPaise, @totalPaise, @note, @commandId, @t, @t, @by, @device)`)
    .run({ ...r, createdAt: undefined, t, by: actor.userId, device: actor.deviceId });
}

type Row = Record<string, string | number | null>;
const heads = (r: Row, prefix: string): GstHeads => ({
  igstPaise: r[`${prefix}_igst_paise`] as number, cgstPaise: r[`${prefix}_cgst_paise`] as number,
  sgstPaise: r[`${prefix}_sgst_paise`] as number, cessPaise: r[`${prefix}_cess_paise`] as number,
});

function toSetoff(r: Row): GstSetoff & { businessId: string } {
  return {
    id: r.id as string, businessId: r.business_id as string, docNumber: r.doc_number as string, docDate: r.doc_date as string, month: r.period_month as string,
    liability: heads(r, 'liability'), credit: heads(r, 'credit'), cash: heads(r, 'cash'),
    utilisation: Object.fromEntries(UTILISATION.map(([c, k]) => [k, r[c] as number])) as unknown as SetoffUtilisation,
    createdAt: r.created_at as string, createdBy: r.created_by as string,
  };
}

function toPayment(r: Row): GstPayment & { businessId: string } {
  return {
    id: r.id as string, businessId: r.business_id as string, docNumber: r.doc_number as string, docDate: r.doc_date as string, challanRef: r.challan_ref as string,
    igstPaise: r.igst_paise as number, cgstPaise: r.cgst_paise as number, sgstPaise: r.sgst_paise as number, cessPaise: r.cess_paise as number,
    totalPaise: r.total_paise as number, createdAt: r.created_at as string, createdBy: r.created_by as string,
    ...(r.period_month !== null && { month: r.period_month as string }), ...(r.note !== null && { note: r.note as string }),
  };
}

export const getGstSetoff = (db: Db, id: string): (GstSetoff & { businessId: string }) | null => {
  const r = stmt(db, 'SELECT * FROM gst_setoff WHERE id = ?').get(id) as Row | undefined;
  return r ? toSetoff(r) : null;
};
export const getGstPayment = (db: Db, id: string): (GstPayment & { businessId: string }) | null => {
  const r = stmt(db, 'SELECT * FROM gst_payment WHERE id = ?').get(id) as Row | undefined;
  return r ? toPayment(r) : null;
};

export const listGstSetoffs = (db: Db, businessId: string): GstSetoff[] =>
  (stmt(db, 'SELECT * FROM gst_setoff WHERE business_id = ? ORDER BY period_month DESC, id').all(businessId) as Row[]).map(toSetoff);
export const listGstPayments = (db: Db, businessId: string, limit = 200): GstPayment[] =>
  (stmt(db, 'SELECT * FROM gst_payment WHERE business_id = ? ORDER BY doc_date DESC, id DESC LIMIT ?').all(businessId, limit) as Row[]).map(toPayment);

export const setoffIdsForMonth = (db: Db, businessId: string, month: string): string[] =>
  stmt(db, "SELECT id FROM gst_setoff WHERE business_id = ? AND period_month = ? AND status = 'posted' ORDER BY id").pluck().all(businessId, month) as string[];

// The latest month set off; months up to it are settled, later ones are not (ADR-0044 as built).
export const latestSetoffMonth = (db: Db, businessId: string): string | null =>
  (stmt(db, "SELECT MAX(period_month) FROM gst_setoff WHERE business_id = ? AND status = 'posted'").pluck().get(businessId) as string | null) ?? null;

export const gstSetoffIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM gst_setoff WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;
export const gstPaymentIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM gst_payment WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;
