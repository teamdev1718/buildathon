import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import './app.css';
import './app-extra.css';
import './auth.css';

/** Pages anyone can open without signing in, such as the public ledger. */
export function PublicLayout() {
  const { user } = useAuth();
  return <div className="am am-public">
    <header className="am-auth-nav" style={{ marginTop: 14, background: 'rgba(234, 243, 238, .88)' }}>
      <Link className="logo" to="/" aria-label="Udhiyya Saver home"><span className="mark">U</span>UDHIYYA SAVER</Link>
      <nav className="am-public-links" aria-label="Public"><Link to="/transparency">Public ledgers</Link>
        <Link className="pillbtn sm" to={user ? '/app' : '/login'}>{user ? 'Open app' : 'Sign in'}</Link></nav>
    </header>
    <main className="am-public-main"><Outlet /></main>
    <footer className="foot"><div className="divider" /><p><strong style={{ color: 'var(--ink2)' }}>UDHIYYA SAVER</strong> — books kept in the open. No personal details are shown on public pages.</p></footer>
  </div>;
}
