import { closeSync, mkdtempSync, openSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DbCorruptError, migrate, openDatabase } from '../src/index.js';

async function damaged(offset: (pages: number) => number, pages: number): Promise<string> {
  const file = join(mkdtempSync(join(tmpdir(), 'muneem-open-')), 'muneem.sqlite');
  const db = openDatabase(file);
  await migrate(db);
  db.close();
  const fd = openSync(file, 'r+');
  const junk = Buffer.alloc(4096 * pages, 0xa5);
  writeSync(fd, junk, 0, junk.length, 4096 * offset(Math.floor(statSync(file).size / 4096)));
  closeSync(fd);
  return file;
}

describe('openDatabase on a damaged file (NFR-019)', () => {
  it('reports damaged pages that make quick_check itself fail as DB_CORRUPT', async () => {
    const file = await damaged((pages) => Math.floor(pages / 2), 8);
    expect(() => openDatabase(file)).toThrow(DbCorruptError);
  });

  it('reports a damaged header ("file is not a database") as DB_CORRUPT', async () => {
    const file = await damaged(() => 0, 1);
    expect(() => openDatabase(file)).toThrow(DbCorruptError);
  });
});
