/**
 * Stage 1 verification item 4: SIGKILL the writer mid-transaction 50 times, then prove the DB is
 * consistent — no partial writes, no orphan audit/outbox rows, gap-free local_sequence.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, quickCheck, foreignKeyCheck, verifyAuditChain } from '@muneem/db-sqlite';
import { checkSalesConsistency } from '../test/crash/checkSales.js';
import { killDuring, killDuringSales, spawnTs } from '../test/crash/killLoop.js';
import { checkDocuments } from '../test/chaos/checkDocuments.js';
import { DOCUMENT_KINDS } from '../test/chaos/documentKinds.js';

const args = process.argv.slice(2);
const scenario = args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : 'setup';
const N = Number(args.find((a) => /^\d+$/u.test(a)) ?? 50);

if ((DOCUMENT_KINDS as readonly string[]).includes(scenario!)) {
  const docsFile = join(mkdtempSync(join(tmpdir(), `muneem-crash-${scenario}-`)), 'muneem.sqlite');
  await killDuring(join(dirname(fileURLToPath(import.meta.url)), '../test/chaos/documentsChild.ts'), [docsFile, scenario!], N, 250);
  const report = checkDocuments(docsFile);
  console.log(JSON.stringify({ kills: N, scenario, ...report, RESULT: report.failures.length === 0 ? 'PASS' : 'FAIL' }, null, 2));
  process.exit(report.failures.length === 0 ? 0 : 1);
}
if (scenario === 'sales') {
  const salesFile = join(mkdtempSync(join(tmpdir(), 'muneem-crash-sales-')), 'muneem.sqlite');
  await killDuringSales(salesFile, N);
  const report = checkSalesConsistency(salesFile);
  console.log(JSON.stringify({ kills: N, ...report, RESULT: report.ok ? 'PASS' : 'FAIL' }, null, 2));
  process.exit(report.ok ? 0 : 1);
}
const dir = mkdtempSync(join(tmpdir(), 'muneem-crash-'));
const file = join(dir, 'muneem.sqlite');
const child = join(dirname(fileURLToPath(import.meta.url)), 'crash-child.ts');

for (let i = 0; i < N; i++) {
  const p = spawnTs(child, [file], 'ignore');
  const delay = 150 + Math.floor(Math.random() * 400);
  await new Promise<void>((res) => setTimeout(res, delay));
  p.kill('SIGKILL');
  await new Promise<void>((res) => p.on('exit', () => res()));
}

const db = openDatabase(file, { quickCheck: false });
const qc = quickCheck(db);
const fk = foreignKeyCheck(db);
const counts = {
  business: (db.prepare('SELECT COUNT(*) n FROM business').get() as { n: number }).n,
  branch: (db.prepare('SELECT COUNT(*) n FROM branch').get() as { n: number }).n,
  terminal: (db.prepare('SELECT COUNT(*) n FROM terminal').get() as { n: number }).n,
  audit: (db.prepare('SELECT COUNT(*) n FROM audit_log').get() as { n: number }).n,
  outbox: (db.prepare('SELECT COUNT(*) n FROM sync_outbox').get() as { n: number }).n,
  nextSeq: (db.prepare('SELECT next_seq FROM local_sequence').get() as { next_seq: number }).next_seq,
};
const orphanAudit = (db.prepare(`SELECT COUNT(*) n FROM audit_log a WHERE NOT EXISTS (
  SELECT 1 FROM business WHERE id = a.entity_id UNION SELECT 1 FROM branch WHERE id = a.entity_id UNION SELECT 1 FROM terminal WHERE id = a.entity_id)`).get() as { n: number }).n;
const orphanOutbox = (db.prepare(`SELECT COUNT(*) n FROM sync_outbox o WHERE NOT EXISTS (
  SELECT 1 FROM business WHERE id = o.entity_id UNION SELECT 1 FROM branch WHERE id = o.entity_id UNION SELECT 1 FROM terminal WHERE id = o.entity_id)`).get() as { n: number }).n;
const entityWithoutAudit = (db.prepare(`SELECT COUNT(*) n FROM (
  SELECT id FROM business UNION ALL SELECT id FROM branch UNION ALL SELECT id FROM terminal) e
  WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE entity_id = e.id)`).get() as { n: number }).n;
const entities = counts.business + counts.branch + counts.terminal;
const chains = (db.prepare('SELECT DISTINCT business_id FROM audit_log').all() as { business_id: string }[]).map((r) => verifyAuditChain(db, r.business_id, '01J000000000000000000DEVICE'));
const chainOk = chains.every((c) => c.ok);
db.close();
rmSync(dir, { recursive: true, force: true });

const ok = qc.ok && fk.ok && orphanAudit === 0 && orphanOutbox === 0 && entityWithoutAudit === 0 && counts.audit === entities && counts.outbox === entities && counts.nextSeq - 1 === entities && chainOk;
console.log(JSON.stringify({ kills: N, quick_check: qc.ok, foreign_keys: fk.ok, ...counts, entities, orphanAudit, orphanOutbox, entityWithoutAudit, auditChainsOk: chainOk, RESULT: ok ? 'PASS' : 'FAIL' }, null, 2));
process.exit(ok ? 0 : 1);
