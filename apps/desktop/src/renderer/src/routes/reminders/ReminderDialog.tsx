import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import type { DueReminder } from '@muneem/contracts';
import { api, errorMessage, isClientError } from '../../api.js';
import Dialog from '../../components/Dialog.js';
import Field from '../../components/Field.js';
import { shareOutcome } from '../../lib/share/shareText.js';

// FR-088: one reminder over WhatsApp, with the customer's statement to attach (ADR-0070).
export default function ReminderDialog({ due, onClose }: { due: DueReminder; onClose: () => void }) {
  const qc = useQueryClient();
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const preview = useQuery({ queryKey: ['reminderPreview', due.customerId], queryFn: () => api.reminders.preview({ customerId: due.customerId }) });
  useEffect(() => {
    if (!preview.data) return;
    setTo(preview.data.to);
    setMessage(preview.data.message);
  }, [preview.data]);
  const send = useMutation({
    mutationFn: () => api.reminders.send({ customerId: due.customerId, to, message }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['reminders'] }); },
  });
  function submit(e: FormEvent) { e.preventDefault(); send.mutate(); }
  const toError = isClientError(send.error) ? send.error.fields?.to : undefined;
  const outcome = send.data && shareOutcome({ status: 'opened', to: send.data.to, fileName: send.data.fileName });
  return (
    <Dialog title={`Remind ${due.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {preview.error && <p className="err" role="alert">{errorMessage(preview.error)}</p>}
        <Field label="WhatsApp number" htmlFor="rm-to">
          <input id="rm-to" className="input" inputMode="tel" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!toError} required />
        </Field>
        {toError && <p className="err">{toError}</p>}
        <Field label="Message" htmlFor="rm-message" {...(preview.data && { hint: `WhatsApp opens with this message; attach ${preview.data.fileName} from Downloads.` })}>
          <textarea id="rm-message" className="input min-h-28" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} required />
        </Field>
        {send.error && !toError && <p className="err" role="alert">{errorMessage(send.error)}</p>}
        {outcome && <p role="status" className="text-sm text-green-700 dark:text-green-400">{outcome.text}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!preview.data || send.isPending || !!send.data}><MessageCircle size={16} aria-hidden />Open WhatsApp</button>
        </div>
      </form>
    </Dialog>
  );
}
