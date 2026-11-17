import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalLabel, splitName, type AnimalType } from '../lib/programs';
import { ErrorNote, Loading, PageHead, useAction, useFetch } from '../ui/kit';
import { StatusTrack, type Status } from './VolunteerAnimals';

type Mine = { id: string; code: string; animalType: AnimalType; shares: number; status: Status; drawOrder: number | null; slotAt: string | null; ahead: number | null };
type Handover = { id: string; packets: number; createdAt: string; receivedAt: string | null; household: { ownerName: string; mahalluNumber: string } };
type Tracked = { id: string; name: string; status: string; handovers: Handover[]; animals: Mine[];
  queue: { total: number; pending: number; slaughtered: number; processing: number; packed: number; upNext: { code: string; drawOrder: number } | null } };

const time = (value: string) => new Date(value).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Animal({ item }: { item: Mine }) {
  const next = item.status === 'PENDING' && item.ahead === 0;
  return <article className={'am-animal' + (next ? ' booked' : '')}>
    <div className="am-headrow"><div className="am-animal-head"><div><h3 style={{ fontFamily: 'var(--font-mono)' }}>{item.code}</h3><div className="am-sub">{animalLabel[item.animalType]} · your {item.shares} {item.shares === 1 ? 'share' : 'shares'}</div></div></div>
      {item.drawOrder && <span className="tag">#{item.drawOrder} in line</span>}</div>
    <StatusTrack status={item.status} />
    {next && <p className="am-ok" style={{ margin: 0 }}><b>You are next.</b> Please be ready.</p>}
    {item.status === 'PENDING' && item.ahead !== null && item.ahead > 0 && <p className="am-note" style={{ margin: 0 }}>{item.ahead} {item.ahead === 1 ? 'animal' : 'animals'} before yours.</p>}
    {item.status === 'PENDING' && item.drawOrder === null && <p className="am-note" style={{ margin: 0 }}>The order has not been drawn yet.</p>}
    {item.slotAt && <div className="kv"><span>Planned time</span><b>{time(item.slotAt)}</b></div>}
    {item.status === 'PACKED' && <p className="am-ok" style={{ margin: 0 }}>Packed and ready for distribution.</p>}
  </article>;
}

function Program({ program, reload }: { program: Tracked; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const done = program.queue.packed;
  const percent = program.queue.total ? Math.round(done / program.queue.total * 100) : 0;
  return <section className="stack am-reveal">
    <div className="card">
      <div className="am-headrow"><div><div className="eyebrow"><span className="dot" />LIVE PROGRESS</div>
        <h2 style={{ fontSize: 24, marginTop: 8 }}>{splitName(program.name)[0]}<span className="serif">{splitName(program.name)[1]}</span></h2></div>
        {program.queue.upNext && <span className="tag live"><i />Now: {program.queue.upNext.code}</span>}</div>
      <div className="progress" style={{ margin: '16px 0 10px' }} role="progressbar" aria-label="Animals packed" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: percent + '%' }} /></div>
      <div className="stat-grid" role="list" style={{ marginTop: 14 }}>
        <div className="stat"><div className="eyebrow">Waiting</div><div className="v">{program.queue.pending}</div><div className="s">of {program.queue.total} animals</div></div>
        <div className="stat"><div className="eyebrow">Slaughtered</div><div className="v">{program.queue.slaughtered}</div><div className="s">awaiting processing</div></div>
        <div className="stat"><div className="eyebrow">Processing</div><div className="v">{program.queue.processing}</div><div className="s">being cut and weighed</div></div>
        <div className="stat"><div className="eyebrow">Packed</div><div className="v">{program.queue.packed}</div><div className="s">ready for you</div></div></div>
    </div>
    {program.animals.length === 0 ? <div className="card empty"><h3>No animal assigned yet</h3><p>Your animal appears here once your committee allocates shares.</p></div> :
      <div className="am-grid-animals">{program.animals.map(item => <Animal key={item.id} item={item} />)}</div>}
    {program.handovers.length > 0 && <div className="card"><div className="eyebrow"><span className="dot" />MEAT RECEIVED</div>
      <h2 style={{ fontSize: 22, margin: '8px 0 6px' }}>Handed to <span className="serif">your household</span></h2>
      {error && <ErrorNote message={error} />}
      {program.handovers.map(row => <div key={row.id} className="am-history-row" style={{ padding: '14px 0' }}>
        <span><b>{row.packets} {row.packets === 1 ? 'packet' : 'packets'}</b><span className="am-sub"> · {time(row.createdAt)}</span></span>
        {row.receivedAt ? <span className="tag">Received</span> :
          <button type="button" className="pillbtn sm" disabled={busy} onClick={() => run(async () => { await api(`/distributions/${row.id}/confirm`, 'POST', {}, true); toast('Thanks for confirming'); reload(); })}>I received it</button>}
      </div>)}</div>}
  </section>;
}

export function Tracking() {
  const { data, error, loading, reload } = useFetch<{ programs: Tracked[] }>('/me/tracking');
  const { refreshInbox } = useApp();
  useEffect(() => { const timer = setInterval(() => { reload(); void refreshInbox(); }, 20_000); return () => clearInterval(timer); }, [reload, refreshInbox]);
  return <>
    <PageHead eyebrow="Udhiyya day" title={<>Follow your <span className="serif">animal</span></>}
      sub="See where your animal is in the queue and when your meat is ready. This page updates by itself." />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.programs.length === 0 ?
      <div className="card empty"><h3>Nothing to track yet</h3><p>Book a share in a running program and you can follow it here.</p><Link className="pillbtn" style={{ marginTop: 14 }} to="/app/programs">Browse programs</Link></div> :
      <div className="stack">{data.programs.map(program => <Program key={program.id} program={program} reload={reload} />)}
        <p className="am-note">Curious where the money goes? <Link to={`/transparency/${data.programs[0].id}`}>See the public ledger</Link>.</p></div>}
  </>;
}
