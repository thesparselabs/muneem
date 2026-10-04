import { describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { openDatabase, migrate } from '@muneem/db-sqlite';
import { channelFeedUrl, channelManifestUrl, defaultChannelFor, metaChannelStore } from '../../src/main/update/channels.js';
import { cohortOf, inRollout } from '../../src/main/update/cohort.js';
import { compareVersions } from '../../src/main/update/version.js';

describe('staged rollout cohort', () => {
  it('is a stable 0–99 bucket of the installation id', () => {
    const id = '01J9ZQ7K3M5N8P0R2T4V6X8Z0A';
    expect(cohortOf(id)).toBe(cohortOf(id));
    expect(cohortOf(id)).toBeGreaterThanOrEqual(0);
    expect(cohortOf(id)).toBeLessThan(100);
    expect(new Set(Array.from({ length: 500 }, () => cohortOf(newUlid()))).size).toBeGreaterThan(90);
  });

  it('spreads installations evenly, so a 10% rollout reaches about a tenth of shops', () => {
    const ids = Array.from({ length: 20_000 }, () => newUlid());
    const buckets = new Array<number>(100).fill(0);
    for (const id of ids) buckets[cohortOf(id)]!++;
    expect(Math.min(...buckets)).toBeGreaterThan(130);
    expect(Math.max(...buckets)).toBeLessThan(270);
    const share = ids.filter((id) => inRollout(id, 10)).length / ids.length;
    expect(share).toBeGreaterThan(0.09);
    expect(share).toBeLessThan(0.11);
  });

  it('widening the rollout keeps everyone already in it', () => {
    const ids = Array.from({ length: 2_000 }, () => newUlid());
    for (const id of ids) if (inRollout(id, 5)) expect(inRollout(id, 50)).toBe(true);
  });

  it('treats a missing percentage as everyone, 0 as no one and 100 as everyone', () => {
    const id = newUlid();
    expect(inRollout(id, null)).toBe(true);
    expect(inRollout(id, undefined)).toBe(true);
    expect(inRollout(id, 0)).toBe(false);
    expect(inRollout(id, 100)).toBe(true);
    expect(inRollout(id, cohortOf(id))).toBe(false);
    expect(inRollout(id, cohortOf(id) + 1)).toBe(true);
  });
});

describe('update channels', () => {
  it('feeds each channel from its own folder', () => {
    expect(channelFeedUrl('https://updates.muneem.app/', 'beta')).toBe('https://updates.muneem.app/beta');
    expect(channelManifestUrl('https://updates.muneem.app', 'stable')).toBe('https://updates.muneem.app/stable/latest.yml');
    expect(channelManifestUrl('file:///srv/updates', 'dev')).toBe('file:///srv/updates/dev/latest.yml');
  });

  it('starts on the channel the build version names and remembers a change per installation', async () => {
    expect(defaultChannelFor('1.4.0')).toBe('stable');
    expect(defaultChannelFor('1.5.0-beta.2')).toBe('beta');
    expect(defaultChannelFor('1.5.0-dev.7')).toBe('dev');
    const db = openDatabase(':memory:', { quickCheck: false });
    await migrate(db);
    const store = metaChannelStore(() => db, 'stable');
    expect(store.get()).toBe('stable');
    store.set('beta');
    expect(store.get()).toBe('beta');
    db.prepare("UPDATE app_meta SET value = 'nightly' WHERE key = 'update_channel'").run();
    expect(store.get()).toBe('stable');
  });

  it('orders versions by semver precedence', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});
