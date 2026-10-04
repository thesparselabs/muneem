import type { ReportParams } from '@muneem/contracts';
import {
  balanceDrift, dailySummaryDrift, foreignKeyCheck, journalsNotMatchingLines, quickCheck, reconcilePartiesDb, replayKeys, stockKeys, tieOutFailures,
  unpostedDocuments, verifyAllAuditChains, verifyAuditChain, type Db, type StockKey,
} from '@muneem/db-sqlite';
import { ReportCatalogue } from '../reports/catalogue.js';
import { REPORTS } from '../reports/definitions/index.js';

const catalogue = new ReportCatalogue(REPORTS);

// ADR-0058: everything here only reads, so it can run on a read-only connection away from the thread that bills.
export const READ_JOBS = {
  report: (db: Db, i: { id: string; params: ReportParams; businessId: string; today: string }) =>
    catalogue.get(i.id).run({ db, businessId: i.businessId, today: i.today }, i.params),
  summaryDrift: (db: Db, i: { businessId: string; since?: string }) => dailySummaryDrift(db, i.businessId, i.since),
  stockKeys: (db: Db, i: { businessId: string }) => stockKeys(db, i.businessId),
  stockReplay: (db: Db, i: { businessId: string; keys: StockKey[] }) => replayKeys(db, i.businessId, i.keys),
  partyReconciliation: (db: Db, i: { businessId: string }) => reconcilePartiesDb(db, i.businessId),
  journalChecks: (db: Db, i: { businessId: string }) => ({
    balanceDrift: balanceDrift(db, i.businessId), tieOuts: tieOutFailures(db, i.businessId), unposted: unpostedDocuments(db, i.businessId),
    badJournals: journalsNotMatchingLines(db, i.businessId),
  }),
  auditChains: (db: Db) => verifyAllAuditChains(db),
  auditChain: (db: Db, i: { businessId: string; deviceId: string }) => verifyAuditChain(db, i.businessId, i.deviceId),
  storage: (db: Db) => ({ quick: quickCheck(db), foreignKeys: foreignKeyCheck(db) }),
  quickCheck: (db: Db) => quickCheck(db),
} as const;

export type ReadJobs = typeof READ_JOBS;
export type ReadJob = keyof ReadJobs;
export type JobInput<K extends ReadJob> = Parameters<ReadJobs[K]>[1];
export type JobOutput<K extends ReadJob> = ReturnType<ReadJobs[K]>;

// One snapshot per job, so a check never compares documents and caches from two different moments.
export function runReadJob<K extends ReadJob>(db: Db, kind: K, input: JobInput<K>): JobOutput<K> {
  const job = READ_JOBS[kind] as (db: Db, input: JobInput<K>) => JobOutput<K>;
  return kind === 'storage' || kind === 'quickCheck' ? job(db, input) : db.transaction(() => job(db, input))();
}
