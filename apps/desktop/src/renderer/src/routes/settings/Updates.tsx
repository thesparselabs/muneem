import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UPDATE_CHANNELS, type UpdateChannel, type UpdateStatus } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { useCan } from '../../lib/permissions.js';
import { CHANNEL_LABEL, canRestartNow, statusLine } from '../../lib/update.js';
import { UPDATE_STATUS_KEY, useUpdateStatus } from '../../lib/useUpdateStatus.js';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function Updates() {
  const qc = useQueryClient();
  const status = useUpdateStatus();
  const device = useQuery({ queryKey: ['deviceInfo'], queryFn: () => api.device.getInfo({}) });
  const canInstall = useCan('diagnostics.manage');
  const canChangeChannel = useCan('settings.manage');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (f: () => Promise<UpdateStatus>) => {
    setBusy(true);
    setMessage(null);
    try { qc.setQueryData(UPDATE_STATUS_KEY, await f()); } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  const s = status.data;
  if (!s) return <p className="text-slate-500">Loading…</p>;
  const working = s.state === 'checking' || s.state === 'downloading' || s.state === 'available';
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Updates</h1>
      <section className="card space-y-3 text-sm">
        <dl className="grid grid-cols-[160px_1fr] gap-y-1">
          <dt className="text-slate-500">Installed version</dt><dd>{s.currentVersion}{device.data && <span className="text-slate-500"> · schema {device.data.schemaVersion}</span>}</dd>
          <dt className="text-slate-500">Status</dt><dd aria-live="polite">{statusLine(s)}</dd>
          {s.checkedAt && <><dt className="text-slate-500">Last checked</dt><dd>{when(s.checkedAt)}</dd></>}
        </dl>
        {s.state === 'downloading' && (
          <div className="h-2 w-full rounded bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent ?? 0}>
            <div className="h-2 rounded bg-blue-600" style={{ width: `${s.percent ?? 0}%` }} />
          </div>
        )}
        {s.state === 'ready' && s.installBlockedReason && <p className="text-amber-800">{s.installBlockedReason}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={busy || working || s.state === 'disabled'} onClick={() => void act(() => api.update.checkNow({}))}>Check now</button>
          {canInstall && s.state === 'ready' && (
            <button type="button" className="btn-primary" disabled={busy || !canRestartNow(s)} onClick={() => void act(() => api.update.installNow({}))}>Restart and update</button>
          )}
        </div>
        {message && <p role="alert" className="text-red-700">{message}</p>}
      </section>
      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Channel</h2>
        <p className="text-slate-600">Which releases this computer receives. New releases reach a share of shops first, then everyone.</p>
        <select className="input max-w-xs" value={s.channel} disabled={!canChangeChannel || busy}
          onChange={(e) => void act(() => api.update.setChannel({ channel: e.target.value as UpdateChannel }))}>
          {UPDATE_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
        </select>
        {!canChangeChannel && <p className="text-xs text-slate-500">Only the owner can change the channel.</p>}
      </section>
      {s.lastMigrationFailure && (
        <section className="card space-y-1 text-sm">
          <h2 className="font-semibold text-red-800">An earlier update could not upgrade the data</h2>
          <p>{when(s.lastMigrationFailure.at)} · version {s.lastMigrationFailure.appVersion} · schema {s.lastMigrationFailure.from} → {s.lastMigrationFailure.to}</p>
          <p>{s.lastMigrationFailure.restored ? 'The data was put back as it was before that update.' : 'Putting the backup back failed; contact support.'}</p>
          <p className="font-mono text-xs text-slate-600">{s.lastMigrationFailure.error}</p>
        </section>
      )}
    </div>
  );
}
