import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api.js';
import { useUi } from '../store.js';
import Field from '../components/Field.js';

export default function Login() {
  const nav = useNavigate();
  const { online } = useUi();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cached = useQuery({ queryKey: ['cachedUsers'], queryFn: () => api.auth.listCachedUsers({}) });
  useEffect(() => { void api.app.getConnectivity({}); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (mode === 'register') {
        await api.auth.register({ name, identifier, password });
        await api.auth.login({ identifier, password });
      } else if (online) {
        await api.auth.login({ identifier, password });
      } else {
        await api.auth.loginOffline({ identifier, password });
      }
      nav('/');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center">
      <form onSubmit={submit} className="card w-[420px]" aria-labelledby="login-title">
        <h1 id="login-title" className="text-2xl font-semibold mb-1">Muneem</h1>
        <p className="text-sm text-slate-600 mb-5">{online ? 'Connected to Muneem cloud' : 'No internet — signing in with this computer’s saved credentials'}</p>
        <div className="space-y-4">
          {mode === 'register' && (
            <Field label="Your name" htmlFor="name"><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
          )}
          <Field label="Mobile or email" htmlFor="identifier">
            <input id="identifier" className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus={mode === 'login'} autoComplete="username" list="cached-users" />
            <datalist id="cached-users">{cached.data?.map((u) => <option key={u.id} value={u.identifier}>{u.name}</option>)}</datalist>
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : 1} autoComplete="current-password" />
          </Field>
          {error && <p className="err" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : online ? 'Sign in' : 'Sign in offline'}</button>
        </div>
        <div className="flex justify-between mt-4 text-sm">
          {online && <button type="button" className="text-blue-700 underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>}
          {!!cached.data?.length && <button type="button" className="text-blue-700 underline" onClick={() => nav('/switch')}>Switch user with PIN</button>}
        </div>
        {!online && !cached.data?.length && <p className="text-xs text-amber-700 mt-4">No one has signed in on this computer yet. Connect to the internet once to sign in.</p>}
      </form>
    </main>
  );
}
