import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalEmoji, animalLabel, dateText, inr, shareText, splitName, statusLabel, type Animal, type AnimalType, type Program, type PayMode } from '../lib/programs';
import { CustomSelect } from '../ui/CustomSelect';
import { Allocation } from './ManageAllocation';
import { CashModal, PaymentsCard } from './ManagePayments';
import { ErrorNote, Loading, Modal, PageHead, useAction, useFetch } from '../ui/kit';

type Totals = { animalType: AnimalType; shares: number; animalsNeeded: number; amount: number }[];
type Booking = { id: string; householdId: string; animalType: AnimalType; shares: number; payMode: PayMode; amount: number;
  paid: number; remaining: number; standing: 'PAID' | 'ON_TRACK' | 'BEHIND';
  household: { mahalluNumber: string; ownerName: string; phone: string } };
type Bookings = { totals: Totals; rows: Booking[] };
type Households = { rows: { id: string; mahalluNumber: string; ownerName: string }[] };

function AnimalCard({ program, animal, reload }: { program: Program; animal: Animal; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [price, setPrice] = useState(String(animal.price || ''));
  const locked = program.status === 'ENDED';
  const save = (body: object, message: string) => run(async () => { await api(`/programs/${program.id}/animals/${animal.animalType}`, 'PATCH', body, true); toast(message); reload(); });
  const changed = Number(price || 0) !== animal.price;
  return <article className={'am-animal' + (animal.enabled ? '' : ' off')}>
    <div className="am-headrow"><div className="am-animal-head"><span className="ic am-emoji" aria-hidden="true">{animalEmoji[animal.animalType]}</span>
      <div><h3>{animalLabel[animal.animalType]}</h3><div className="am-sub">{shareText(animal.sharesPerAnimal)}</div></div></div>
      <label className="switch" title={animal.enabled ? 'Offered to members' : 'Hidden from members'}>
        <input type="checkbox" checked={animal.enabled} disabled={busy || locked} aria-label={`Offer ${animalLabel[animal.animalType]}`}
          onChange={event => save({ enabled: event.target.checked }, event.target.checked ? 'Animal offered' : 'Animal hidden')} /><span className="tr" /></label></div>
    <div className="field" style={{ margin: 0 }}><label htmlFor={'p-' + animal.animalType}>Price per animal (₹)</label>
      <div className="am-inline"><input id={'p-' + animal.animalType} className="inp" type="number" min={0} inputMode="numeric" value={price}
        disabled={locked} onChange={event => setPrice(event.target.value)} placeholder="0" />
      <button type="button" className="pillbtn sm" disabled={busy || locked || !changed} onClick={() => save({ price: Number(price || 0) }, 'Price saved')}>Save</button></div></div>
    <div className="kv"><span>{animal.sharesPerAnimal === 1 ? 'Price per person' : 'Price per share'}</span><b>{animal.price ? inr(animal.sharePrice) : '—'}</b></div>
    {error && <p className="am-error" role="alert">{error}</p>}
  </article>;
}

function AddBooking({ program, close, done }: { program: Program; close(): void; done(): void }) {
  const { busy, error, run } = useAction();
  const homes = useFetch<Households>(`/mahallus/${program.mahalluId}/households`);
  const [home, setHome] = useState('');
  const [type, setType] = useState<AnimalType>(program.animals.find(item => item.enabled)?.animalType ?? 'GOAT');
  const [shares, setShares] = useState(1);
  const [mode, setMode] = useState<PayMode>('INSTALLMENTS');
  const { toast } = useApp();
  return <Modal title={<>Add <span className="serif">booking</span></>} onClose={close}>
    {homes.loading ? <Loading /> : <>
      <div className="field"><label>Household</label><CustomSelect variant="input" block value={home} placeholder="Choose a household" ariaLabel="Household"
        options={(homes.data?.rows ?? []).map(row => ({ value: row.id, label: `${row.mahalluNumber} · ${row.ownerName}` }))} onChange={setHome} /></div>
      <div className="field"><label>Animal</label><CustomSelect variant="input" block value={type} ariaLabel="Animal" onChange={value => setType(value as AnimalType)}
        options={program.animals.filter(item => item.enabled).map(item => ({ value: item.animalType, label: `${animalLabel[item.animalType]} · ${inr(item.sharePrice)} per ${item.sharesPerAnimal === 1 ? 'animal' : 'share'}` }))} /></div>
      <div className="field"><label htmlFor="shares">Shares</label><input id="shares" className="inp" type="number" min={1} max={100} value={shares} onChange={event => setShares(Number(event.target.value))} /></div>
      <div className="seg" style={{ marginBottom: 16 }}>{(['INSTALLMENTS', 'ONE_TIME'] as const).map(value => <button key={value} type="button" className={mode === value ? 'on' : ''}
        onClick={() => setMode(value)}>{value === 'ONE_TIME' ? 'One-time' : 'Installments'}</button>)}</div>
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="button" disabled={busy || !home} onClick={() => run(async () => {
        await api(`/programs/${program.id}/bookings`, 'POST', { householdId: home, animalType: type, shares, payMode: mode }, true);
        toast('Booking added'); done(); close();
      })}>{busy ? 'Saving…' : 'Add booking'}</button></>}
  </Modal>;
}

export function ManageProgram() {
  const { id = '' } = useParams();
  const { toast } = useApp();
  const program = useFetch<Program>('/programs/' + id);
  const bookings = useFetch<Bookings>(`/programs/${id}/bookings`);
  const { busy, error, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [cash, setCash] = useState<Booking | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => { program.reload(); bookings.reload(); setVersion(count => count + 1); };
  const p = program.data;
  if (program.loading && !p) return <Loading />;
  if (!p) return <ErrorNote message={program.error} />;
  const act = (path: string, message: string, confirm: string) => {
    if (!window.confirm(confirm)) return;
    void run(async () => { await api(`/programs/${id}/${path}`, 'POST', {}, true); toast(message); reload(); });
  };
  return <>
    <PageHead eyebrow={`${statusLabel[p.status]} program`} title={<>{splitName(p.name)[0]}<span className="serif">{splitName(p.name)[1]}</span></>}
      sub={`Udhiyya on ${dateText(p.targetDate)} · payments due by ${dateText(p.payBy)}.${p.description ? ' ' + p.description : ''}`}
      action={<div className="row-actions">
        {p.status === 'DRAFT' && <button type="button" className="pillbtn" disabled={busy} onClick={() => act('start', 'Program started', 'Start this program? Households will be able to book.')}>Start program</button>}
        {p.status === 'OPEN' && <>
          <button type="button" className="pillbtn ghost" onClick={() => setAdding(true)}>Add booking</button>
          <button type="button" className="pillbtn danger" disabled={busy} onClick={() => act('end', 'Program ended', 'End this program? Bookings and prices can no longer be changed.')}>End program</button></>}
      </div>} />
    {error && <ErrorNote message={error} />}
    <Link to="/app/manage/programs" className="am-back">← All programs</Link>
    <div className="am-grid-animals">{p.animals.map(animal => <AnimalCard key={animal.animalType} program={p} animal={animal} reload={reload} />)}</div>
    <section className="card" style={{ marginTop: 22 }}>
      <div className="eyebrow"><span className="dot" />ANIMALS NEEDED</div>
      <h2 style={{ fontSize: 22, margin: '8px 0 16px' }}>Bookings so <span className="serif">far</span></h2>
      {bookings.loading && !bookings.data ? <Loading /> : !bookings.data ? <ErrorNote message={bookings.error} /> : <>
        {bookings.data.totals.length > 0 && <div className="stat-grid" role="list" style={{ marginTop: 0 }}>
          {bookings.data.totals.map(row => <div className="stat" role="listitem" key={row.animalType}>
            <div className="eyebrow">{animalEmoji[row.animalType]} {animalLabel[row.animalType]}</div>
            <div className="v">{row.animalsNeeded}</div><div className="s">{row.animalsNeeded === 1 ? 'animal' : 'animals'} for {row.shares} {row.shares === 1 ? 'share' : 'shares'} · {inr(row.amount)}</div></div>)}</div>}
        {bookings.data.rows.length === 0 ? <div className="empty"><h3>No bookings yet</h3><p>{p.status === 'DRAFT' ? 'Start the program to let households book.' : 'Bookings will appear here as households join.'}</p></div> :
          <div className="tx-wrap" style={{ marginTop: 18 }}><table className="tx"><thead><tr><th>House</th><th>Owner</th><th>Animal</th><th>Shares</th><th>Plan</th><th>Total</th><th>Paid</th><th>Status</th>{p.status === 'OPEN' && <th />}</tr></thead>
            <tbody>{bookings.data.rows.map(row => <tr key={row.id}><td style={{ fontFamily: 'var(--font-mono)' }}>{row.household.mahalluNumber}</td><td><b>{row.household.ownerName}</b></td>
              <td>{animalEmoji[row.animalType]} {animalLabel[row.animalType]}</td><td>{row.shares}</td><td>{row.payMode === 'ONE_TIME' ? 'One-time' : 'Installments'}</td><td className="amt">{inr(row.amount)}</td><td className="amt">{inr(row.paid)}</td>
              <td><span className={'tag' + (row.standing === 'BEHIND' ? ' amber' : '')}>{row.standing === 'PAID' ? 'Paid' : row.standing === 'BEHIND' ? 'Due' : 'On track'}</span></td>
              {p.status === 'OPEN' && <td><div className="row-actions">{row.remaining > 0 && <button type="button" className="chipbtn" onClick={() => setCash(row)}>Cash</button>}<button type="button" className="chipbtn" onClick={() => {
                if (!window.confirm(`Cancel ${row.household.ownerName}'s booking?`)) return;
                void run(async () => { await api('/bookings/' + row.id, 'DELETE', {}, true); toast('Booking cancelled'); reload(); });
              }}>Cancel</button></div></td>}</tr>)}</tbody></table></div>}</>}
    </section>
    {p.status !== 'DRAFT' && <PaymentsCard programId={id} open={p.status === 'OPEN'} refreshKey={version} onChange={reload} />}
    {p.status !== 'DRAFT' && <Allocation programId={id} open={p.status === 'OPEN'} onChange={reload} />}
    {cash && <CashModal bookingId={cash.id} owner={cash.household.ownerName} remaining={cash.remaining} close={() => setCash(null)} done={reload} />}
    {adding && <AddBooking program={p} close={() => setAdding(false)} done={reload} />}
  </>;
}
