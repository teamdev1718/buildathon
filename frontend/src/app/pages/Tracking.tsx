import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalLabel, shareText, type AnimalType } from '../lib/programs';
import { IconBell, IconClock, IconLayers, IconPackage, IconTag, IconUsers } from '../ui/Icons';
import { ErrorNote, Loading, useAction, useFetch } from '../ui/kit';
import { Photo, Skyline, Stepper, ordinal, statusWord, steps, when as time, type Status } from '../ui/visuals';

type Mine = { id: string; code: string; animalType: AnimalType; shares: number; status: Status; drawOrder: number | null; slotAt: string | null; ahead: number | null };
type Handover = { id: string; packets: number; createdAt: string; receivedAt: string | null; household: { ownerName: string; mahalluNumber: string } };
type Tracked = { id: string; name: string; status: string; handovers: Handover[]; animals: Mine[];
  queue: { total: number; pending: number; slaughtered: number; processing: number; packed: number; upNext: { code: string; drawOrder: number } | null } };

function nextUpdate(item: Mine | undefined) {
  if (!item) return 'Once you have an animal, updates about it appear here.';
  if (item.status === 'PENDING') return item.drawOrder === null ? 'The order has not been drawn yet. We will notify you when it is.'
    : item.ahead === 0 ? 'You are next. Please be ready.' : `${item.ahead} ${item.ahead === 1 ? 'animal is' : 'animals are'} before yours. We will notify you when yours is next.`;
  if (item.status === 'SLAUGHTERED') return 'Processing starts soon. We will tell you when your meat is packed.';
  if (item.status === 'PROCESSING') return 'We will notify you when your meat is packed.';
  return 'Your meat is packed. We will tell you when it is handed to your household.';
}

function AnimalCard({ item, total }: { item: Mine; total: number }) {
  const [details, setDetails] = useState(false);
  return <article className="am-trackcard am-reveal">
    <div className="am-trackcard-main">
      <Photo type={item.animalType} />
      <div className="am-trackcard-meta">
        <div className="am-trackcard-title"><h2>{item.code}</h2><span className="tag">{animalLabel[item.animalType]}</span></div>
        <div className="am-sub">Your share: {item.shares}</div>
        {item.drawOrder && <span className="am-position"><IconLayers />Position: {item.drawOrder} of {total}</span>}
        <button type="button" className="am-linkbtn" aria-expanded={details} onClick={() => setDetails(value => !value)}>Animal details →</button>
      </div>
    </div>
    <div className="am-trackcard-steps"><h3>Processing progress</h3><Stepper list={steps} at={steps.findIndex(step => step.key === item.status)} label={`Processing progress: ${statusWord[item.status]}`} /></div>
    {details && <div className="am-trackcard-details">
      <div className="kv"><span>Animal</span><b>{animalLabel[item.animalType]} · {shareText(item.animalType === 'GOAT' || item.animalType === 'SHEEP' ? 1 : 7)}</b></div>
      <div className="kv"><span>Your shares</span><b>{item.shares}</b></div>
      <div className="kv"><span>Planned time</span><b>{item.slotAt ? time(item.slotAt) : 'Not scheduled yet'}</b></div>
      <div className="kv"><span>Queue</span><b>{item.drawOrder ? `${ordinal(item.drawOrder)} overall` : 'Not drawn yet'}</b></div></div>}
  </article>;
}

function Program({ program, reload }: { program: Tracked; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const animals = program.animals;
  const pending = animals.filter(item => item.status !== 'PACKED').sort((a, b) => (a.drawOrder ?? 1e9) - (b.drawOrder ?? 1e9));
  const focus = pending[0];
  const packets = program.handovers.reduce((sum, row) => sum + row.packets, 0);
  const strip: { icon: ReactNode; value: string; label: string }[] = [
    { icon: <IconTag />, value: String(animals.length), label: animals.length === 1 ? 'My animal' : 'My animals' },
    { icon: <IconLayers />, value: !animals.length ? '—' : focus ? statusWord[focus.status] : 'Packed', label: 'Current status' },
    { icon: <IconClock />, value: focus && focus.status === 'PENDING' && focus.ahead !== null ? ordinal(focus.ahead + 1) : '—', label: 'In queue' },
    { icon: <IconPackage />, value: packets ? `${packets} ${packets === 1 ? 'packet' : 'packets'}` : '—', label: 'Distribution' },
  ];
  return <section className="stack">
    <div className="am-strip card" role="list">{strip.map(item => <div key={item.label} className="am-strip-item" role="listitem">
      <span className="am-strip-icon">{item.icon}</span><div><b>{item.value}</b><span>{item.label}</span></div></div>)}</div>

    {animals.length === 0 ? <div className="card empty"><h3>No animal assigned yet</h3><p>Your animal appears here once your committee allocates shares.</p></div> :
      animals.map(item => <AnimalCard key={item.id} item={item} total={program.queue.total} />)}

    <div className="am-trio">
      <article className="card am-mini"><header><span className="am-strip-icon"><IconUsers /></span><h3>My share</h3></header>
        {animals.length === 0 ? <p className="am-note">Nothing booked yet.</p> : animals.map(item => <div key={item.id} className="kv"><span>{animalLabel[item.animalType]} · {item.code}</span><b>{item.shares} {item.shares === 1 ? 'share' : 'shares'}</b></div>)}</article>
      <article className="card am-mini"><header><span className="am-strip-icon"><IconPackage /></span><h3>Meat distribution</h3></header>
        {program.handovers.length === 0 ? <p className="am-note">{focus || !animals.length ? 'You will be notified once the meat is packed and assigned for distribution.' : 'Your meat is packed. You will be notified when it is handed to your household.'}</p> :
          <>{error && <ErrorNote message={error} />}{program.handovers.map(row => <div key={row.id} className="am-history-row" style={{ padding: '10px 0' }}>
            <span><b>{row.packets} {row.packets === 1 ? 'packet' : 'packets'}</b><span className="am-sub"> · {time(row.createdAt)}</span></span>
            {row.receivedAt ? <span className="tag">Received</span> : <button type="button" className="pillbtn sm" disabled={busy}
              onClick={() => run(async () => { await api(`/distributions/${row.id}/confirm`, 'POST', {}, true); toast('Thanks for confirming'); reload(); })}>I received it</button>}</div>)}</>}</article>
      <article className="card am-mini"><header><span className="am-strip-icon"><IconBell /></span><h3>Next update</h3></header>
        <p className="am-note" style={{ margin: 0 }}>{nextUpdate(focus ?? animals[animals.length - 1])}</p>
        {program.queue.upNext && <p className="am-sub" style={{ margin: '8px 0 0' }}>Now at {program.queue.upNext.code} of {program.queue.total}.</p>}</article>
    </div>
  </section>;
}

export function Tracking() {
  const { data, error, loading, reload } = useFetch<{ programs: Tracked[] }>('/me/tracking');
  const { refreshInbox } = useApp();
  useEffect(() => { const timer = setInterval(() => { reload(); void refreshInbox(); }, 20_000); return () => clearInterval(timer); }, [reload, refreshInbox]);
  const first = data?.programs[0];
  return <>
    <div className="am-track-head">
      <div><div className="eyebrow"><span className="dot" />{first ? first.name.toUpperCase() : 'UDHIYYA'}</div>
        <h1 style={{ marginTop: 12 }}>Track your <span className="serif">Udhiyya</span></h1>
        <p>See the status of your allocated animal, processing progress, and meat distribution in real time.</p></div>
      <Skyline />
    </div>
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.programs.length === 0 ?
      <div className="card empty"><h3>Nothing to track yet</h3><p>Choose your animal on the dashboard and you can follow it here.</p><Link className="pillbtn" style={{ marginTop: 14 }} to="/app/welcome">Choose my animal</Link></div> :
      <div className="stack">{data.programs.map(program => <Program key={program.id} program={program} reload={reload} />)}
        <p className="am-note">Curious where the money goes? <Link to={`/transparency/${data.programs[0].id}`}>See the public ledger</Link>.</p></div>}
  </>;
}
