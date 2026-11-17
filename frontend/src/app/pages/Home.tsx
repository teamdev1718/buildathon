import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth';
import { greeting, useApp } from '../lib/app-context';
import { animalLabel, dateText, inr, payModeLabel, splitName, type MyProgram } from '../lib/programs';
import { PlacedList } from '../ui/booking';
import { ErrorNote, Loading, useFetch } from '../ui/kit';
import { PaymentPanel } from './PaymentPanel';
import { skipKey } from './Welcome';

type Mahallu = { id: string; active: boolean; households: number; admins: unknown[] };
type ProgramRow = { id: string; name: string; status: 'DRAFT' | 'OPEN' | 'ENDED'; bookings: number };
type Households = { total: number; linked: number; people: number };

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="stat am-reveal" role="listitem"><div className="eyebrow">{label}</div><div className="v">{value}</div><div className="s">{sub}</div></div>;
}

function SuperStats() {
  const { data, error, loading } = useFetch<Mahallu[]>('/mahallus');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  return <div className="stat-grid" role="list" aria-label="Overview">
    <Stat label="Mahallus" value={data.length} sub={`${data.filter(item => item.active).length} active`} />
    <Stat label="Households" value={data.reduce((sum, item) => sum + item.households, 0)} sub="across all mahallus" />
    <Stat label="Admins" value={data.reduce((sum, item) => sum + item.admins.length, 0)} sub="with committee access" />
    <Stat label="Inactive" value={data.filter(item => !item.active).length} sub="mahallus switched off" />
  </div>;
}

function AdminStats({ mahalluId }: { mahalluId: string }) {
  const { data, error, loading } = useFetch<Households>(`/mahallus/${mahalluId}/households`);
  const programs = useFetch<ProgramRow[]>(`/mahallus/${mahalluId}/programs`);
  if ((loading && !data) || (programs.loading && !programs.data)) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  const current = programs.data?.find(item => item.status !== 'ENDED');
  return <div className="stat-grid" role="list" aria-label="Overview">
    <Stat label="Households" value={data.total} sub="registered members" />
    <Stat label="People" value={data.people} sub="across all houses" />
    <Stat label="Signed up" value={data.linked} sub={`${data.total - data.linked} not yet linked`} />
    <Stat label="Program" value={current ? current.name : 'None'} sub={current ? `${current.status === 'OPEN' ? 'Open' : 'Draft'} · ${current.bookings} bookings` : 'start one under Programs'} />
  </div>;
}

function VolunteerStats() {
  const { data, error, loading } = useFetch<{ program: { name: string } | null; canStatus: boolean; canDistribute: boolean; mahalluName: string }>('/volunteer/me');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  return <div className="stat-grid" role="list" aria-label="Your role">
    <Stat label="Mahallu" value={data.mahalluName} sub="where you volunteer" />
    <Stat label="Program" value={data.program?.name ?? 'None running'} sub={data.program ? 'running now' : 'wait for the admin to start one'} />
    <Stat label="Animal updates" value={data.canStatus ? 'Yes' : 'No'} sub="slaughter, processing, packing" />
    <Stat label="Meat giving" value={data.canDistribute ? 'Yes' : 'No'} sub="hand packets to households" />
  </div>;
}

/** The member's own selection and nothing else: their animal, shares, payment type, money and progress. */
function MyUdhiyya({ programs, reload }: { programs: MyProgram[]; reload(): void }) {
  const mine = programs.flatMap(program => program.bookings.map(booking => ({ program, booking })));
  if (mine.length === 0) return null;
  const total = mine.reduce((sum, item) => sum + item.booking.amount, 0);
  const paid = mine.reduce((sum, item) => sum + item.booking.money.paid, 0);
  const shares = mine.reduce((sum, item) => sum + item.booking.shares, 0);
  return <>
    <div className="stat-grid" role="list" aria-label="Your Udhiyya">
      <Stat label="Programme" value={splitName(mine[0].program.name).join('')} sub={`${mine[0].program.mahalluName} · ${dateText(mine[0].program.targetDate)}`} />
      <Stat label={mine.length === 1 ? 'Your animal' : 'Your animals'} value={mine.map(item => animalLabel[item.booking.animalType]).join(', ')} sub={`${shares} ${shares === 1 ? 'share' : 'shares'}`} />
      <Stat label="Payment" value={payModeLabel[mine[0].booking.payMode]} sub={mine.length > 1 ? 'for your first booking' : `pay in full by ${dateText(mine[0].program.payBy)}`} />
      <Stat label="Paid so far" value={inr(paid)} sub={`of ${inr(total)}`} />
    </div>
    <div className="am-grid-animals">{mine.map(({ program, booking }) => <article key={booking.id} className="am-animal booked am-reveal">
      <div className="am-headrow"><div><h3>{animalLabel[booking.animalType]}</h3>
        <div className="am-sub">{booking.shares} {booking.shares === 1 ? 'share' : 'shares'} · {payModeLabel[booking.payMode]}</div></div>
        <span className="tag">{program.status === 'OPEN' ? 'Open' : 'Ended'}</span></div>
      <div className="kv"><span>Total</span><b>{inr(booking.amount)}</b></div>
      <PlacedList items={booking.animals} />
      <PaymentPanel bookingId={booking.id} payMode={booking.payMode} money={booking.money} payments={booking.payments} autopay={booking.autopay} open={program.status === 'OPEN'} reload={reload} />
    </article>)}</div>
  </>;
}

export function Home() {
  const { user } = useAuth();
  const { ctx, isSuper, activeMahallu, volunteer } = useApp();
  const house = ctx?.households[0];
  const plainMember = !isSuper && !activeMahallu && !volunteer;
  const mine = useFetch<MyProgram[]>(house ? '/me/programs' : null);
  if (!user || !ctx) return null;

  // A member who has not chosen anything yet is taken through the first-login slides.
  if (plainMember && sessionStorage.getItem(skipKey) !== '1') {
    if (!house) return <Navigate to="/app/welcome" replace />;
    if (mine.data && mine.data.some(item => item.status === 'OPEN') && !mine.data.some(item => item.bookings.length > 0)) {
      return <Navigate to="/app/welcome" replace />;
    }
  }

  const first = user.name.split(' ')[0];
  const place = activeMahallu?.mahalluName ?? volunteer?.mahalluName ?? house?.mahalluName;
  const bookings = mine.data?.some(item => item.bookings.length > 0) ?? false;
  return <div className="stack">
    <section className="hero-panel" aria-label="Welcome">
      <span className="tag live"><i />{isSuper ? 'Super admin' : activeMahallu ? 'Mahallu admin' : volunteer ? 'Volunteer' : house ? 'Verified member' : 'Welcome'}{place ? ' · ' + place : ''}</span>
      <h1 style={{ marginTop: 16 }}>{greeting()}, {first}<span className="serif">.</span></h1>
      <p className="sub">{volunteer ? 'Thank you for helping your mahallu. Your tasks are below.' : isSuper ? 'Create mahallus and give their committees access.' :
        activeMahallu ? 'Manage your members and run your Udhiyya programs.' :
          bookings ? 'Here is your Udhiyya. Pay, and follow it all the way to your meat.' :
            house ? 'You are linked to your mahallu. Your programme will appear here as soon as your committee opens one.' :
              'Link your household to your mahallu to join its Udhiyya programme.'}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22, position: 'relative', zIndex: 1 }}>
        {volunteer?.canStatus && <Link className="pillbtn light" to="/app/volunteer/animals">Update animals</Link>}
        {volunteer?.canDistribute && <Link className="pillbtn light" to="/app/volunteer/distribute">Give out meat</Link>}
        {isSuper && <Link className="pillbtn light" to="/app/mahallus">Manage mahallus</Link>}
        {activeMahallu && <Link className="pillbtn light" to="/app/members">Manage members</Link>}
        {activeMahallu && <Link className="pillbtn light" to="/app/manage/programs">Programs</Link>}
        {activeMahallu && <Link className="pillbtn light" to="/app/volunteers">Volunteers</Link>}
        {activeMahallu && <Link className="pillbtn light" to="/app/manage/ledger">Ledger</Link>}
        {plainMember && !bookings && <Link className="pillbtn light" to="/app/welcome">{house ? 'Choose my animal' : 'Get started'}</Link>}
        {bookings && <Link className="pillbtn light" to="/app/tracking">Track my animal</Link>}
      </div>
    </section>
    {volunteer ? <VolunteerStats /> : isSuper ? <SuperStats /> : activeMahallu ? <AdminStats mahalluId={activeMahallu.mahalluId} /> : null}
    {mine.loading && !mine.data ? <Loading /> : mine.data && <MyUdhiyya programs={mine.data} reload={mine.reload} />}
    {mine.error && <ErrorNote message={mine.error} />}
  </div>;
}
