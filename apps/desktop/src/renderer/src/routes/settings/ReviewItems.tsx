import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewItem } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { useCan } from '../../lib/permissions.js';
import { diffVersions, groupReviewItems, ruleLabel, winnerLabel } from '../../lib/sync/review.js';
import { Inbox, Check } from 'lucide-react';

type Filter = 'open' | 'reviewed' | 'all';
const FILTERS: [Filter, string][] = [['open', 'Open'], ['reviewed', 'Reviewed'], ['all', 'All']];
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function ReviewItems() {
  const qc = useQueryClient();
  const canManage = useCan('sync.manage');
  const [filter, setFilter] = useState<Filter>('open');
  const [message, setMessage] = useState<string | null>(null);
  const items = useQuery({ queryKey: ['reviewItems', filter], queryFn: () => api.sync.listReviewItems({ status: filter }) });
  const mark = async (ids: string[]) => {
    try {
      const r = await api.sync.markReviewed({ ids });
      setMessage(`Marked ${r.reviewed} reviewed`);
    } catch (e) { setMessage(errorMessage(e)); }
    await qc.invalidateQueries({ queryKey: ['reviewItems'] });
    await qc.invalidateQueries({ queryKey: ['syncOverview'] });
  };
  const groups = groupReviewItems(items.data ?? []);
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Inbox size={22} className="text-primary" aria-hidden />Review items</h1>
      <p className="text-sm text-muted-foreground">How the cloud settled edits that crossed between terminals. Nothing here needs undoing; each item says which version was kept and keeps the other.</p>
      <div className="flex gap-1" role="tablist">
        {FILTERS.map(([f, label]) => <button key={f} type="button" role="tab" aria-selected={filter === f} className={`btn-secondary py-1 ${filter === f ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setFilter(f)}>{label}</button>)}
      </div>
      {message && <p className="text-sm" role="status">{message}</p>}
      {items.isSuccess && groups.length === 0 && <p className="text-sm text-muted-foreground">{filter === 'open' ? 'Nothing to review.' : 'No items.'}</p>}
      {groups.map((g) => {
        const open = g.items.filter((i) => !i.reviewedAt).map((i) => i.id);
        return (
          <section key={g.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{g.label} <span className="text-sm font-normal text-muted-foreground">({g.items.length})</span></h2>
              {canManage && open.length > 1 && <button type="button" className="btn-secondary py-1" onClick={() => void mark(open.slice(0, 200))}>Mark all reviewed</button>}
            </div>
            {g.items.map((i) => <ReviewCard key={i.id} item={i} canManage={canManage} onReviewed={() => void mark([i.id])} />)}
          </section>
        );
      })}
    </div>
  );
}

function ReviewCard({ item, canManage, onReviewed }: { item: ReviewItem; canManage: boolean; onReviewed: () => void }) {
  const rows = diffVersions(item);
  const cloudWon = item.winner === 'cloud';
  return (
    <article className="card space-y-2 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{item.entityLabel ?? item.entityType} {item.field && <span className="text-muted-foreground">· {item.field}</span>}</p>
          <p className="font-mono text-xs text-muted-foreground">{item.entityType} {item.entityId}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{when(item.occurredAt)}</p>
          {item.deviceId && <p>from device <span className="font-mono">{item.deviceId}</span></p>}
        </div>
      </div>
      <p>{ruleLabel(item.rule)} · kept: <span className="font-medium">{winnerLabel(item.winner)}</span></p>
      {rows.length > 0 && (
        <table className="w-full table-fixed text-xs">
          <thead className="text-left text-muted-foreground"><tr><th className="w-1/5 p-1 font-normal">Field</th>
            <th className={`p-1 font-normal ${cloudWon ? 'text-green-800 dark:text-green-400' : ''}`}>Cloud{cloudWon && ' (kept)'}</th>
            <th className={`p-1 font-normal ${cloudWon ? '' : 'text-green-800 dark:text-green-400'}`}>Device edit{!cloudWon && ' (kept)'}</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.key} className={`border-t ${r.differs ? 'bg-amber-50 dark:bg-amber-500/20' : ''}`}>
              <td className="p-1 font-medium">{r.key}</td><td className="break-all p-1 font-mono">{r.cloud}</td><td className="break-all p-1 font-mono">{r.device}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <div className="flex items-center justify-between">
        {item.reviewedAt ? <p className="text-xs text-muted-foreground">Reviewed {when(item.reviewedAt)}</p> : <span />}
        {canManage && !item.reviewedAt && <button type="button" className="btn-secondary py-1" onClick={onReviewed}><Check size={14} aria-hidden />Mark reviewed</button>}
      </div>
    </article>
  );
}
