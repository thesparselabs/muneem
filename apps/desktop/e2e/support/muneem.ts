import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startStubCloud, type StubCloud } from './stubCloud.js';

const MAIN = resolve(import.meta.dirname, '../../out/main/index.js');
export const VIEWPORT = { width: 1366, height: 768 };
export const ARTIFACTS = resolve(import.meta.dirname, '../../test-results/ui');

export interface Muneem { app: ElectronApplication; page: Page; profile: string; cloud: StubCloud; close: () => Promise<void> }

// A fresh profile per launch: Chromium's --user-data-dir also moves Electron's userData (DB, receipts, logs).
export async function launchMuneem(opts: { cloud?: StubCloud; profile?: string } = {}): Promise<Muneem> {
  const cloud = opts.cloud ?? await startStubCloud();
  const profile = opts.profile ?? mkdtempSync(join(tmpdir(), 'muneem-ui-'));
  const app = await electron.launch({
    args: [MAIN, `--user-data-dir=${profile}`],
    env: { ...process.env, MUNEEM_API_URL: cloud.url, ELECTRON_RENDERER_URL: '' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return {
    app, page, profile, cloud,
    close: async () => {
      await app.close();
      if (!opts.cloud) await cloud.close();
      if (!opts.profile) rmSync(profile, { recursive: true, force: true });
    },
  };
}

export function receipts(profile: string): { name: string; text: string }[] {
  const dir = join(profile, 'receipts');
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));
  } catch { return []; }
}

// The default printer is the simulator, which writes each job as text under userData/receipts.
export async function printed(m: Muneem, docNumber: string): Promise<string> {
  const find = () => receipts(m.profile).find((r) => r.text.includes(docNumber))?.text;
  await expect.poll(() => find() !== undefined, { message: `receipt for ${docNumber} written by the printer simulator` }).toBe(true);
  return find()!;
}

export const savedDocNumber = (status: string | null): string => /Saved (\S+)/u.exec(status ?? '')![1]!;

export async function stubSaveDialog(m: Muneem, filePath: string): Promise<void> {
  await m.app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as typeof dialog.showSaveDialog;
  }, filePath);
}

// NFR-023: every main screen fits 1366 wide; the screenshot is kept as evidence, not compared.
export async function fitsAndSnap(page: Page, name: string): Promise<void> {
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, `${name}.png`) });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width, `${name} overflows horizontally`).toBeLessThanOrEqual(VIEWPORT.width);
}
