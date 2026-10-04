import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api.js';
import Dialog from '../../components/Dialog.js';

export default function HeldBillsDialog({ cartInUse, onRetrieve, onClose }: { cartInUse: boolean; onRetrieve: (id: string, holdCurrent: boolean) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const held = useQuery({ queryKey: ['heldBills'], queryFn: () => api.pos.listHeldBills({}) });
  const [error, setError] = useState<string | null>(null);
  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); } catch (e) { setError(errorMessage(e)); }
    await qc.invalidateQueries({ queryKey: ['heldBills'] });
  }
  return (
    <Dialog title="Held bills (F7)" onClose={onClose}>
      {held.data?.length === 0 && <p className="text-sm text-slate-600">No held bills.</p>}
      {error && <p className="err" role="alert">{error}</p>}
      <ul className="divide-y text-sm">
        {held.data?.map((b, i) => (
          <li key={b.id} className="flex items-center justify-between py-2">
            <span>{b.label ?? 'Unnamed'} · {b.lineCount} item(s) · {new Date(b.heldAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="flex gap-2">
              {/* The list arrives after the dialog opens, so F7 then Enter needs the first bill focused here. */}
              <button type="button" className="btn-primary py-1" autoFocus={i === 0} onClick={() => onRetrieve(b.id, cartInUse)}>{cartInUse ? 'Hold current bill and retrieve' : 'Retrieve'}</button>
              <button type="button" className="btn-secondary py-1" onClick={() => void act(() => api.pos.discardBill({ id: b.id }))}>Discard</button>
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
