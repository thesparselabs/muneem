import type { UpdateChannel } from '@muneem/contracts';

const parse = (v: string) => {
  const [core = '', pre] = v.replace(/^v/u, '').split('-', 2);
  return { nums: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: pre ?? null };
};

// Semver precedence for x.y.z[-pre]; enough for release versions and their prereleases.
export function compareVersions(a: string, b: string): number {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

// A prerelease build starts on the channel its version names; everything else on stable.
export function defaultChannelFor(version: string): UpdateChannel {
  if (/-dev\b/u.test(version)) return 'dev';
  return /-(beta|rc)\b/u.test(version) ? 'beta' : 'stable';
}
