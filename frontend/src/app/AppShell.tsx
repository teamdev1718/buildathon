import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { greeting, initials, useApp } from './lib/app-context';
import { IconBack, IconBell, IconChevronRight, IconCompass, IconHome, IconMenu, IconShield, IconUsers, IconX } from './ui/Icons';
import './app.css';
import './app-extra.css';

type Item = { to: string; label: string; icon: ReactNode; end?: boolean };

function useWide() {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setWide(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, []);
  return wide;
}

function useItems(): Item[] {
  const { isSuper, adminOf } = useApp();
  const items: Item[] = [{ to: '/app', label: 'Home', icon: <IconHome />, end: true }];
  if (isSuper) items.push({ to: '/app/mahallus', label: 'Mahallus', icon: <IconShield /> });
  if (adminOf.length) items.push({ to: '/app/members', label: 'Members', icon: <IconUsers /> });
  items.push({ to: '/app/join', label: 'My Mahallu', icon: <IconCompass /> });
  return items;
}

function roleLabel(isSuper: boolean, admin: boolean) {
  return isSuper ? 'Super admin' : admin ? 'Mahallu admin' : 'Member';
}

function Desktop({ items }: { items: Item[] }) {
  const { user, signOut } = useAuth();
  const { isSuper, adminOf, activeMahallu, ctx } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  if (!user) return null;
  const place = activeMahallu?.mahalluName ?? ctx?.households[0]?.mahalluName ?? 'No mahallu yet';
  return <div className="shell-desktop" id="shell-desktop">
    <div className="marquee" aria-hidden="true"><span className="track">{'SAVE · PAY · SHARE · DISTRIBUTE · '.repeat(8)}</span></div>
    <header className="dnav">
      <button type="button" className="iconbtn" onClick={() => setOpen(value => !value)} aria-label="Open menu"
        aria-expanded={open} aria-controls="d-side"><IconMenu /></button>
      <Link className="logo" to="/app" aria-label="Udhiyya Saver home"><span className="mark">U</span>UDHIYYA SAVER</Link>
      <nav aria-label="Site" id="d-nav">
        {items.map(item => <NavLink key={item.to} to={item.to} end={item.end}
          className={({ isActive }) => (isActive ? 'on' : '')}>{item.label}</NavLink>)}
      </nav>
      <button type="button" className="iconbtn" aria-label="Notifications" id="d-bell"><IconBell /></button>
      <button type="button" className="loginlink" onClick={async () => { await signOut(); navigate('/login'); }}>Sign out</button>
      <span className="avatar sm" aria-hidden="true">{initials(user.name)}</span>
    </header>

    <div className={'dside-overlay' + (open ? ' open' : '')} onClick={() => setOpen(false)} aria-hidden={!open} />
    <aside className={'dside' + (open ? ' open' : '')} id="d-side" aria-label="Menu" aria-hidden={!open}>
      <div className="dside-body">
        <div className="dside-head">
          <span className="logo"><span className="mark">U</span>UDHIYYA SAVER</span>
          <button type="button" className="iconbtn" onClick={() => setOpen(false)} aria-label="Close menu"><IconX /></button>
        </div>
        <div className="dside-user">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <div className="grow"><div className="n">{user.name}</div><div className="m">{roleLabel(isSuper, adminOf.length > 0)} • {place}</div></div>
          <span className="tag">Verified</span>
        </div>
        <nav className="dside-nav" aria-label="Sections">
          {items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            {item.icon}<span>{item.label}</span></NavLink>)}
        </nav>
      </div>
    </aside>

    <div className="dwrap"><main id="d-main" tabIndex={-1} aria-label="Content"><Outlet /></main></div>
    <footer className="foot"><div className="divider" /><p><strong style={{ color: 'var(--ink2)' }}>UDHIYYA SAVER</strong> — Udhiyya,
      made <span className="serif" style={{ fontSize: 15 }}>easier</span> one month at a time. Funds are held by your mahallu committee.</p></footer>
  </div>;
}

function Mobile({ items }: { items: Item[] }) {
  const { user, signOut } = useAuth();
  const { isSuper, adminOf } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  if (!user) return null;
  const tabs = items.slice(0, 4);
  const rest = items.slice(4);
  return <div className="shell-mobile" id="shell-mobile">
    <header className="mhead"><div className="row">
      <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}><div className="greet">{greeting()}</div><div className="name">{user.name}</div></div>
      <button type="button" className="iconbtn" aria-label="Notifications"><IconBell /></button>
    </div></header>
    <main id="m-main" tabIndex={-1} aria-label="Content"><div className="mwrap"><Outlet /></div></main>
    <nav className="mtabs" aria-label="App">
      {tabs.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')}>
        {item.icon}<span>{item.label}</span></NavLink>)}
      <button type="button" className={more ? 'on' : ''} onClick={() => setMore(true)}><IconMenu /><span>More</span></button>
    </nav>
    {more && <div className="msheet" role="dialog" aria-modal="true" aria-label="More">
      <div className="msheet-head">
        <button type="button" className="iconbtn" style={{ background: '#fff' }} onClick={() => setMore(false)} aria-label="Close"><IconBack /></button>
        <div style={{ flex: 1 }}><h2><span className="serif">More</span></h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{roleLabel(isSuper, adminOf.length > 0)} · {user.email}</div></div>
      </div>
      <div className="msheet-body">
        {rest.map(item => <button key={item.to} type="button" className="mlist-row" onClick={() => navigate(item.to)}>
          <span className="ic">{item.icon}</span><span className="grow"><span className="t">{item.label}</span></span><IconChevronRight /></button>)}
        <button type="button" className="mlist-row" onClick={async () => { await signOut(); navigate('/login'); }}>
          <span className="ic"><IconX /></span><span className="grow"><span className="t">Sign out</span></span></button>
      </div>
    </div>}
  </div>;
}

export function AppShell() {
  const wide = useWide();
  const items = useItems();
  const { loading, error, reload } = useApp();
  return <div className="am">
    <a className="skip" href={wide ? '#d-main' : '#m-main'}>Skip to main content</a>
    {loading ? <p role="status" className="am-loading">Loading your workspace…</p> : error ?
      <div className="am-loading"><p>We could not load your workspace.</p><button className="pillbtn sm" onClick={() => void reload()}>Try again</button></div> :
      wide ? <Desktop items={items} /> : <Mobile items={items} />}
  </div>;
}
