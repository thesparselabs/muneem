import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DueReminder } from '@muneem/contracts';
import { api, errorMessage } from '../../api.js';
import { cn } from '../../lib/cn.js';
import { formatPaise } from '../../lib/money.js';
import { useCan } from '../../lib/permissions.js';
import { parseEveryDays, reminderStateText } from '../../lib/reminders/text.js';
import { useToasts } from '../../lib/toast.js';
import ReminderDialog from './ReminderDialog.js';
import { BellRing, MessageCircle, Save } from 'lucide-react';

// FR-088 (ADR-0070): customers past due, by the same ageing as the overdue notifications, and the reminders sent.
export default function Reminders() {
  const qc = useQueryClient();
  const push = useToasts((s) => s.push);
  const canSend = useCan('customers.edit');
  const canSetCadence = useCan('settings.manage');
  const [reminding, setReminding] = useState<DueReminder | null>(null);
  const [everyDays, setEveryDays] = useState('');
  const due = useQuery({ queryKey: ['reminders', 'due'], queryFn: () => api.reminders.due({}) });
  const history = useQuery({ queryKey: ['reminders', 'history'], queryFn: () => api.reminders.history({ limit: 50 }) });
  useEffect(() => { if (due.data) setEveryDays(String(due.data.everyDays)); }, [due.data]);
  const cadence = useMutation({
    mutationFn: (value: number) => api.settings.set({ key: 'reminders.everyDays', value }),
    onSuccess: () => { push('Reminder cadence saved', 'success'); void qc.invalidateQueries({ queryKey: ['reminders'] }); },
    onError: (e) => push(errorMessage(e), 'error'),
  });
  const days = parseEveryDays(everyDays);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><BellRing size={22} className="text-primary" aria-hidden />Payment reminders</h1>
        {canSetCadence && (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (days) cadence.mutate(days); }}>
            <div><label className="label" htmlFor="rm-every">Remind every (days)</label><input id="rm-every" className="input w-24" inputMode="numeric" value={everyDays} onChange={(e) => setEveryDays(e.target.value)} /></div>
            <button type="submit" className="btn-secondary" disabled={!days || days === due.data?.everyDays || cadence.isPending}><Save size={16} aria-hidden />Save</button>
          </form>
        )}
      </div>
      <p className="text-sm text-muted-foreground">A customer gets at most one reminder every {due.data?.everyDays ?? '…'} days, none for that long after they pay, and none without their WhatsApp consent (recorded on their page).</p>
      {due.error && <p className="err" role="alert">{errorMessage(due.error)}</p>}
      <section aria-label="Customers past due" className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr><th className="p-2">Customer</th><th className="p-2 text-right">Overdue</th><th className="p-2">Oldest due</th><th className="p-2 text-right">Balance</th><th className="p-2">Reminder</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {due.data?.items.map((r) => (
              <tr key={r.customerId} className="border-t border-border">
                <td className="p-2"><Link className="underline-offset-2 hover:underline" to={`/parties/customer/${r.customerId}`}>{r.name}</Link></td>
                <td className="p-2 text-right tabular-nums">{formatPaise(r.overduePaise)}</td>
                <td className="p-2">{r.oldestDueDate} <span className="text-muted-foreground">({r.daysOverdue} days)</span></td>
                <td className="p-2 text-right tabular-nums">{formatPaise(r.balancePaise)}</td>
                <td className={cn('p-2', r.state === 'due' ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{reminderStateText(r)}</td>
                <td className="p-2 text-right">
                  {canSend && r.state === 'due' && (
                    <button type="button" className="btn-secondary gap-1.5 py-1" aria-label={`Remind ${r.name}`} onClick={() => setReminding(r)}><MessageCircle size={14} aria-hidden />Remind</button>
                  )}
                </td>
              </tr>
            ))}
            {due.isSuccess && due.data.items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No customer is past due.</td></tr>}
          </tbody>
        </table>
      </section>
      <section aria-label="Reminders sent" className="space-y-2">
        <h2 className="text-lg font-semibold">Sent from this computer</h2>
        {(history.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="space-y-1 text-sm">
            {history.data!.map((h) => (
              <li key={h.id} className="flex justify-between gap-2 border-b border-border py-1">
                <span>{h.customerName} · {h.to}</span>
                <span className="text-muted-foreground">{formatPaise(h.overduePaise)} overdue · {new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {reminding && <ReminderDialog due={reminding} onClose={() => setReminding(null)} />}
    </div>
  );
}
