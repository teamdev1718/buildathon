import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import type { User } from '../../types';
import { useApp } from '../lib/app-context';
import { Field, form, PageHead, useAction } from '../ui/kit';
import { HouseholdLink } from './Join';

function Details() {
  const { user, features, update } = useAuth();
  const { toast } = useApp();
  const { busy, error, submit } = useAction();
  const [link, setLink] = useState('');
  const telegram = useAction();
  if (!user) return null;
  const volunteer = user.email.endsWith('@volunteer.invalid');
  return <section className="card">
    <div className="eyebrow"><span className="dot" />YOUR DETAILS</div>
    <h2 style={{ fontSize: 22, margin: '8px 0 16px' }}>About <span className="serif">you</span></h2>
    <form onSubmit={submit(async data => {
      update(await api<User>('/users/me', 'PATCH', { name: form(data, 'name'), emailOptIn: data.has('emailOptIn') }, true));
      toast('Profile saved');
    })}>
      <Field label="Name" name="name" required maxLength={100} defaultValue={user.name} autoComplete="name" />
      {!volunteer && <><div className="field"><label>Email</label><input className="inp" value={user.email} readOnly aria-readonly="true" /><div className="hint">Your sign-in email cannot be changed here.</div></div>
        <label className="am-switchrow" style={{ marginBottom: 16 }}><span><b>Email updates</b><span className="am-sub">Reminders and alerts about your animal and meat.</span></span>
          <span className="switch"><input type="checkbox" name="emailOptIn" defaultChecked={user.emailOptIn} aria-label="Email updates" /><span className="tr" /></span></label></>}
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
    {!volunteer && (features?.telegram || user.telegramConnected) && <div className="am-pay" style={{ marginTop: 20 }}>
      <b>Telegram</b>
      <span className="am-sub">{user.telegramConnected ? 'Connected. You also get updates on Telegram.' : 'Connect to get updates on Telegram.'}</span>
      {telegram.error && <p className="am-error" role="alert">{telegram.error}</p>}
      {user.telegramConnected ? <button type="button" className="pillbtn ghost sm" disabled={telegram.busy} onClick={() => telegram.run(async () => {
        await api('/integrations/telegram/link', 'DELETE', {}, true); update({ ...user, telegramConnected: false }); setLink(''); toast('Telegram disconnected');
      })}>Disconnect Telegram</button> : link ? <div className="row-actions"><a className="pillbtn sm" href={link} target="_blank" rel="noreferrer">Open Telegram and tap Start</a>
        <button type="button" className="pillbtn ghost sm" onClick={() => telegram.run(async () => update(await api<User>('/users/me', 'GET', undefined, true)))}>Check connection</button></div> :
        <button type="button" className="pillbtn sm" disabled={telegram.busy} onClick={() => telegram.run(async () => setLink((await api<{ url: string }>('/integrations/telegram/link', 'POST', {}, true)).url))}>Get connection link</button>}
    </div>}
  </section>;
}

function Household() {
  const { ctx } = useApp();
  const [adding, setAdding] = useState(false);
  const houses = ctx?.households ?? [];
  return <section className="card">
    <div className="am-headrow"><div><div className="eyebrow"><span className="dot" />YOUR HOUSEHOLD</div>
      <h2 style={{ fontSize: 22, margin: '8px 0 12px' }}>Mahallu <span className="serif">membership</span></h2></div>
      {houses.length > 0 && !adding && <button type="button" className="pillbtn ghost sm" onClick={() => setAdding(true)}>Link another</button>}</div>
    {houses.map(item => <div key={item.id} style={{ marginBottom: 12 }}>
      <div className="kv"><span>Mahallu</span><b>{item.mahalluName}</b></div><div className="kv"><span>Owner</span><b>{item.ownerName}</b></div>
      <div className="kv"><span>Mahallu number</span><b>{item.mahalluNumber}</b></div><div className="kv"><span>Members in house</span><b>{item.memberCount}</b></div></div>)}
    {houses.length > 0 && !adding && <p className="am-note">To change these details, ask your mahallu committee.</p>}
    {(houses.length === 0 || adding) && <HouseholdLink done={() => setAdding(false)} />}
  </section>;
}

export function Profile() {
  const { volunteer } = useApp();
  return <>
    <PageHead eyebrow="Account" title={<>Edit your <span className="serif">profile</span></>}
      sub="Your details, notification settings and household." />
    <div className="stack" style={{ maxWidth: 720 }}>
      <Details />
      {!volunteer && <Household />}
    </div>
  </>;
}
