/**
 * Resolves a release's version and channel from a tag (or a typed version), and with --write stamps the version
 * into apps/desktop/package.json for this build only (ADR-0056). In GitHub Actions the values go to $GITHUB_OUTPUT.
 * Run: tsx scripts/release-version.ts --ref v1.4.0-beta.2 [--channel auto|dev|beta] [--rollout 100] [--write]
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { assertRollout } from '../apps/desktop/src/main/update/manifest.js';
import { parseReleaseVersion, publishChannelFor } from '../apps/desktop/src/main/update/release.js';

const { values } = parseArgs({
  options: { ref: { type: 'string' }, channel: { type: 'string', default: 'auto' }, rollout: { type: 'string', default: '100' }, write: { type: 'boolean', default: false } },
});
if (!values.ref) throw new Error('--ref <tag or version> is required');

const version = parseReleaseVersion(values.ref);
const channel = publishChannelFor(version, values.channel);
const rollout = Number(values.rollout);
assertRollout(rollout);

if (values.write) {
  const pkgUrl = new URL('../apps/desktop/package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version: string };
  writeFileSync(pkgUrl, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
}
const lines = `version=${version}\nchannel=${channel}\nrollout=${rollout}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
process.stdout.write(lines);
