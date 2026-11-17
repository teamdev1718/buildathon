import { Link, Outlet } from 'react-router-dom';
import './app.css';
import './app-extra.css';
import './auth.css';

export function AuthLayout() {
  return <div className="am am-auth">
    <header className="am-auth-nav">
      <Link className="logo" to="/" aria-label="Udhiyya Saver home"><span className="mark">U</span>UDHIYYA SAVER</Link>
      <Link className="am-auth-back" to="/">Back to site</Link>
    </header>
    <main><Outlet /></main>
  </div>;
}
