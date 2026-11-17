import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalEmoji, animalLabel, dateText, inr, shareText, splitName, type Animal, type PayMode, type Program, type AnimalType } from '../lib/programs';
import { ErrorNote, Loading, PageHead, useAction, useFetch } from '../ui/kit';

type Placed = { code: string; shares: number; drawOrder: number | null; slotAt: string | null };
type MyBooking = { id: string; animalType: AnimalType; shares: number; payMode: PayMode; amount: number; animals: Placed[] };
type MyProgram = Program & { mahalluName: string; household: { id: string; ownerName: string; mahalluNumber: string }; bookings: MyBooking[] };

function Stepper({ value, onChange, disabled }: { value: number; onChange(next: number): void; disabled?: boolean }) {
  return <div className="am-stepper" role="group" aria-label="Number of shares">
    <button type="button" className="iconbtn" aria-label="Fewer shares" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>−</button>
    <output aria-live="polite"><b>{value}</b><span>{value === 1 ? 'share' : 'shares'}</span></output>
    <button type="button" className="iconbtn" aria-label="More shares" disabled={disabled || value >= 100} onClick={() => onChange(value + 1)}>+</button>
  </div>;
}

const slotText = (value: string) => new Date(value).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function PlacedList({ items }: { items: Placed[] }) {
  if (!items.length) return <p className="am-note" style={{ margin: 0 }}>Your animal is assigned after bookings close.</p>;
  return <div className="am-placed">{items.map(item => <div key={item.code} className="am-placed-row">
    <span className="am-code">{item.code}</span>
    <span>{item.shares} {item.shares === 1 ? 'share' : 'shares'}</span>
    <span className="am-sub">{item.drawOrder ? `#${item.drawOrder} in line${item.slotAt ? ' · ' + slotText(item.slotAt) : ''}` : 'Order not drawn yet'}</span></div>)}</div>;
}

function AnimalCard({ program, animal, booking, reload }: { program: MyProgram; animal: Animal; booking?: MyBooking; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [shares, setShares] = useState(booking?.shares ?? 1);
  const [mode, setMode] = useState<PayMode>(booking?.payMode ?? 'INSTALLMENTS');
  const open = program.status === 'OPEN';
  const total = shares * animal.sharePrice;
  const dirty = booking ? shares !== booking.shares || mode !== booking.payMode : true;
  const per = animal.sharesPerAnimal === 1 ? 'animal' : 'share';
  return <article className={'am-animal' + (booking ? ' booked' : '')}>
    <div className="am-headrow"><div className="am-animal-head"><span className="ic am-emoji" aria-hidden="true">{animalEmoji[animal.animalType]}</span>
      <div><h3>{animalLabel[animal.animalType]}</h3><div className="am-sub">{shareText(animal.sharesPerAnimal)}</div></div></div>
      {booking && <span className="tag">Booked</span>}</div>
    <div className="am-price"><b>{inr(animal.sharePrice)}</b><span>per {per}{animal.sharesPerAnimal > 1 && ` · ${inr(animal.price)} per animal`}</span></div>
    {open ? <>
      <Stepper value={shares} onChange={setShares} disabled={busy} />
      <div className="seg" role="group" aria-label="How will you pay?">{(['INSTALLMENTS', 'ONE_TIME'] as const).map(value =>
        <button key={value} type="button" className={mode === value ? 'on' : ''} onClick={() => setMode(value)}>{value === 'ONE_TIME' ? 'One-time' : 'Installments'}</button>)}</div>
      <div className="kv"><span>Total</span><b>{inr(total)}</b></div>
      {booking && <PlacedList items={booking.animals} />}
      {error && <p className="am-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="button" className="pillbtn" disabled={busy || !dirty} onClick={() => run(async () => {
          if (booking) await api('/bookings/' + booking.id, 'PATCH', { shares, payMode: mode }, true);
          else await api(`/programs/${program.id}/bookings`, 'POST', { householdId: program.household.id, animalType: animal.animalType, shares, payMode: mode }, true);
          toast(booking ? 'Booking updated' : 'Booked. Payments open in the next step.'); reload();
        })}>{busy ? 'Saving…' : booking ? 'Update booking' : 'Book now'}</button>
        {booking && <button type="button" className="pillbtn danger" disabled={busy} onClick={() => {
          if (!window.confirm('Cancel this booking?')) return;
          void run(async () => { await api('/bookings/' + booking.id, 'DELETE', {}, true); toast('Booking cancelled'); reload(); });
        }}>Cancel</button>}
      </div></> : booking ? <div className="kv"><span>{booking.shares} {booking.shares === 1 ? 'share' : 'shares'}</span><b>{inr(booking.amount)}</b></div> : null}
    {!open && booking && <PlacedList items={booking.animals} />}
  </article>;
}

function ProgramBlock({ program, reload }: { program: MyProgram; reload(): void }) {
  const offered = program.animals.filter(item => item.enabled || program.bookings.some(row => row.animalType === item.animalType));
  const booked = program.bookings.reduce((sum, row) => sum + row.amount, 0);
  return <section className="stack am-reveal">
    <div className="hero-panel" style={{ padding: '26px 28px' }}>
      <span className="tag live"><i />{program.status === 'OPEN' ? 'Open for booking' : 'Ended'} · {program.mahalluName}</span>
      <h2 style={{ marginTop: 14, fontSize: 'clamp(26px, 3vw, 36px)', color: '#fff', fontWeight: 800 }}>{splitName(program.name)[0]}<span className="serif">{splitName(program.name)[1]}</span></h2>
      <p className="sub">Udhiyya on {dateText(program.targetDate)}{program.description ? ` · ${program.description}` : ''}</p>
      <div style={{ marginTop: 18, position: 'relative', zIndex: 1 }}>
        <div className="lbl" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.16em', color: '#a9d4c2' }}>YOUR BOOKINGS · {program.household.ownerName.toUpperCase()}</div>
        <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 38 }}>{inr(booked)}</div></div>
    </div>
    <div className="am-grid-animals">{offered.map(animal => <AnimalCard key={animal.animalType + program.status} program={program} animal={animal}
      booking={program.bookings.find(row => row.animalType === animal.animalType)} reload={reload} />)}</div>
  </section>;
}

export function Programs() {
  const { data, error, loading, reload } = useFetch<MyProgram[]>('/me/programs');
  const { ctx } = useApp();
  return <>
    <PageHead eyebrow="Udhiyya" title={<>Your <span className="serif">programs</span></>}
      sub="Choose your animals, decide how many shares you need, and pick how you would like to pay." />
    {!ctx?.households.length ? <div className="card empty"><h3>Link your household first</h3><p>Programs run by your mahallu appear here once your household is linked.</p>
      <Link className="pillbtn" style={{ marginTop: 14 }} to="/app/join">Link my household</Link></div> :
      loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
        <div className="card empty"><h3>No open programs</h3><p>Your mahallu committee has not started Udhiyya yet. You will see it here as soon as they do.</p></div> :
        <div className="stack">{data.map(program => <ProgramBlock key={program.id} program={program} reload={reload} />)}</div>}
  </>;
}
