import { foreignKeyCheck, openDatabase, quickCheck, reconcilePartiesDb, replayCheck, tieOutFailures, verifyAuditChain, type Db } from '@muneem/db-sqlite';

const n = (db: Db, sql: string): number => db.prepare(sql).pluck().get() as number;

export const NUMBERED = ['sale', 'credit_note', 'purchase', 'debit_note', 'payment', 'expense', 'gst_setoff', 'gst_payment'] as const;
const PARTY_REFS = ['sale', 'purchase', 'debit_note', 'credit_note', 'payment', 'write_off', 'expense'] as const;
// A cancelled purchase sends its goods back under purchase_return against the purchase itself.
const STOCK_REFS: Record<string, string[]> = { sale: ['sale'], purchase: ['purchase'], sale_return: ['credit_note'], purchase_return: ['debit_note', 'purchase'] };
const DOCUMENTS = [...NUMBERED, 'write_off', 'fy_close'] as const;
// A month with nothing to utilise and nothing to pay posts no transfer journal.
const SETOFF_MOVES = ['igst_to_igst', 'igst_to_cgst', 'igst_to_sgst', 'cgst_to_cgst', 'cgst_to_igst', 'sgst_to_sgst', 'sgst_to_igst', 'cess_to_cess',
  'cash_igst', 'cash_cgst', 'cash_sgst', 'cash_cess'].map((c) => `d.${c}_paise`);

// Pulled documents carry their own device's audit and outbox, and their series is numbered there.
const LOCAL = "(SELECT value FROM app_meta WHERE key = 'installation_id')";
const exists = (table: string, id: string) => `EXISTS (SELECT 1 FROM ${table} d WHERE d.id = ${id})`;
const union = (tables: readonly string[], select: (t: string) => string) => tables.map(select).join(' UNION ALL ');

// Every document is whole or absent: its audit row, outbox row and journal; nothing points at a document that is not there.
function perDocument(db: Db, t: string) {
  return {
    [`${t}WithoutAudit`]: n(db, `SELECT COUNT(*) FROM ${t} d WHERE d.device_id = ${LOCAL} AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.entity_id = d.id)`),
    [`${t}WithoutOutbox`]: n(db, `SELECT COUNT(*) FROM ${t} d WHERE d.device_id = ${LOCAL}
      AND NOT EXISTS (SELECT 1 FROM sync_outbox o WHERE o.entity_id = d.id AND o.entity_type = '${t}')`),
    [`${t}OrphanAudit`]: n(db, `SELECT COUNT(*) FROM audit_log a WHERE a.entity_type = '${t}' AND NOT ${exists(t, 'a.entity_id')}`),
    [`${t}OrphanOutbox`]: n(db, `SELECT COUNT(*) FROM sync_outbox o WHERE o.entity_type = '${t}' AND NOT ${exists(t, 'o.entity_id')}`),
    [`${t}OrphanJournals`]: n(db, `SELECT COUNT(*) FROM journal_entry j WHERE j.ref_type = '${t}' AND NOT ${exists(t, 'j.ref_id')}`),
  };
}

function journalsPerDocument(db: Db) {
  const unposted = (t: string, extra = '') => n(db, `SELECT COUNT(*) FROM ${t} d WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.ref_type = '${t}' AND j.ref_id = d.id)${extra}`);
  const cancelledWithoutReversal = (t: string) => n(db, `SELECT COUNT(*) FROM ${t} d WHERE d.status = 'cancelled'
    AND (SELECT COUNT(*) FROM journal_entry j WHERE j.ref_type = '${t}' AND j.ref_id = d.id) <> 2`);
  return {
    ...Object.fromEntries(['sale', 'credit_note', 'purchase', 'debit_note', 'payment', 'write_off'].map((t) => [`${t}WithoutJournal`, unposted(t)])),
    gst_setoffWithoutJournal: unposted('gst_setoff', ` AND ${SETOFF_MOVES.join(' + ')} > 0`),
    purchaseCancelledWithoutReversal: cancelledWithoutReversal('purchase'),
    paymentCancelledWithoutReversal: cancelledWithoutReversal('payment'),
    yearsClosedWithoutJournal: n(db, `SELECT COUNT(*) FROM fy_close f WHERE f.status = 'closed'
      AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.source = 'closing' AND j.ref_id = f.id)`),
    closingJournalsWithoutYear: n(db, "SELECT COUNT(*) FROM journal_entry j WHERE j.source = 'closing' AND NOT EXISTS (SELECT 1 FROM fy_close f WHERE f.id = j.ref_id)"),
    journalsWithWrongLines: n(db, `SELECT COUNT(*) FROM journal_entry j WHERE j.debit_total_paise <> j.credit_total_paise
      OR j.debit_total_paise <> (SELECT COALESCE(SUM(debit_paise), 0) FROM journal_line l WHERE l.entry_id = j.id)
      OR j.credit_total_paise <> (SELECT COALESCE(SUM(credit_paise), 0) FROM journal_line l WHERE l.entry_id = j.id)`),
  };
}

// A number is consumed only by a document that exists: no gaps, no number taken by a rolled-back commit.
function numbering(db: Db) {
  const docs = union(NUMBERED, (t) => `SELECT series_id, doc_seq FROM ${t}`);
  return {
    seriesWithGaps: n(db, `SELECT COUNT(*) FROM doc_series s LEFT JOIN (SELECT series_id, COUNT(*) AS c, MAX(doc_seq) AS m FROM (${docs}) GROUP BY series_id) d
      ON d.series_id = s.id WHERE s.doc_type <> 'journal' AND s.device_id = ${LOCAL} AND (COALESCE(d.c, 0) <> COALESCE(d.m, 0) OR s.next_seq <> COALESCE(d.m, 0) + 1)`),
    duplicateNumbers: n(db, `SELECT COUNT(*) FROM (SELECT series_id, doc_seq FROM (${docs}) GROUP BY series_id, doc_seq HAVING COUNT(*) > 1)`),
    fyMismatches: n(db, `SELECT COUNT(*) FROM (${union(NUMBERED, (t) => `SELECT d.fy, s.fy AS series_fy FROM ${t} d JOIN doc_series s ON s.id = d.series_id`)}) WHERE fy <> series_fy`),
  };
}

function orphans(db: Db) {
  return {
    orphanStockMovements: Object.entries(STOCK_REFS).reduce((sum, [ref, ts]) =>
      sum + n(db, `SELECT COUNT(*) FROM stock_movement m WHERE m.ref_type = '${ref}' AND NOT (${ts.map((t) => exists(t, 'm.ref_id')).join(' OR ')})`), 0),
    orphanPartyEntries: PARTY_REFS.reduce((sum, t) => sum + n(db, `SELECT COUNT(*) FROM party_ledger_entry e WHERE e.ref_type = '${t}' AND NOT ${exists(t, 'e.ref_id')}`), 0),
    orphanAllocations: n(db, `SELECT COUNT(*) FROM allocation a WHERE NOT (${['payment', 'debit_note', 'credit_note', 'write_off'].map((t) => `(a.source_type = '${t}' AND ${exists(t, 'a.source_id')})`).join(' OR ')}
      OR a.source_type = 'opening') OR NOT (${['sale', 'purchase', 'expense'].map((t) => `(a.target_type = '${t}' AND ${exists(t, 'a.target_id')})`).join(' OR ')} OR a.target_type = 'opening')`),
    orphanCashMovements: n(db, `SELECT COUNT(*) FROM cash_movement c WHERE (c.ref_type = 'payment' AND NOT ${exists('payment', 'c.ref_id')}) OR (c.ref_type = 'expense' AND NOT ${exists('expense', 'c.ref_id')})`),
    salesWithWrongMovements: n(db, `SELECT COUNT(*) FROM sale s WHERE (SELECT COUNT(*) FROM sale_item i WHERE i.sale_id = s.id)
      <> (SELECT COUNT(*) FROM stock_movement m WHERE m.ref_type = 'sale' AND m.ref_id = s.id)`),
    purchasesWithoutItems: n(db, 'SELECT COUNT(*) FROM purchase p WHERE NOT EXISTS (SELECT 1 FROM purchase_item i WHERE i.purchase_id = p.id)'),
  };
}

function books(db: Db) {
  const businesses = db.prepare('SELECT id FROM business').pluck().all() as string[];
  return {
    tieOutFailures: businesses.reduce((sum, b) => sum + tieOutFailures(db, b).length, 0),
    stockDrift: businesses.reduce((sum, b) => sum + replayCheck(db, b).length, 0),
    partyMismatches: businesses.reduce((sum, b) => { const r = reconcilePartiesDb(db, b); return sum + r.mismatches.length + r.faults.length; }, 0),
    brokenAuditChains: (db.prepare('SELECT DISTINCT business_id, device_id FROM audit_log').all() as { business_id: string; device_id: string }[])
      .filter((c) => !verifyAuditChain(db, c.business_id, c.device_id).ok).length,
  };
}

export const documentCounts = (db: Db): Record<string, number> => Object.fromEntries(DOCUMENTS.map((t) => [t, n(db, `SELECT COUNT(*) FROM ${t}`)]));

// The kill -9 invariants for every posting command (LLD §19 crash-safety, ADR-0013), beyond the sale-only check.
export function checkDocuments(file: string) {
  const db = openDatabase(file, { quickCheck: false });
  try {
    const report = {
      quickCheck: quickCheck(db).ok,
      foreignKeys: foreignKeyCheck(db).ok,
      ...Object.assign({}, ...DOCUMENTS.map((t) => perDocument(db, t))) as Record<string, number>,
      ...journalsPerDocument(db),
      ...numbering(db),
      ...orphans(db),
      ...books(db),
    };
    const failures = Object.entries(report).filter(([k, v]) => (k === 'quickCheck' || k === 'foreignKeys' ? v !== true : v !== 0)).map(([k]) => k);
    return { counts: documentCounts(db), failures };
  } finally {
    db.close();
  }
}
