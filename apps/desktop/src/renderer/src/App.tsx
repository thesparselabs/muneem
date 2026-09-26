import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { useUi } from './store.js';
import Login from './routes/Login.js';
import SwitchUser from './routes/SwitchUser.js';
import Setup from './routes/Setup.js';
import Shell from './routes/Shell.js';
import Home from './routes/Home.js';
import Diagnostics from './routes/Diagnostics.js';

export default function App() {
  const { session, setSession, setSync, setOnline } = useUi();
  const loc = useLocation();
  useEffect(() => {
    void api.auth.getSession({}).then(setSession);
    void api.app.getConnectivity({}).then((c) => setOnline(c.online));
    void api.sync.getStatus({}).then(setSync);
    const offs = [
      api.events.on('session.changed', setSession),
      api.events.on('sync.status', setSync),
      api.events.on('connectivity.changed', (c) => setOnline(c.online)),
    ];
    return () => offs.forEach((f) => f());
  }, [setSession, setSync, setOnline]);

  if (session === undefined) return <div className="p-10 text-slate-500">Starting Muneem…</div>;
  if (!session && loc.pathname !== '/login' && loc.pathname !== '/switch') return <Navigate to="/login" replace />;
  if (session && !session.businessId && loc.pathname !== '/setup') return <Navigate to="/setup" replace />;
  if (session && session.businessId && !session.terminalId && loc.pathname !== '/setup') return <Navigate to="/setup" replace />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/switch" element={<SwitchUser />} />
      <Route path="/setup" element={<Setup />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
