import { existsSync, rmSync, writeFileSync } from 'node:fs';

// ADR-0058: a quick_check reads the whole file (minutes at 500k sales), so start-up runs it only after an exit that did not close the database.
const markerOf = (dbFile: string) => `${dbFile}.clean-exit`;

// True once per clean exit: the marker is removed as it is read, so a crash during this run leaves none behind.
export function takeCleanExit(dbFile: string): boolean {
  const marker = markerOf(dbFile);
  if (!existsSync(marker)) return false;
  rmSync(marker, { force: true });
  return true;
}

export function markCleanExit(dbFile: string): void {
  writeFileSync(markerOf(dbFile), new Date().toISOString());
}
