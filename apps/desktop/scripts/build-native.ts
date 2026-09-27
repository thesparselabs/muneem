/**
 * Builds better-sqlite3 for Electron's ABI into apps/desktop/native/ WITHOUT touching the copy in
 * node_modules (which must stay on Node's ABI for the package test suites). The main process passes
 * this file to openDatabase({ nativeBinding }).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, copyFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const require = createRequire(import.meta.url);
const electronVersion = (require('electron/package.json') as { version: string }).version;
const sqlitePkgDir = realpathSync(dirname(require.resolve('better-sqlite3/package.json')));
const sqliteVersion = (JSON.parse(readFileSync(join(sqlitePkgDir, 'package.json'), 'utf8')) as { version: string }).version;
const out = join(appDir, 'native', 'better_sqlite3.node');
const stamp = join(appDir, 'native', 'stamp.json');
const want = JSON.stringify({ electronVersion, sqliteVersion, platform: process.platform, arch: process.arch });

if (existsSync(out) && existsSync(stamp) && readFileSync(stamp, 'utf8') === want) {
  console.log(`native: up to date (electron ${electronVersion}, better-sqlite3 ${sqliteVersion})`);
  process.exit(0);
}
// OUTSIDE the repo: electron-rebuild resolves modules upward from module-dir, and must never find (and rebuild) the workspace's Node-ABI copy.
const tmp = join(tmpdir(), 'muneem-native-build');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, 'node_modules'), { recursive: true });
cpSync(sqlitePkgDir, join(tmp, 'node_modules', 'better-sqlite3'), { recursive: true, dereference: true });
require('node:fs').writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'muneem-native-build', private: true, dependencies: { 'better-sqlite3': sqliteVersion } }));
// prebuild-install is a dependency of better-sqlite3; electron-rebuild uses it first, node-gyp as fallback.
const rebuild = join(appDir, 'node_modules', '.bin', 'electron-rebuild');
console.log(`native: building better-sqlite3 ${sqliteVersion} for electron ${electronVersion}…`);
execSync(`"${rebuild}" --module-dir "${tmp}" --only better-sqlite3 --force --version ${electronVersion}`, { stdio: 'inherit' });
const built = join(tmp, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
if (!existsSync(built)) throw new Error('native build produced no binary');
mkdirSync(dirname(out), { recursive: true });
copyFileSync(built, out);
require('node:fs').writeFileSync(stamp, want);
rmSync(tmp, { recursive: true, force: true });
console.log(`native: wrote ${out}`);
