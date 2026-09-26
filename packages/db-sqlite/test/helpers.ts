import { migrate, openDatabase, type Db } from '../src/index.js';

export async function freshDb(): Promise<Db> {
  const db = openDatabase(':memory:', { quickCheck: false });
  await migrate(db);
  return db;
}
export const ACTOR = { userId: '01J0000000000000000000USER', deviceId: '01J000000000000000000DEVICE' };
export const ORG = '01J00000000000000000000ORG1';
