import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BackupRef } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import { cloudLabel, healthSummary, KIND_LABEL, size } from '../../lib/backups.js';
import { useCan } from '../../lib/permissions.js';
import { useNow } from '../../lib/useNow.js';

const TONE = { ok: 'text-emerald-700 dark:text-green-400', warn: 'text-amber-700 dark:text-amber-300', error: 'text-destructive' } as const;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

interface Pending { ref: BackupRef; label: string }

// Diagnostics → Backups (8f): health, the local and cloud backups, verify, and restore (which restarts the app).
export default function BackupsPanel() {
  const qc = useQueryClient();
  const now = useNow();
  const canRestore = useCan('diagnostics.manage');
  const list = useQuery({ queryKey: ['backups'], queryFn: () => api.backups.list({}) });
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['backups'] });

  const runNow = useMutation({
    mutationFn: () => api.backups.runNow({}),
    onSuccess: (r) => { setMessage(`Backup made (${size(r.backup.bytes)}), encrypted and verified; it will upload in the background.`); void refresh(); },
    onError: (e) => { setMessage(errorMessage(e)); void refresh(); },
  });
  const verify = useMutation({
    mutationFn: (ref: BackupRef) => api.backups.verify(ref),
    onSuccess: (r) => setMessage(r.ok ? `Verified: ${r.detail}.` : `Verification FAILED: ${r.detail}`),
    onError: (e) => setMessage(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: (ref: BackupRef) => api.backups.restore({ ...ref, confirm: true }),
    onSuccess: () => { setConfirming(null); setMessage('Restored. Muneem is restarting…'); },
    onError: (e) => { setConfirming(null); setMessage(errorMessage(e)); },
  });

  const data = list.data;
  const health = data ? healthSummary(data.health, now) : null;
  const busy = verify.isPending || restore.isPending;
  const actions = (ref: BackupRef, label: string) => (
    <td className="py-1 text-right whitespace-nowrap">
      <button type="button" className="btn-secondary py-0.5" disabled={busy} onClick={() => verify.mutate(ref)}>Verify</button>
      {canRestore && <button type="button" className="btn-secondary py-0.5 ml-1" disabled={busy} onClick={() => setConfirming({ ref, label })}>Restore</button>}
    </td>
  );

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Backups</h2>
        <button type="button" className="btn-secondary" onClick={() => runNow.mutate()} disabled={runNow.isPending}>Back up now</button>
      </div>
      {health && <p className={`text-sm ${TONE[health.tone]}`} role="status">{health.text}{data!.health.awaitingUpload > 0 && ` · ${data!.health.awaitingUpload} waiting to upload`}</p>}
      {message && <p className="text-sm" role="status">{message}</p>}
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      {data && (
        <>
          <section>
            <h3 className="mb-1 text-sm text-muted-foreground">On this device</h3>
            <table className="w-full text-sm"><tbody>
              {data.local.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="py-1">{when(b.createdAt)}</td><td className="py-1">{KIND_LABEL[b.kind]}</td><td className="py-1 tabular-nums">{size(b.bytes)}</td>
                  <td className="py-1">{b.encrypted ? cloudLabel(b) : 'Unencrypted copy'}</td>
                  {actions({ source: 'local', id: b.id }, `the ${KIND_LABEL[b.kind].toLowerCase()} backup of ${when(b.createdAt)}`)}
                </tr>
              ))}
              {data.local.length === 0 && <tr><td className="py-1 text-muted-foreground">No backups on this device yet.</td></tr>}
            </tbody></table>
          </section>
          <section>
            <h3 className="mb-1 text-sm text-muted-foreground">In the cloud</h3>
            {data.cloudError && <p className="text-sm text-amber-700 dark:text-amber-300">Cloud backups could not be listed: {data.cloudError}</p>}
            <table className="w-full text-sm"><tbody>
              {data.cloud.map((b) => (
                <tr key={b.backupId} className="border-t border-border">
                  <td className="py-1">{when(b.createdAt)}</td><td className="py-1 tabular-nums">{size(b.bytes)}</td><td className="py-1 font-mono text-xs">{b.deviceId.slice(-6)}</td>
                  {actions({ source: 'cloud', id: b.backupId }, `the cloud backup of ${when(b.createdAt)}`)}
                </tr>
              ))}
              {data.cloud.length === 0 && !data.cloudError && <tr><td className="py-1 text-muted-foreground">No cloud backups yet.</td></tr>}
            </tbody></table>
          </section>
        </>
      )}
      {confirming && (
        <Dialog title="Restore this backup?" onClose={() => setConfirming(null)}>
          <p className="text-sm">The database on this device will be replaced by {confirming.label}. A safety backup of the current database is made first, then Muneem restarts.</p>
          <p className="text-sm mt-2 text-muted-foreground">Anything this device synced after that backup comes back from the cloud. Anything made after it and never synced is only in the safety backup.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={restore.isPending} onClick={() => restore.mutate(confirming.ref)}>{restore.isPending ? 'Restoring…' : 'Restore and restart'}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
