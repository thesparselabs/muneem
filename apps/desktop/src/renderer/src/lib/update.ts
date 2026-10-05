import type { UpdateChannel, UpdateStatus } from '@muneem/contracts';

export const CHANNEL_LABEL: Record<UpdateChannel, string> = { stable: 'Stable', beta: 'Beta (early releases)', dev: 'Dev (internal builds)' };

export function statusLine(s: UpdateStatus): string {
  switch (s.state) {
    case 'disabled': return 'Updates are off in this build';
    case 'idle': return 'Not checked yet';
    case 'checking': return 'Checking for updates…';
    case 'up_to_date': return 'Muneem is up to date';
    case 'available': return `Version ${s.availableVersion} found; starting the download`;
    case 'downloading': return `Downloading version ${s.availableVersion} — ${s.percent ?? 0}%`;
    case 'ready': return `Version ${s.availableVersion} is downloaded and verified`;
    case 'error': return `Update failed: ${s.error ?? 'unknown error'}`;
  }
}

// "Restart and update" only when an update is ready and the till is idle.
export const canRestartNow = (s: UpdateStatus): boolean => s.state === 'ready' && s.installBlockedReason === null;

export function bannerText(s: UpdateStatus | null | undefined): string | null {
  if (!s || s.state !== 'ready') return null;
  return s.installBlockedReason ? `Update ${s.availableVersion} ready — will install when you close the register` : `Update ${s.availableVersion} ready — restart Muneem to install it`;
}
