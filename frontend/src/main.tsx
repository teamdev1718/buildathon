import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/auth';
import { AuthPage } from './pages/auth';
import { Dashboard, Profile } from './pages/account';
import { ChatWidget } from './features/chat/widget';
import './styles.css';

function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <>
    <header><nav aria-label="Main navigation"><Link to="/" className="brand">Buildathon Starter</Link>
      {user ? <><Link to="/dashboard">Dashboard</Link><Link to="/profile">Profile</Link>
        <button className="secondary" disabled={busy} onClick={async () => {
          setBusy(true);
          setError('');
          try { await signOut(); navigate('/login'); }
          catch { setError('Could not sign out. Try again.'); }
          finally { setBusy(false); }
        }}>{busy ? 'Signing out…' : 'Sign out'}</button>
      </> : <Link to="/login">Sign in</Link>}
    </nav></header>
    <main>{error && <p className="notice error" role="alert">{error}</p>}<Outlet /></main>
    {user && <ChatWidget />}
  </>;
}

function Protected() {
  const { user, loading, unavailable } = useAuth();
  if (loading) return <p role="status">Checking your session…</p>;
  if (unavailable) return <div className="panel"><h1>Session unavailable</h1>
    <button onClick={() => window.location.reload()}>Try again</button></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function Home() {
  const { user } = useAuth();
  return <section className="hero">
    <h1>Buildathon Starter</h1>
    <p>Manage your account, connect Telegram, and get help when you need it.</p>
    <div className="actions">{user ? <Link className="button" to="/dashboard">Open dashboard</Link> : <>
      <Link className="button" to="/register">Create an account</Link>
      <Link className="button secondary" to="/login">Sign in</Link>
    </>}</div>
  </section>;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter><AuthProvider><Routes><Route element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="login" element={<AuthPage key="login" mode="login" />} />
    <Route path="register" element={<AuthPage key="register" mode="register" />} />
    <Route path="verify-email" element={<AuthPage key="verify" mode="verify" />} />
    <Route path="forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
    <Route path="reset-password" element={<AuthPage key="reset" mode="reset" />} />
    <Route element={<Protected />}><Route path="dashboard" element={<Dashboard />} />
      <Route path="profile" element={<Profile />} /></Route>
    <Route path="*" element={<section className="panel"><h1>Page not found</h1><Link to="/">Go home</Link></section>} />
  </Route></Routes></AuthProvider></BrowserRouter>,
);

