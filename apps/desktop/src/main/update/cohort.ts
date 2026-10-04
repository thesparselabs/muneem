import { createHash } from 'node:crypto';

// A stable 0–99 bucket per installation: the same device is always in the same slice of a staged rollout.
export function cohortOf(installationId: string): number {
  return createHash('sha256').update(`muneem-rollout:${installationId}`).digest().readUInt32BE(0) % 100;
}

// No percentage in the manifest means everyone; 10 means cohorts 0–9.
export function inRollout(installationId: string, percentage: number | null | undefined): boolean {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return true;
  return cohortOf(installationId) < Math.min(100, Math.max(0, percentage));
}
