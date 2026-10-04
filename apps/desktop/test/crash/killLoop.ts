import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', '..');

// The writer must be this very process: the tsx binary forks a second node, and a SIGKILL to the wrapper leaves the writer running.
export const spawnTs = (script: string, args: string[], stdio: Parameters<typeof spawn>[2]['stdio']) =>
  spawn(process.execPath, ['--import', 'tsx', script, ...args], { cwd: appDir, stdio });

// Starts a child, waits until it is working, then SIGKILLs it a random 0–`windowMs` ms later; the child resumes from the database.
export async function killDuring(script: string, args: string[], kills: number, windowMs = 100, random: () => number = Math.random): Promise<void> {
  for (let i = 0; i < kills; i++) {
    const child = spawnTs(script, args, ['ignore', 'pipe', 'inherit']);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('crash child never became ready')), 60_000);
      child.stdout!.on('data', (d: Buffer) => { if (d.toString().includes('ready')) { clearTimeout(timer); resolve(); } });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`crash child exited early (${String(code)})`)); });
    });
    await new Promise((r) => setTimeout(r, Math.floor(random() * windowMs)));
    child.kill('SIGKILL');
    await new Promise<void>((r) => child.once('exit', () => r()));
  }
}

export const killDuringSales = (file: string, kills: number, random: () => number = Math.random): Promise<void> =>
  killDuring(join(here, 'salesChild.ts'), [file], kills, 100, random);
