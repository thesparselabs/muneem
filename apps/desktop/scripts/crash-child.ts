// Child for crash-loop.ts: hammers business/branch/terminal creates until killed.
import { migrate, openDatabase, createBusiness, createBranch, createTerminal } from '@muneem/db-sqlite';
const file = process.argv[2]!;
const db = openDatabase(file, { quickCheck: false });
await migrate(db);
const actor = { userId: '01J0000000000000000000USER', deviceId: '01J000000000000000000DEVICE' };
let i = 0;
for (;;) {
  const b = createBusiness(db, { organizationId: '01J00000000000000000000ORG1', name: `Biz ${i}`, businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 }, actor);
  const br = createBranch(db, b.id, { code: `B${i % 100}`, name: 'Branch', stateCode: '07', isDefault: true }, actor);
  createTerminal(db, b.id, { branchId: br.id, code: 'T01', name: 'Counter' }, actor);
  i++;
}
