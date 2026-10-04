import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HydrationStatus } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';

const IN_PROGRESS = new Set<HydrationStatus['status']>(['pending', 'downloading', 'importing']);
const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

function percent(s: HydrationStatus): number {
  if (s.status === 'importing' && s.linesTotal) return 50 + Math.round((50 * s.linesImported) / s.linesTotal);
  if (s.bytesTotal) return Math.round((50 * s.bytesDownloaded) / s.bytesTotal);
  return 0;
}

function phase(s: HydrationStatus): string {
  if (s.status === 'downloading') return `Downloading the business · ${mb(s.bytesDownloaded)}${s.bytesTotal ? ` of ${mb(s.bytesTotal)}` : ''}`;
  if (s.status === 'importing') return `Setting up this device · ${s.linesImported.toLocaleString('en-IN')}${s.linesTotal ? ` of ${s.linesTotal.toLocaleString('en-IN')}` : ''} records`;
  return 'Asking the cloud to prepare the business…';
}

// 7f setup step (FR-086): pick a business this user belongs to, import it with progress, and open billing only when ready.
export default function SetupAddDevice({ onReady, onCancel }: { onReady: () => void; onCancel?: () => void }) {
  const businesses = useQuery({ queryKey: ['cloudBusinesses'], queryFn: () => api.sync.listCloudBusinesses({}) });
  const [status, setStatus] = useState<HydrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<{ id: string; name: string; phase: 'confirm' | 'running' | 'done' } | null>(null);

  useEffect(() => {
    void api.sync.hydrationStatus({}).then(setStatus);
    return api.events.on('sync.hydration', setStatus);
  }, []);
  useEffect(() => { if (status?.status === 'ready' && !status.held) onReady(); }, [status, onReady]);

  async function start(businessId: string) {
    setError(null);
    try { setStatus(await api.sync.hydrationStart({ businessId })); } catch (e) { setError(errorMessage(e)); }
  }

  // 8f (ADR-0047): the newest encrypted cloud backup, with the escrowed key, becomes this device's database; a pull then catches up.
  async function restoreFromBackup(businessId: string, name: string) {
    setError(null);
    setRestoring({ id: businessId, name, phase: 'running' });
    try {
      await api.backups.restoreFromCloud({ businessId, confirm: true });
      setRestoring({ id: businessId, name, phase: 'done' });
    } catch (e) {
      setRestoring(null);
      setError(errorMessage(e));
    }
  }

  if (restoring && restoring.phase !== 'confirm') {
    return (
      <section className="space-y-4" aria-live="polite">
        <h2 className="text-lg font-semibold">Restoring {restoring.name} from its cloud backup</h2>
        <p className="text-sm text-slate-600">{restoring.phase === 'running' ? 'Downloading, decrypting and checking the backup…' : 'Restored. Muneem is restarting; sign in again to catch up with the cloud.'}</p>
      </section>
    );
  }

  if (status && IN_PROGRESS.has(status.status)) {
    return (
      <section className="space-y-4" aria-live="polite">
        <h2 className="text-lg font-semibold">Adding this device to the business</h2>
        <progress className="w-full h-3" max={100} value={percent(status)} aria-label="Import progress" />
        <p className="text-sm text-slate-600">{phase(status)}</p>
        <p className="text-sm text-slate-500">Billing opens when this device is ready to bill offline. You can leave this running.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Add this device to an existing business</h2>
      {(error ?? (status?.status === 'failed' ? status.error : null)) && <p className="err" role="alert">{error ?? status?.error}</p>}
      {businesses.isLoading && <p className="text-sm text-slate-500">Loading your businesses…</p>}
      {businesses.error && <p className="err" role="alert">{errorMessage(businesses.error)}</p>}
      <ul className="divide-y border rounded-md">
        {(businesses.data ?? []).map((b) => (
          <li key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span><b>{b.name}</b>{b.onThisDevice && <span className="ml-2 text-xs text-slate-500">(already on this device)</span>}</span>
            <span className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRestoring({ id: b.id, name: b.name, phase: 'confirm' })}>Restore from cloud backup</button>
              <button type="button" className="btn-primary" onClick={() => void start(b.id)}>
                {status?.status === 'failed' && status.businessId === b.id ? 'Try again' : 'Add this device'}
              </button>
            </span>
          </li>
        ))}
        {businesses.data?.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">You are not a member of any business on the cloud yet.</li>}
      </ul>
      {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Create a new business instead</button>}
      {restoring?.phase === 'confirm' && (
        <div role="alertdialog" aria-label="Restore from cloud backup" className="border rounded-md p-3 space-y-2 text-sm">
          <p>Replace this device&apos;s database with the newest cloud backup of <b>{restoring.name}</b>? Muneem restarts when it is done, then syncs anything newer from the cloud.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRestoring(null)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => void restoreFromBackup(restoring.id, restoring.name)}>Restore</button>
          </div>
        </div>
      )}
    </section>
  );
}
