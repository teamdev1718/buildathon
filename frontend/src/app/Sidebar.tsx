import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { initials, useApp } from './lib/app-context';
import { IconArrowUpRight, IconBook, IconChevronRight } from './ui/Icons';

export type Item = { to: string; label: string; icon: ReactNode; end?: boolean };
export type Group = { label?: string; items: Item[] };

export function roleLabel(isSuper: boolean, admin: boolean, volunteer = false) {
  return isSuper ? 'Super admin' : admin ? 'Mahallu admin' : volunteer ? 'Volunteer' : 'Member';
}

/** "My Udhiyya" with the last word in the italic serif accent. */
function Label({ text }: { text: string }) {
  const at = text.lastIndexOf(' ');
  return <div className="am-sb-label">{at < 0 ? <span className="serif">{text}</span> : <>{text.slice(0, at + 1)}<span className="serif">{text.slice(at + 1)}</span></>}</div>;
}

function Art() {
  return <svg className="am-sb-art" viewBox="0 0 240 130" aria-hidden="true">
    <path d="M0 130V96c34-22 70-24 104-10 28 11 50 12 76-4 24-14 46-12 60 0v48z" fill="#ffffff" fillOpacity=".08" />
    <path d="M118 130v-22c0-18 14-30 32-30s32 12 32 30v22z" fill="#ffffff" fillOpacity=".16" /><path d="M150 78v-7" stroke="#ffffff" strokeOpacity=".2" strokeWidth="3" />
    <rect x="196" y="48" width="9" height="82" fill="#ffffff" fillOpacity=".17" /><path d="M196 48l4.5-17 4.5 17z" fill="#ffffff" fillOpacity=".17" />
    <rect x="222" y="94" width="14" height="36" fill="#ffffff" fillOpacity=".12" /><path d="M222 94a7 7 0 0 1 14 0z" fill="#ffffff" fillOpacity=".12" />
    <path d="M60 30a14 14 0 1 0 9 24 11 11 0 1 1-9-24z" fill="#ffffff" fillOpacity=".25" />
  </svg>;
}

/** One sidebar for every role, on desktop and in the phone drawer. */
export function Sidebar({ groups, onNavigate }: { groups: Group[]; onNavigate?(): void }) {
  const { user } = useAuth();
  const { isSuper, adminOf, activeMahallu, ctx, volunteer } = useApp();
  if (!user) return null;
  const place = (activeMahallu?.mahalluName ?? volunteer?.mahalluName ?? ctx?.households[0]?.mahalluName ?? '').replace(/ mahallu$/i, '');
  return <div className="am-sidebar">
    <Link className="am-sb-brand" to="/app" onClick={onNavigate} aria-label="Udhiyya Saver dashboard"><span className="mark">U</span>UDHIYYA SAVER</Link>
    <Link className="am-sb-user" to="/app/profile" onClick={onNavigate} aria-label="Open your profile">
      <span className="am-sb-avatar" aria-hidden="true">{initials(user.name)}</span>
      <span className="am-sb-who"><b>{user.name}</b><span>{roleLabel(isSuper, adminOf.length > 0, !!volunteer)}{place ? ` • ${place}` : ''}</span></span>
      <IconChevronRight />
    </Link>
    <nav className="am-sb-nav" aria-label="Sections">
      {groups.map((group, index) => <div key={index} className="am-sb-group">
        {group.label && <Label text={group.label} />}
        {group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => 'am-sb-item' + (isActive ? ' on' : '')}>
          {item.icon}<span>{item.label}</span></NavLink>)}
      </div>)}
      <div className="am-sb-group">
        <a className="am-sb-item" href="/transparency" target="_blank" rel="noreferrer"><IconBook /><span>Public ledger</span><IconArrowUpRight className="am-sb-ext" /></a>
      </div>
    </nav>
    <Art />
  </div>;
}
