import { foreignKeyCheck, openDatabase, quickCheck, replayCheck, verifyAuditChain, type Db } from '@muneem/db-sqlite';

const n = (db: Db, sql: string): number => db.prepare(sql).pluck().get() as number;

// The kill -9 invariants for the sale commit (LLD §19 crash-safety suite, ADR-0013).
export function checkSalesConsistency(file: string) {
  const db = openDatabase(file, { quickCheck: false });
  try {
    const report = {
      quickCheck: quickCheck(db).ok,
      foreignKeys: foreignKeyCheck(db).ok,
      sales: n(db, 'SELECT COUNT(*) FROM sale'),
      salesWithoutItems: n(db, 'SELECT COUNT(*) FROM sale s WHERE NOT EXISTS (SELECT 1 FROM sale_item i WHERE i.sale_id = s.id)'),
      salesWithoutTenders: n(db, 'SELECT COUNT(*) FROM sale s WHERE s.total_paise > 0 AND NOT EXISTS (SELECT 1 FROM sale_tender t WHERE t.sale_id = s.id)'),
      unbalancedSales: n(db, `SELECT COUNT(*) FROM sale s WHERE s.total_paise <>
        (SELECT COALESCE(SUM(amount_paise - change_paise), 0) FROM sale_tender t WHERE t.sale_id = s.id)`),
      salesWithoutAudit: n(db, "SELECT COUNT(*) FROM sale s WHERE (SELECT COUNT(*) FROM audit_log a WHERE a.entity_id = s.id AND a.action = 'sale.complete') <> 1"),
      salesWithoutOutbox: n(db, "SELECT COUNT(*) FROM sale s WHERE (SELECT COUNT(*) FROM sync_outbox o WHERE o.entity_id = s.id AND o.entity_type = 'sale') <> 1"),
      salesWithoutPrintJob: n(db, 'SELECT COUNT(*) FROM sale s WHERE NOT EXISTS (SELECT 1 FROM print_job p WHERE p.doc_id = s.id)'),
      orphanSaleAudit: n(db, "SELECT COUNT(*) FROM audit_log a WHERE a.action = 'sale.complete' AND NOT EXISTS (SELECT 1 FROM sale s WHERE s.id = a.entity_id)"),
      orphanSaleOutbox: n(db, "SELECT COUNT(*) FROM sync_outbox o WHERE o.entity_type = 'sale' AND NOT EXISTS (SELECT 1 FROM sale s WHERE s.id = o.entity_id)"),
      orphanPrintJobs: n(db, 'SELECT COUNT(*) FROM print_job p WHERE NOT EXISTS (SELECT 1 FROM sale s WHERE s.id = p.doc_id)'),
      seriesWithGaps: n(db, `SELECT COUNT(*) FROM doc_series d WHERE EXISTS (SELECT 1 FROM sale s WHERE s.series_id = d.id) AND (
        (SELECT COUNT(*) FROM sale s WHERE s.series_id = d.id) <> (SELECT MAX(doc_seq) FROM sale s WHERE s.series_id = d.id)
        OR d.next_seq <> (SELECT MAX(doc_seq) + 1 FROM sale s WHERE s.series_id = d.id))`),
      seriesConsumedWithoutSale: n(db, 'SELECT COUNT(*) FROM doc_series d WHERE d.next_seq > 1 AND NOT EXISTS (SELECT 1 FROM sale s WHERE s.series_id = d.id)'),
      salesWithWrongMovements: n(db, `SELECT COUNT(*) FROM sale s WHERE (SELECT COUNT(*) FROM sale_item i WHERE i.sale_id = s.id)
        <> (SELECT COUNT(*) FROM stock_movement m WHERE m.ref_type = 'sale' AND m.ref_id = s.id)`),
      orphanSaleMovements: n(db, "SELECT COUNT(*) FROM stock_movement m WHERE m.ref_type = 'sale' AND NOT EXISTS (SELECT 1 FROM sale s WHERE s.id = m.ref_id)"),
      stockDrift: (db.prepare('SELECT DISTINCT business_id FROM sale').pluck().all() as string[]).reduce((sum, b) => sum + replayCheck(db, b).length, 0),
      brokenAuditChains: (db.prepare('SELECT DISTINCT business_id, device_id FROM audit_log').all() as { business_id: string; device_id: string }[])
        .filter((c) => !verifyAuditChain(db, c.business_id, c.device_id).ok).length,
    };
    const failures = Object.entries(report).filter(([k, v]) => (k === 'quickCheck' || k === 'foreignKeys' ? v !== true : k !== 'sales' && v !== 0));
    return { ...report, ok: failures.length === 0 && report.sales > 0, failures: failures.map(([k]) => k) };
  } finally {
    db.close();
  }
}
