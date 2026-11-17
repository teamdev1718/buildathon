import { api } from '../../api/client';
import { useState } from 'react';
import { useApp } from '../lib/app-context';
import { animalLabel, inr, payModeLabel, shareText, splitName, type AnimalType, type MyBooking, type MyProgram, type PayMode } from '../lib/programs';
import { Stepper } from '../ui/booking';
import { CustomSelect } from '../ui/CustomSelect';
import { Modal, useAction } from '../ui/kit';

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


/** Change or add the household's choices while a programme is open. Opened from the dashboard, not from the profile. */
export function SelectionModal({ programs, reload, close }: { programs: MyProgram[]; reload(): void; close(): void }) {
  const open = programs.filter(item => item.status === 'OPEN');
  return <Modal title={<>Change your <span className="serif">selection</span></>} onClose={close}>
    {open.length === 0 ? <p className="am-note">There is no running programme to change right now.</p> : open.map(program => <div key={program.id} className="stack" style={{ gap: 14 }}>
      <div className="am-sub">{splitName(program.name).join('')} · {program.mahalluName}</div>
      {program.bookings.map(booking => <BookingEditor key={booking.id + booking.shares + booking.payMode} program={program} booking={booking} reload={reload} />)}
      <AddAnimal program={program} reload={reload} />
      <p className="am-note" style={{ margin: 0 }}>A booking that already has payments cannot be removed here. Ask your committee to adjust it.</p></div>)}
  </Modal>;
}
