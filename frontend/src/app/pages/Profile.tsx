import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import type { User } from '../../types';
import { useApp } from '../lib/app-context';
import { animalLabel, inr, payModeLabel, shareText, splitName, type AnimalType, type MyBooking, type MyProgram, type PayMode } from '../lib/programs';
import { Stepper } from '../ui/booking';
import { CustomSelect } from '../ui/CustomSelect';
import { ErrorNote, Field, form, Loading, PageHead, useAction, useFetch } from '../ui/kit';
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

function BookingEditor({ program, booking, reload }: { program: MyProgram; booking: MyBooking; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [shares, setShares] = useState(booking.shares);
  const [mode, setMode] = useState<PayMode>(booking.payMode);
  const animal = program.animals.find(item => item.animalType === booking.animalType);
  const dirty = shares !== booking.shares || mode !== booking.payMode;
  return <article className="am-edit">
    <div className="am-headrow"><div><b style={{ fontSize: 17 }}>{animalLabel[booking.animalType]}</b><div className="am-sub">{animal ? `${inr(animal.sharePrice)} per ${animal.sharesPerAnimal === 1 ? 'animal' : 'share'}` : ''}</div></div>
      <b>{inr(shares * (animal?.sharePrice ?? 0))}</b></div>
    <Stepper value={shares} onChange={setShares} disabled={busy} label={animal?.sharesPerAnimal === 1 ? 'animals' : 'shares'} singular={animal?.sharesPerAnimal === 1 ? 'animal' : 'share'} />
    <div className="seg" role="group" aria-label="Payment type">{(['INSTALLMENTS', 'ONE_TIME'] as const).map(value =>
      <button key={value} type="button" className={mode === value ? 'on' : ''} onClick={() => setMode(value)}>{payModeLabel[value]}</button>)}</div>
    {error && <p className="am-error" role="alert">{error}</p>}
    <div className="row-actions">
      <button type="button" className="pillbtn sm" disabled={busy || !dirty} onClick={() => run(async () => { await api('/bookings/' + booking.id, 'PATCH', { shares, payMode: mode }, true); toast('Selection updated'); reload(); })}>Save</button>
      <button type="button" className="pillbtn danger sm" disabled={busy} onClick={() => {
        if (!window.confirm(`Remove your ${animalLabel[booking.animalType].toLowerCase()} booking?`)) return;
        void run(async () => { await api('/bookings/' + booking.id, 'DELETE', {}, true); toast('Booking removed'); reload(); });
      }}>Remove</button></div>
  </article>;
}

function AddAnimal({ program, reload }: { program: MyProgram; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const available = program.animals.filter(item => item.enabled && !program.bookings.some(row => row.animalType === item.animalType));
  const [type, setType] = useState<AnimalType | ''>('');
  const [shares, setShares] = useState(1);
  const [mode, setMode] = useState<PayMode>('INSTALLMENTS');
  if (!available.length) return null;
  const animal = available.find(item => item.animalType === type);
  return <div className="am-edit">
    <b style={{ fontSize: 17 }}>Add another animal</b>
    <div className="field" style={{ margin: 0 }}><CustomSelect variant="input" block value={type} placeholder="Choose an animal" ariaLabel="Animal" onChange={value => setType(value as AnimalType)}
      options={available.map(item => ({ value: item.animalType, label: `${animalLabel[item.animalType]} · ${inr(item.sharePrice)} per ${item.sharesPerAnimal === 1 ? 'animal' : 'share'}` }))} /></div>
    {animal && <>
      <div className="am-sub">{shareText(animal.sharesPerAnimal)}</div>
      <Stepper value={shares} onChange={setShares} disabled={busy} label={animal.sharesPerAnimal === 1 ? 'animals' : 'shares'} singular={animal.sharesPerAnimal === 1 ? 'animal' : 'share'} />
      <div className="seg" role="group" aria-label="Payment type">{(['INSTALLMENTS', 'ONE_TIME'] as const).map(value =>
        <button key={value} type="button" className={mode === value ? 'on' : ''} onClick={() => setMode(value)}>{payModeLabel[value]}</button>)}</div>
      <div className="kv"><span>Total</span><b>{inr(shares * animal.sharePrice)}</b></div></>}
    {error && <p className="am-error" role="alert">{error}</p>}
    <button type="button" className="pillbtn sm" disabled={busy || !animal} onClick={() => run(async () => {
      await api(`/programs/${program.id}/bookings`, 'POST', { householdId: program.household.id, animalType: type, shares, payMode: mode }, true);
      toast('Animal added'); setType(''); setShares(1); reload();
    })}>Add to my Udhiyya</button>
  </div>;
}

function Selection() {
  const { ctx } = useApp();
  const { data, error, loading, reload } = useFetch<MyProgram[]>(ctx?.households.length ? '/me/programs' : null);
  if (!ctx?.households.length) return null;
  const open = (data ?? []).filter(item => item.status === 'OPEN');
  return <section className="card">
    <div className="eyebrow"><span className="dot" />YOUR UDHIYYA</div>
    <h2 style={{ fontSize: 22, margin: '8px 0 16px' }}>Change your <span className="serif">selection</span></h2>
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : open.length === 0 ? <p className="am-note">There is no running programme to change right now.</p> :
      open.map(program => <div key={program.id} className="stack" style={{ gap: 14 }}>
        <div className="am-sub">{splitName(program.name).join('')} · {program.mahalluName}</div>
        {program.bookings.map(booking => <BookingEditor key={booking.id + booking.shares + booking.payMode} program={program} booking={booking} reload={reload} />)}
        <AddAnimal program={program} reload={reload} />
        <p className="am-note" style={{ margin: 0 }}>A booking that already has payments cannot be removed here. Ask your committee to adjust it.</p></div>)}
  </section>;
}

export function Profile() {
  const { volunteer, adminOf, isSuper } = useApp();
  const member = !volunteer && !adminOf.length && !isSuper;
  return <>
    <PageHead eyebrow="Account" title={<>Edit your <span className="serif">profile</span></>}
      sub={member ? 'Your details, your household and your Udhiyya choices. This is the only place to change them.' : 'Your details and notification settings.'} />
    <div className="stack" style={{ maxWidth: 720 }}>
      <Details />
      {!volunteer && <Household />}
      {!volunteer && <Selection />}
    </div>
  </>;
}
