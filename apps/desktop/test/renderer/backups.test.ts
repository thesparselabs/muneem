import { describe, expect, it } from 'vitest';
import type { BackupHealth, LocalBackup } from '@muneem/contracts';
import { cloudLabel, healthSummary, size } from '../../src/renderer/src/lib/backups.js';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const health = (over: Partial<BackupHealth>): BackupHealth => ({
  status: 'ok', lastSuccessAt: hoursAgo(3), ageHours: 3, lastError: null, lastErrorAt: null, lastUploadAt: hoursAgo(2), lastUploadError: null, awaitingUpload: 0, ...over,
});

describe('backup health line (NFR-011)', () => {
  it('says when the last backup was and what is wrong', () => {
    expect(healthSummary(health({}), NOW)).toEqual({ tone: 'ok', text: 'Last backup 3 h ago · uploaded 2 h ago' });
    expect(healthSummary(health({ status: 'stale', lastSuccessAt: hoursAgo(30) }), NOW)).toEqual({ tone: 'warn', text: 'Last backup 30 h ago — more than a day old' });
    expect(healthSummary(health({ status: 'failing', lastError: 'disk full' }), NOW)).toEqual({ tone: 'error', text: 'Last backup 3 h ago. The latest backup failed: disk full' });
    expect(healthSummary(health({ status: 'never', lastSuccessAt: null }), NOW)).toEqual({ tone: 'warn', text: 'No backup yet' });
    expect(healthSummary(health({ lastUploadError: 'NETWORK_UNREACHABLE' }), NOW).tone).toBe('warn');
  });

  it('labels a backup\'s cloud state and size', () => {
    const b = { cloudStatus: 'failed', cloudError: 'HTTP_503' } as LocalBackup;
    expect(cloudLabel(b)).toBe('Upload failed: HTTP_503');
    expect(cloudLabel({ ...b, cloudStatus: 'uploaded' })).toBe('In the cloud');
    expect(size(2_500_000)).toBe('2.4 MB');
    expect(size(300)).toBe('1 KB');
  });
});
