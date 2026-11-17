import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import type { User } from '../../types';
import { useApp, initials } from '../lib/app-context';
import { IconBell, IconCheck, IconHome, IconInfo, IconSend } from '../ui/Icons';
import { IconLock, IconMail, IconPhone, IconUser } from '../ui/more-icons';
import { useAction } from '../ui/kit';
import { Skyline } from '../ui/visuals';
import { HouseholdLink } from './Join';

function IconField({ label, icon, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: ReactNode; hint?: string }) {
  return <div className="field"><label>{label}</label>
    <div className={'am-iconfield' + (input.readOnly ? ' locked' : '')}><span className="lead" aria-hidden="true">{icon}</span>
      <input className="inp" {...input} />{input.readOnly && <span className="trail" aria-hidden="true"><IconLock /></span>}</div>
    {hint && <div className="hint">{hint}</div>}</div>;
}

function Account() {
  const { user, update } = useAuth();
  const { toast } = useApp();
  const { busy, error, submit } = useAction();
  if (!user) return null;
  const volunteer = user.email.endsWith('@volunteer.invalid');
  return <section className="card">
    <div className="am-cardhead"><span className="am-bigavatar" aria-hidden="true">{initials(user.name)}</span>
      <div><h2>Account information</h2><span className="am-sub">Your personal details for login and notifications.</span></div></div>
    <form className="am-profileform" onSubmit={submit(async data => {
      const phone = String(data.get('phone') ?? '').trim();
      update(await api<User>('/users/me', 'PATCH', { name: String(data.get('name') ?? '').trim(), phone: phone || null, ...(volunteer ? {} : { emailOptIn: data.has('emailOptIn') }) }, true));
      toast('Profile saved');
    })}>
      <div className="am-profilegrid">
        <div>
          <IconField label="Full name *" name="name" icon={<IconUser />} required maxLength={100} defaultValue={user.name} autoComplete="name" />
          <IconField label="Phone number" name="phone" type="tel" icon={<IconPhone />} defaultValue={user.phone ?? ''} placeholder="+91 98765 43210" autoComplete="tel" maxLength={20} />
        </div>
        {!volunteer && <div>
          <IconField label="Email" icon={<IconMail />} value={user.email} readOnly aria-readonly="true" hint="Your sign-in email cannot be changed." />
          <label className="am-switchrow am-switchcard"><span className="am-switchicon"><IconBell /></span>
            <span><b>Email updates</b><span className="am-sub">Get reminders and important updates about your Udhiyya.</span></span>
            <span className="switch"><input type="checkbox" name="emailOptIn" defaultChecked={user.emailOptIn} aria-label="Email updates" /><span className="tr" /></span></label>
        </div>}
      </div>
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}><IconCheck />{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  </section>;
}

function Membership() {
  const { ctx } = useApp();
  const [adding, setAdding] = useState(false);
  const houses = ctx?.households ?? [];
  return <section className="card">
    <div className="am-cardhead"><span className="am-tile"><IconHome /></span><div><h2>Mahallu membership</h2><span className="am-sub">Your household and mahallu details.</span></div></div>
    {houses.map(item => <div key={item.id} className="am-facts">
      <div className="kv"><span>Mahallu</span><b>{item.mahalluName}</b></div><div className="kv"><span>House owner</span><b>{item.ownerName}</b></div>
      <div className="kv"><span>Mahallu number</span><b>{item.mahalluNumber}</b></div><div className="kv"><span>Members in house</span><b>{item.memberCount}</b></div></div>)}
    {houses.length > 0 && !adding && <div className="am-footnote"><IconInfo />To change these details, please contact your mahallu committee.</div>}
    {houses.length > 0 && !adding && <button type="button" className="am-linkbtn" onClick={() => setAdding(true)}>Link another household</button>}
    {(houses.length === 0 || adding) && <div style={{ marginTop: 14 }}><HouseholdLink done={() => setAdding(false)} /></div>}
  </section>;
}

function Telegram() {
  const { user, features, update } = useAuth();
  const { toast } = useApp();
  const { busy, error, run } = useAction();
  const [link, setLink] = useState('');
  if (!user) return null;
  const available = Boolean(features?.telegram || user.telegramConnected);
  return <section className="card">
    <div className="am-cardhead"><span className="am-tile"><IconSend /></span><div><h2>Telegram updates</h2><span className="am-sub">Get instant updates about allocation, processing and distribution.</span></div></div>
    <div className={'am-statusbox' + (user.telegramConnected ? ' on' : '')}><span className="am-tile sm"><IconCheck /></span>
      <div><b>{user.telegramConnected ? 'Connected' : available ? 'Not connected' : 'Not available yet'}</b>
        <span>{user.telegramConnected ? 'You will also get updates on Telegram.' : available ? 'Connect your Telegram account to receive updates.' : 'Your committee has not turned on Telegram updates.'}</span></div></div>
    {error && <p className="am-error" role="alert">{error}</p>}
    {available && (user.telegramConnected ?
      <button type="button" className="pillbtn ghost am-wide" disabled={busy} onClick={() => run(async () => {
        await api('/integrations/telegram/link', 'DELETE', {}, true); update({ ...user, telegramConnected: false }); setLink(''); toast('Telegram disconnected');
      })}>Disconnect Telegram</button> : link ?
        <div className="row-actions"><a className="pillbtn am-wide" href={link} target="_blank" rel="noreferrer"><IconSend />Open Telegram and tap Start</a>
          <button type="button" className="pillbtn ghost am-wide" disabled={busy} onClick={() => run(async () => update(await api<User>('/users/me', 'GET', undefined, true)))}>Check connection</button></div> :
        <button type="button" className="pillbtn am-wide" disabled={busy} onClick={() => run(async () => setLink((await api<{ url: string }>('/integrations/telegram/link', 'POST', {}, true)).url))}><IconSend />Connect on Telegram</button>)}
  </section>;
}

export function Profile() {
  const { volunteer } = useApp();
  return <>
    <div className="am-track-head">
      <div><div className="eyebrow"><span className="dot" />PROFILE</div><h1 style={{ marginTop: 12 }}>My <span className="serif">Profile</span></h1>
        <p>Manage your account, contact details, and mahallu information.</p></div>
      <Skyline />
    </div>
    <div className="stack">
      <Account />
      {!volunteer && <div className="am-profilecols"><Membership /><Telegram /></div>}
    </div>
  </>;
}
