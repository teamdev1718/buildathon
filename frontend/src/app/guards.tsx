import { Navigate, Outlet } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-context';
import { AppShell } from './AppShell';
import { Welcome } from './pages/Welcome';
import './app.css';
import './app-extra.css';

export function AppRoot() {
  return <AppProvider><AppShell /></AppProvider>;
}

/** Keeps screens for one kind of user away from everyone else. */
export function Require({ allow }: { allow: 'super' | 'admin' | 'status' | 'distribute' | 'volunteer' }) {
  const { isSuper, adminOf, volunteer, loading } = useApp();
  if (loading) return null;
  const ok = allow === 'super' ? isSuper : allow === 'admin' ? adminOf.length > 0 : allow === 'status' ? Boolean(volunteer?.canStatus) : allow === 'volunteer' ? Boolean(volunteer) : Boolean(volunteer?.canDistribute);
  return ok ? <Outlet /> : <Navigate to="/app" replace />;
}

/** The first-login slides sit outside the normal menus so nothing distracts from the questions. */
export function WelcomeRoot() {
  return <AppProvider><WelcomeGate /></AppProvider>;
}

function WelcomeGate() {
  const { loading, error, reload } = useApp();
  return <div className="am am-focus">{loading ? <p role="status" className="am-loading">Loading…</p> : error ?
    <div className="am-loading"><p>We could not load your details.</p><button className="pillbtn sm" onClick={() => void reload()}>Try again</button></div> : <Welcome />}</div>;
}
