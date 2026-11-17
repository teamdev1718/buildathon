import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth';
import { greeting } from '../lib/app-context';
import { animalLabel, dateText, inr, payModeLabel, type MyBooking, type MyProgram } from '../lib/programs';
import { downloadReceipt } from '../lib/receipt';
import { IconBell, IconDownload } from '../ui/Icons';
import { ErrorNote, Loading, useFetch } from '../ui/kit';
import { IconAnimal, IconCalendar, IconMegaphone, IconPlusCircle, IconPulse, IconReceipt, IconWallet } from '../ui/more-icons';
import { Photo, Skyline, Stepper, statusWord, stepsWithDelivery, type Status } from '../ui/visuals';
import { IconPackage } from '../ui/Icons';
import { PayModal } from './PaymentPanel';
import { SelectionModal } from './SelectionModal';

type Handover = { id: string; packets: number; receivedAt: string | null };
type Tracking = { programs: { id: string; handovers: Handover[] }[] };
type Inbox = { unread: number; items: { id: string; kind: string; title: string; body: string; link: string | null; createdAt: string; readAt: string | null }[] };

const ago = (value: string) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.round(minutes / 1440);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
};

function Strip({ items }: { items: { icon: ReactNode; label: string; value: ReactNode; sub?: string }[] }) {
  return <div className="am-strip card" role="list">{items.map(item => <div key={item.label} className="am-strip-item" role="listitem">
    <span className="am-strip-icon">{item.icon}</span><div><span className="am-strip-label">{item.label}</span><b>{item.value}</b>{item.sub && <span>{item.sub}</span>}</div></div>)}</div>;
}

function bannerFor(status: Status, hasCode: boolean, delivered: boolean) {
  if (delivered) return 'Your household has received its meat. Thank you for your Udhiyya.';
  if (!hasCode) return 'Your animal will be assigned once registration closes. We will tell you as soon as it is.';
  if (status === 'PENDING') return 'Your animal is in the queue. We will notify you before the slaughter.';
  if (status === 'SLAUGHTERED') return 'Your animal has been slaughtered. Processing starts soon.';
  if (status === 'PROCESSING') return 'Your meat is being cut and weighed. We will notify you when it is packed.';
  return 'Your meat is packed and ready. We will tell you when it is handed to your household.';
}

export function MemberDashboard({ programs, reload }: { programs: MyProgram[]; reload(): void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const track = useFetch<Tracking>('/me/tracking');
  const inbox = useFetch<Inbox>('/me/inbox');
  const [paying, setPaying] = useState<MyBooking | null>(null);
  const [editing, setEditing] = useState(false);
  const entries = programs.flatMap(program => program.bookings.map(booking => ({ program, booking })));
  const first = entries[0];
  if (!user || !first) return null;

  const handovers = (track.data?.programs ?? []).flatMap(item => item.handovers);
  const delivered = handovers.length > 0;
  const total = entries.reduce((sum, item) => sum + item.booking.money.total, 0);
  const paid = entries.reduce((sum, item) => sum + item.booking.money.paid, 0);
  const shares = entries.reduce((sum, item) => sum + item.booking.shares, 0);
  const percent = total ? Math.min(100, Math.round(paid / total * 100)) : 0;
  const allAnimals = entries.flatMap(item => item.booking.animals);
  const focus = allAnimals.filter(item => item.status !== 'PACKED').sort((a, b) => (a.drawOrder ?? 1e9) - (b.drawOrder ?? 1e9))[0] ?? allAnimals[0];
  const statusLabel = delivered ? 'Distributed' : focus ? (allAnimals.every(item => item.status === 'PACKED') ? 'Packed' : statusWord[focus.status]) : first.program.status === 'OPEN' ? 'Registration open' : 'Closed';
  const open = entries.some(item => item.program.status === 'OPEN');
  const owing = entries.filter(item => item.booking.money.remaining > 0);
  const payNow = () => owing.length === 1 ? setPaying(owing[0].booking) : navigate('/app/payments');
  const receipt = () => downloadReceipt({ member: user.name, household: `${first.program.household.ownerName} (${first.program.household.mahalluNumber})`, mahallu: first.program.mahalluName,
    programme: first.program.name, animal: entries.map(item => animalLabel[item.booking.animalType]).join(', '), shares, total, paid, remaining: total - paid,
    payments: entries.flatMap(item => item.booking.payments.filter(row => row.status === 'CONFIRMED')) });

  return <div className="stack">
    <section className="am-hero2" aria-label="Welcome">
      <div><span className="am-hero2-eyebrow">ASSALAMU ALAIKUM</span><h1>{greeting()}, {user.name.split(' ')[0]}.</h1>
        <p>Here is your Udhiyya at a glance. Track, pay, and follow the process until your meat is delivered.</p></div>
      <Skyline />
    </section>

    <Strip items={[
      { icon: <IconAnimal />, label: 'My animal', value: entries.map(item => animalLabel[item.booking.animalType]).filter((name, index, all) => all.indexOf(name) === index).join(', '), sub: `${shares} ${shares === 1 ? 'share' : 'shares'}` },
      { icon: <IconWallet />, label: 'Payment', value: inr(paid), sub: `of ${inr(total)} paid` },
      { icon: <IconPulse />, label: 'Status', value: <span className="am-pill">{statusLabel}</span> },
      { icon: <IconCalendar />, label: 'Last date to pay', value: dateText(first.program.payBy) },
    ]} />

    <div className="am-dashgrid">
      <div className="stack">
        {entries.map(({ program, booking }) => {
          const placed = booking.animals.length ? booking.animals : [null];
          return placed.map((animal, index) => {
            const status: Status = animal?.status ?? 'PENDING';
            const at = delivered && status === 'PACKED' ? 4 : ['PENDING', 'SLAUGHTERED', 'PROCESSING', 'PACKED'].indexOf(status);
            return <article key={booking.id + index} className="card am-myanimal am-reveal">
              <Photo type={booking.animalType} />
              <div className="am-myanimal-body">
                <div className="am-headrow" style={{ alignItems: 'center' }}>
                  <div><h2>My animal{animal ? ` — ${animal.code}` : ''}</h2>
                    <span className="am-sub">{animalLabel[booking.animalType]} · {animal ? animal.shares : booking.shares} {(animal ? animal.shares : booking.shares) === 1 ? 'share' : 'shares'} · {payModeLabel[booking.payMode]}</span></div>
                  <span className="tag">{program.status === 'OPEN' ? 'Open' : 'Ended'}</span></div>
                <Stepper list={stepsWithDelivery} at={at} label={`Animal progress: ${animal ? statusWord[status] : 'Waiting'}`} />
              </div>
              <div className="am-banner"><span aria-hidden="true">i</span>{bannerFor(status, Boolean(animal), delivered && at === 4)}</div>
            </article>;
          });
        })}
        {open && <button type="button" className="am-linkbtn" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>Edit my selection</button>}
      </div>

      <article className="card am-mypay am-reveal">
        <div className="am-headrow" style={{ alignItems: 'center' }}><div className="am-cardhead" style={{ margin: 0 }}><span className="am-tile sm"><IconWallet /></span><h2>My payments</h2></div>
          <Link className="am-viewall" to="/app/payments">View all →</Link></div>
        <div className="am-bigfig">{inr(paid)} <span>of {inr(total)}</span></div>
        <div className="am-bar"><div className="progress" role="progressbar" aria-label="Amount paid" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: percent + '%' }} /></div><b>{percent}%</b></div>
        <div className="am-two"><div><span>Payment type</span><b>{payModeLabel[first.booking.payMode]}</b></div><div><span>Pay by</span><b className="green">{dateText(first.program.payBy)}</b></div></div>
        <button type="button" className="pillbtn am-wide" disabled={owing.length === 0 || !open} onClick={payNow}>{owing.length === 0 ? 'Fully paid' : 'Pay now'}</button>
      </article>
    </div>

    <div className="am-dashgrid am-dashgrid-b">
      <section className="card">
        <h2 className="am-h2">Quick actions</h2>
        <div className="am-actions">
          <button type="button" disabled={owing.length === 0 || !open} onClick={payNow}><IconPlusCircle /><span>Make payment</span></button>
          <Link to="/app/tracking"><IconPackage /><span>Track my animal</span></Link>
          <Link to="/app/payments"><IconReceipt /><span>Payment history</span></Link>
          <button type="button" onClick={receipt}><IconDownload /><span>Download receipt</span></button>
        </div>
      </section>
      <section className="card">
        <div className="am-headrow" style={{ alignItems: 'center' }}><div className="am-cardhead" style={{ margin: 0 }}><span className="am-tile sm"><IconBell /></span><h2>Updates and notifications</h2></div>
          <Link className="am-viewall" to="/app/notifications">View all →</Link></div>
        <div className="am-updates">
          {inbox.data?.items.slice(0, 3).map(item => <div key={item.id} className="am-update"><span className="am-tile sm"><IconMegaphone /></span>
            <div><b>{item.title}</b><span>{item.body}</span></div><time>{ago(item.createdAt)}</time></div>)}
          {owing.length > 0 && <div className="am-update"><span className="am-tile sm"><IconCalendar /></span>
            <div><b>Last date to pay: {dateText(first.program.payBy)}</b><span>Complete your contribution on time.</span></div><time>Reminder</time></div>}
          {inbox.loading && !inbox.data && <Loading />}
          {inbox.data && inbox.data.items.length === 0 && owing.length === 0 && <p className="am-note">Nothing new right now.</p>}
          {inbox.error && <ErrorNote message={inbox.error} />}
        </div>
      </section>
    </div>
    {paying && <PayModal bookingId={paying.id} money={paying.money} close={() => setPaying(null)} done={reload} />}
    {editing && <SelectionModal programs={programs} reload={reload} close={() => setEditing(false)} />}
  </div>;
}
