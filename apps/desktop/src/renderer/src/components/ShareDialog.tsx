import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { SHARE_CHANNELS, type ShareChannel, type ShareRecord, type ShareTarget } from '@muneem/contracts';
import { api, errorMessage, isClientError } from '../api.js';
import { cn } from '../lib/cn.js';
import { CHANNEL_LABELS, hasPending, sharedAt, shareOutcome, STATUS_LABELS } from '../lib/share/shareText.js';
import Dialog from './Dialog.js';
import Field from './Field.js';

const ICONS = { whatsapp: MessageCircle, email: Mail } as const;

// FR-085: send a document's PDF by WhatsApp or email, with what was sent before (ADR-0067).
export default function ShareDialog({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<ShareChannel>('whatsapp');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<ReturnType<typeof shareOutcome> | null>(null);
  const preview = useQuery({ queryKey: ['sharePreview', target, channel], queryFn: () => api.share.preview({ ...target, channel }) });
  const historyKey = ['shareHistory', target.docType, target.id];
  const history = useQuery({
    queryKey: historyKey, queryFn: () => api.share.history({ docType: target.docType, id: target.id }),
    refetchInterval: (q) => (hasPending(q.state.data ?? []) ? 3000 : false),
  });
  const send = useMutation({
    mutationFn: () => api.share.send({ ...target, channel, to, message }),
    onSuccess: (r: ShareRecord) => { setOutcome(shareOutcome(r)); void qc.invalidateQueries({ queryKey: historyKey }); },
  });
  useEffect(() => {
    if (!preview.data) return;
    setTo(preview.data.to);
    setMessage((m) => m || preview.data.message);
  }, [preview.data]);

  function choose(c: ShareChannel) { setChannel(c); setOutcome(null); send.reset(); }
  function submit(e: FormEvent) { e.preventDefault(); setOutcome(null); send.mutate(); }

  const toError = isClientError(send.error) ? send.error.fields?.to : undefined;
  const fileName = preview.data?.fileName ?? '';
  return (
    <Dialog title={preview.data ? `Share ${preview.data.docLabel}` : 'Share'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div role="group" aria-label="Send by" className="inline-flex overflow-hidden rounded-lg border border-border text-sm font-medium">
          {SHARE_CHANNELS.map((c) => {
            const Icon = ICONS[c];
            return (
              <button key={c} type="button" aria-pressed={channel === c} onClick={() => choose(c)}
                className={cn('flex items-center gap-2 px-4 py-2 transition-colors', channel === c ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>
                <Icon size={16} aria-hidden />{CHANNEL_LABELS[c]}
              </button>
            );
          })}
        </div>
        {preview.error && <p className="err" role="alert">{errorMessage(preview.error)}</p>}
        <Field label={channel === 'whatsapp' ? 'WhatsApp number' : 'Email address'} htmlFor="share-to">
          <input id="share-to" className="input" value={to} onChange={(e) => setTo(e.target.value)} inputMode={channel === 'whatsapp' ? 'tel' : 'email'}
            placeholder={channel === 'whatsapp' ? '98765 43210' : 'name@example.com'} aria-invalid={!!toError} required />
        </Field>
        {toError && <p className="err">{toError}</p>}
        <Field label="Message" htmlFor="share-message"
          hint={channel === 'whatsapp' ? `WhatsApp opens with this message; attach ${fileName} from Downloads.` : `${fileName} is attached. Offline, it goes out once Muneem is back online.`}>
          <textarea id="share-message" className="input min-h-24" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} required />
        </Field>
        {send.error && !toError && <p className="err" role="alert">{errorMessage(send.error)}</p>}
        {outcome && <p role="status" className={outcome.variant === 'error' ? 'err' : 'text-sm text-green-700 dark:text-green-400'}>{outcome.text}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!preview.data || send.isPending}>
            <Send size={16} aria-hidden />{channel === 'whatsapp' ? 'Open WhatsApp' : 'Send email'}
          </button>
        </div>
      </form>
      {(history.data?.length ?? 0) > 0 && (
        <section aria-label="Shared before" className="mt-4 border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-semibold">Shared before</h3>
          <ul className="space-y-1 text-sm">
            {history.data!.map((h) => (
              <li key={h.id} className="flex justify-between gap-2">
                <span>{CHANNEL_LABELS[h.channel]} · {h.to}</span>
                <span className={h.status === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'} title={h.lastError}>
                  {STATUS_LABELS[h.status]} · {sharedAt(h.sentAt ?? h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}
