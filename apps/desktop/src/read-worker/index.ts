// Worker thread entry (ADR-0058): reports and integrity checks on a read-only connection, away from the thread that bills.
import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase, type Db } from '@muneem/db-sqlite';
import { toJobError, type JobReply, type WorkerSetup } from '../main/background/backgroundReads.js';
import { runReadJob, type ReadJob } from '../main/background/jobs.js';

const setup = workerData as WorkerSetup;
let db: Db | null = null;
const connection = () => (db ??= openDatabase(setup.dbFile, { readonly: true, quickCheck: false, ...(setup.nativeBinding && { nativeBinding: setup.nativeBinding }) }));

parentPort?.on('message', (m: { id: number; kind: ReadJob; input: never }) => {
  let reply: JobReply;
  try {
    reply = { id: m.id, ok: true, value: runReadJob(connection(), m.kind, m.input) };
  } catch (e) {
    reply = { id: m.id, ok: false, error: toJobError(e) };
  }
  parentPort?.postMessage(reply);
});
