import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api.js';

export default function SwitchUser() {
  const nav = useNavigate();
  const users = useQuery({ queryKey: ['cachedUsers'], queryFn: () => api.auth.listCachedUsers({}) });
  const [userId, setUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!userId || pin.length < 4) return;
    try { await api.auth.switchUser({ userId, pin }); nav('/'); } catch (e) { setError(errorMessage(e)); setPin(''); }
  }
  const press = (d: string) => { if (pin.length < 6) setPin(pin + d); };

  return (
    <main className="min-h-screen grid place-items-center">
      <div className="card w-[420px]">
        <h1 className="text-xl font-semibold mb-4">Switch user</h1>
        <label className="label" htmlFor="user">Cashier</label>
        <select id="user" className="input mb-4" value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus>
          <option value="">Select…</option>
          {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.identifier}</option>)}
        </select>
        <label className="label" htmlFor="pin">PIN</label>
        <input id="pin" type="password" inputMode="numeric" className="input text-center text-2xl tracking-[0.5em] mb-3" value={pin} maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} aria-describedby="pin-hint" />
        <div className="grid grid-cols-3 gap-2 mb-3" role="group" aria-label="PIN keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((k) => (
            <button key={k} type="button" className="btn-secondary py-3 text-lg" onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : k === 'OK' ? void submit() : press(k))}>{k}</button>
          ))}
        </div>
        <p id="pin-hint" className="text-xs text-slate-500">4–6 digits. Five wrong attempts lock the PIN for 5 minutes.</p>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="button" className="mt-4 text-sm text-blue-700 underline" onClick={() => nav('/login')}>Sign in with password instead</button>
      </div>
    </main>
  );
}
