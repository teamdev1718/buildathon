import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChatWidget } from '../features/chat/widget';
import { useAuth } from '../contexts/auth';
import { greeting, initials, useApp } from './lib/app-context';
import { Sidebar, roleLabel, type Group } from './Sidebar';
import { IconBell, IconCard, IconChart, IconClock, IconDoc, IconHand, IconHome, IconMenu, IconShield, IconUsers, IconX } from './ui/Icons';
import { IconAnimal } from './ui/more-icons';
import './app.css';
import './app-extra.css';
import './app-layout.css';
import './app-pages.css';
import './app-pages2.css';
import './app-volunteer.css';
import './app-sidebar.css';

const storeKey = 'udhiyya-sidebar';

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

/** What each kind of user sees in the sidebar. The phone's bottom bar uses the same list. */
function useGroups(): Group[] {
  const { isSuper, adminOf, ctx, volunteer } = useApp();
  const member = (ctx?.households.length ?? 0) > 0;
  const groups: Group[] = [{ items: [{ to: '/app', label: 'Dashboard', icon: <IconHome />, end: true }] }];
  if (isSuper) groups.push({ label: 'Super admin', items: [{ to: '/app/mahallus', label: 'Mahallus', icon: <IconShield /> }] });
  if (adminOf.length) groups.push({ label: 'My mahallu', items: [
    { to: '/app/members', label: 'Members', icon: <IconUsers /> }, { to: '/app/manage/programs', label: 'Programs', icon: <IconDoc /> },
    { to: '/app/volunteers', label: 'Volunteers', icon: <IconHand /> }, { to: '/app/manage/ledger', label: 'Ledger', icon: <IconChart /> }] });
  if (volunteer) groups.push({ label: 'My tasks', items: [
    ...(volunteer.canStatus ? [{ to: '/app/volunteer/animals', label: 'Animal management', icon: <IconAnimal /> }] : []),
    ...(volunteer.canDistribute ? [{ to: '/app/volunteer/distribute', label: 'Distribute meat', icon: <IconHand /> }] : []),
    { to: '/app/volunteer/activity', label: 'My activity', icon: <IconClock /> }] });
  if (member && !adminOf.length && !volunteer) groups.push({ label: 'My Udhiyya', items: [
    { to: '/app/tracking', label: 'Animal status', icon: <IconAnimal /> }, { to: '/app/payments', label: 'Payments', icon: <IconCard /> }] });
  return groups;
}

/** The avatar button: Profile and Sign out live here. */
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

function Desktop({ groups }: { groups: Group[] }) {
  const { user } = useAuth();
  const { unread } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(storeKey) !== 'closed'; } catch { return true; } });
  const toggle = useCallback(() => setOpen(value => {
    try { localStorage.setItem(storeKey, value ? 'closed' : 'open'); } catch { /* the choice just is not remembered */ }
    return !value;
  }), []);
  if (!user) return null;
  return <div className="shell-desktop" id="shell-desktop">
    <div className="marquee" aria-hidden="true"><span className="track">{'SAVE · PAY · SHARE · DISTRIBUTE · '.repeat(8)}</span></div>
    <header className="dnav">
      <button type="button" className="iconbtn" aria-label={open ? 'Hide menu' : 'Show menu'} aria-expanded={open} aria-controls="am-sidebar" onClick={toggle}>{open ? <IconX /> : <IconMenu />}</button>
      {!open && <Link className="logo" to="/app" aria-label="Udhiyya Saver dashboard"><span className="mark">U</span>UDHIYYA SAVER</Link>}
      <span className="am-spacer" />
      <button type="button" className="iconbtn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} id="d-bell"
        onClick={() => navigate('/app/notifications')}><IconBell />{unread > 0 && <span className="badge">{unread}</span>}</button>
      <UserMenu />
    </header>
    <div className={'am-grid' + (open ? '' : ' closed')}>
      <aside id="am-sidebar" className="am-sbwrap" aria-label="Menu" aria-hidden={!open} inert={!open}><Sidebar groups={groups} /></aside>
      <main id="d-main" tabIndex={-1} aria-label="Content"><Outlet /></main>
    </div>
  </div>;
}

function Mobile({ groups }: { groups: Group[] }) {
  const { user } = useAuth();
  const { unread } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [drawer]);
  if (!user) return null;
  const items = groups.flatMap(group => group.items);
  const tabs = items.length > 4 ? items.slice(0, 4) : items;
  return <div className="shell-mobile" id="shell-mobile">
    <header className="mhead"><div className="row">
      <button type="button" className="iconbtn" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><IconMenu /></button>
      <div style={{ flex: 1, minWidth: 0 }}><div className="greet">{greeting()}</div><div className="name">{user.name}</div></div>
      <button type="button" className="iconbtn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => navigate('/app/notifications')}><IconBell />{unread > 0 && <span className="badge">{unread}</span>}</button>
      <UserMenu />
    </div></header>
    <main id="m-main" tabIndex={-1} aria-label="Content"><div className="mwrap"><Outlet /></div></main>
    <nav className="mtabs" aria-label="App">
      {tabs.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')}>{item.icon}<span>{item.label}</span></NavLink>)}
      {items.length > 4 && <button type="button" onClick={() => setDrawer(true)}><IconMenu /><span>More</span></button>}
    </nav>
    <div className={'am-drawer-overlay' + (drawer ? ' open' : '')} onClick={() => setDrawer(false)} aria-hidden="true" />
    <aside className={'am-drawer' + (drawer ? ' open' : '')} aria-label="Menu" aria-hidden={!drawer} inert={!drawer}>
      <button type="button" className="iconbtn am-drawer-close" aria-label="Close menu" onClick={() => setDrawer(false)}><IconX /></button>
      <Sidebar groups={groups} onNavigate={() => setDrawer(false)} />
    </aside>
  </div>;
}

export function AppShell() {
  const wide = useWide();
  const groups = useGroups();
  const { loading, error, reload } = useApp();
  return <div className="am">
    <a className="skip" href={wide ? '#d-main' : '#m-main'}>Skip to main content</a>
    {loading ? <p role="status" className="am-loading">Loading your workspace…</p> : error ?
      <div className="am-loading"><p>We could not load your workspace.</p><button className="pillbtn sm" onClick={() => void reload()}>Try again</button></div> :
      <>{wide ? <Desktop groups={groups} /> : <Mobile groups={groups} />}<ChatWidget /></>}
  </div>;
}
