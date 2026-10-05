import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AtSign, Lock, User, Wifi, WifiOff } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { useUi } from '../store.js';
import Field from '../components/Field.js';
import Logo from '../components/Logo.js';
import { usePrefersReducedMotion } from '../lib/motion.js';

export default function Login() {
  const nav = useNavigate();
  const { online } = useUi();
  const reduce = usePrefersReducedMotion();
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
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-background via-card to-accent p-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />
      <form onSubmit={submit} aria-labelledby="login-title"
        className={`relative w-[420px] max-w-full rounded-2xl border border-border bg-card/90 p-8 shadow-xl backdrop-blur ${reduce ? '' : 'animate-[fade-up_0.4s_ease-out]'}`}>
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={52} wordmark={false} />
          <h1 id="login-title" className="mt-3 text-2xl font-semibold tracking-tight">Muneem</h1>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${online ? 'bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}{online ? 'Connected to Muneem cloud' : 'Offline — using saved sign-in'}
          </span>
        </div>
        <div className="space-y-4">
          {mode === 'register' && (
            <Field label="Your name" htmlFor="name"><IconInput icon={User}><input id="name" className="input pl-9" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></IconInput></Field>
          )}
          <Field label="Mobile or email" htmlFor="identifier">
            <IconInput icon={AtSign}>
              <input id="identifier" className="input pl-9" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus={mode === 'login'} autoComplete="username" list="cached-users" />
            </IconInput>
            <datalist id="cached-users">{cached.data?.map((u) => <option key={u.id} value={u.identifier}>{u.name}</option>)}</datalist>
          </Field>
          <Field label="Password" htmlFor="password">
            <IconInput icon={Lock}>
              <input id="password" type="password" className="input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : 1} autoComplete="current-password" />
            </IconInput>
          </Field>
          {error && <p className="err" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : online ? 'Sign in' : 'Sign in offline'}</button>
        </div>
        <div className="mt-5 flex justify-between text-sm">
          {online && <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>}
          {!!cached.data?.length && <button type="button" className="font-medium text-primary hover:underline" onClick={() => nav('/switch')}>Switch user with PIN</button>}
        </div>
        {!online && !cached.data?.length && <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">No one has signed in on this computer yet. Connect to the internet once to sign in.</p>}
      </form>
    </main>
  );
}

function IconInput({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
      {children}
    </div>
  );
}
