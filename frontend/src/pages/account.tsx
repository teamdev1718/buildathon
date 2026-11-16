import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AsyncForm, Field, value } from '../components/forms';
import { useAuth } from '../contexts/auth';
import type { User } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  return <section className="panel">
    <h1>Welcome, {user?.name}</h1>
    <p>You’re signed in as {user?.email}.</p>
    <Link className="button" to="/profile">Manage profile</Link>
  </section>;
}

export function Profile() {
  const { user, features, update } = useAuth();
  const [link, setLink] = useState('');
  if (!user) return null;
  return <section className="panel">
    <h1>Profile</h1>
    <p>{user.email} · {user.roles.join(', ')}</p>
    <AsyncForm submit="Save changes" action={async form => {
      update(await api<User>('/users/me', 'PATCH', {
        name: value(form, 'name'), emailOptIn: form.has('emailOptIn'),
      }, true));
      return 'Profile saved.';
    }}>
      <Field label="Display name" name="name" defaultValue={user.name} maxLength={100} autoComplete="name" />
      <label className="check"><input type="checkbox" name="emailOptIn" defaultChecked={user.emailOptIn} />
        Receive email notifications</label>
    </AsyncForm>
    {(features?.telegram || user.telegramConnected) && <div className="stack integration">
      <h2>Telegram</h2>
      {user.telegramConnected ? <AsyncForm submit="Disconnect Telegram" action={async () => {
        await api('/integrations/telegram/link', 'DELETE', {}, true);
        update({ ...user, telegramConnected: false });
        setLink('');
        return 'Telegram disconnected.';
      }} /> : <AsyncForm submit="Get connection link" action={async () => {
        setLink((await api<{ url: string }>('/integrations/telegram/link', 'POST', {}, true)).url);
      }} />}
      {link && <><a href={link} target="_blank" rel="noreferrer">Open Telegram and select Start</a>
        <button className="secondary" onClick={async () => {
          try { update(await api<User>('/users/me', 'GET', undefined, true)); } catch { window.location.reload(); }
        }}>Check connection</button></>}
    </div>}
  </section>;
}

