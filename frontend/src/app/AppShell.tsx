import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChatWidget } from '../features/chat/widget';
import { useAuth } from '../contexts/auth';
import { greeting, initials, useApp } from './lib/app-context';
import { IconBack, IconBell, IconCard, IconChart, IconChevronRight, IconClock, IconCompass, IconDoc, IconHand, IconHome, IconMenu, IconShield, IconUsers } from './ui/Icons';
import './app.css';
import './app-extra.css';
import './app-layout.css';

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
  const { isSuper, adminOf, ctx, volunteer } = useApp();
  const member = (ctx?.households.length ?? 0) > 0;
  const items: Item[] = [{ to: '/app', label: 'Dashboard', icon: <IconHome />, end: true }];
  if (isSuper) items.push({ to: '/app/mahallus', label: 'Mahallus', icon: <IconShield /> });
  if (adminOf.length) items.push({ to: '/app/members', label: 'Members', icon: <IconUsers /> }, { to: '/app/manage/programs', label: 'Programs', icon: <IconDoc /> },
    { to: '/app/volunteers', label: 'Volunteers', icon: <IconHand /> }, { to: '/app/manage/ledger', label: 'Ledger', icon: <IconChart /> });
  if (volunteer?.canStatus) items.push({ to: '/app/volunteer/animals', label: 'Animals', icon: <IconChart /> });
  if (volunteer?.canDistribute) items.push({ to: '/app/volunteer/distribute', label: 'Distribute', icon: <IconHand /> });
  if (member && !adminOf.length) items.push({ to: '/app/tracking', label: 'Animal status', icon: <IconClock /> }, { to: '/app/payments', label: 'Payments', icon: <IconCard /> });
  return items;
}

function roleLabel(isSuper: boolean, admin: boolean, volunteer = false) {
  return isSuper ? 'Super admin' : admin ? 'Mahallu admin' : volunteer ? 'Volunteer' : 'Member';
}

/** The avatar button: Profile and Sign out live here instead of in the navigation. */
function UserMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { user, signOut } = useAuth();
  const { isSuper, adminOf, volunteer } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!user) return null;
  const leave = async () => {
    sessionStorage.removeItem('udhiyya-onboarding-skipped');
    await signOut();
    navigate('/login');
  };
  return <div className="am-usermenu" ref={root}>
    <button type="button" className="avatar sm" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(value => !value)}>{initials(user.name)}</button>
    {open && <div className={'am-menu ' + align} role="menu">
      <div className="am-menu-head"><b>{user.name}</b><span>{roleLabel(isSuper, adminOf.length > 0, !!volunteer)}</span></div>
      <Link role="menuitem" to="/app/profile" onClick={() => setOpen(false)}>Profile</Link>
      <button type="button" role="menuitem" onClick={() => void leave()}>Sign out</button>
    </div>}
  </div>;
}

function Desktop({ items }: { items: Item[] }) {
  const { user } = useAuth();
  const { isSuper, adminOf, activeMahallu, ctx, volunteer, unread } = useApp();
  const navigate = useNavigate();
  if (!user) return null;
  const place = activeMahallu?.mahalluName ?? volunteer?.mahalluName ?? ctx?.households[0]?.mahalluName ?? 'No mahallu yet';
  return <div className="shell-desktop" id="shell-desktop">
    <div className="marquee" aria-hidden="true"><span className="track">{'SAVE · PAY · SHARE · DISTRIBUTE · '.repeat(8)}</span></div>
    <header className="dnav">
      <Link className="logo" to="/app" aria-label="Udhiyya Saver dashboard"><span className="mark">U</span>UDHIYYA SAVER</Link>
      <button type="button" className="iconbtn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} id="d-bell"
        onClick={() => navigate('/app/notifications')}><IconBell />{unread > 0 && <span className="badge">{unread}</span>}</button>
      <UserMenu />
    </header>
    <div className="am-grid">
      <aside className="am-side card" aria-label="Menu">
        <div className="dside-user">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <div className="grow"><div className="n">{user.name}</div><div className="m">{roleLabel(isSuper, adminOf.length > 0, !!volunteer)} • {place}</div></div>
        </div>
        <nav className="dside-nav" aria-label="Sections">
          {items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')}>{item.icon}<span>{item.label}</span></NavLink>)}
        </nav>
        <Link className="am-side-link" to="/transparency">Public ledger</Link>
      </aside>
      <main id="d-main" tabIndex={-1} aria-label="Content"><Outlet /></main>
    </div>
  </div>;
}

function Mobile({ items }: { items: Item[] }) {
  const { user } = useAuth();
  const { unread } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  if (!user) return null;
  const overflow = items.length > 5;
  const tabs = overflow ? items.slice(0, 4) : items;
  const rest = overflow ? items.slice(4) : [];
  return <div className="shell-mobile" id="shell-mobile">
    <header className="mhead"><div className="row">
      <UserMenu align="left" />
      <div style={{ flex: 1, minWidth: 0 }}><div className="greet">{greeting()}</div><div className="name">{user.name}</div></div>
      <button type="button" className="iconbtn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => navigate('/app/notifications')}><IconBell />{unread > 0 && <span className="badge">{unread}</span>}</button>
    </div></header>
    <main id="m-main" tabIndex={-1} aria-label="Content"><div className="mwrap"><Outlet /></div></main>
    <nav className="mtabs" aria-label="App">
      {tabs.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')}>{item.icon}<span>{item.label}</span></NavLink>)}
      {overflow && <button type="button" className={more ? 'on' : ''} onClick={() => setMore(true)}><IconMenu /><span>More</span></button>}
    </nav>
    {more && <div className="msheet" role="dialog" aria-modal="true" aria-label="More">
      <div className="msheet-head">
        <button type="button" className="iconbtn" style={{ background: '#fff' }} onClick={() => setMore(false)} aria-label="Close"><IconBack /></button>
        <div style={{ flex: 1 }}><h2><span className="serif">More</span></h2></div>
      </div>
      <div className="msheet-body">
        {rest.map(item => <button key={item.to} type="button" className="mlist-row" onClick={() => navigate(item.to)}>
          <span className="ic">{item.icon}</span><span className="grow"><span className="t">{item.label}</span></span><IconChevronRight /></button>)}
        <Link className="mlist-row" to="/transparency"><span className="ic"><IconCompass /></span><span className="grow"><span className="t">Public ledger</span></span><IconChevronRight /></Link>
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
      <>{wide ? <Desktop items={items} /> : <Mobile items={items} />}<ChatWidget /></>}
  </div>;
}
