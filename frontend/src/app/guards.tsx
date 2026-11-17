import { Navigate, Outlet } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-context';
import { AppShell } from './AppShell';

export function AppRoot() {
  return <AppProvider><AppShell /></AppProvider>;
}

/** Keeps screens for one kind of user away from everyone else. */
export function Require({ allow }: { allow: 'super' | 'admin' }) {
  const { isSuper, adminOf, loading } = useApp();
  if (loading) return null;
  const ok = allow === 'super' ? isSuper : adminOf.length > 0;
  return ok ? <Outlet /> : <Navigate to="/app" replace />;
}
