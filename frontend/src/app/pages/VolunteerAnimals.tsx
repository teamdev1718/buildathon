import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalLabel, type AnimalType } from '../lib/programs';
import { IconCheck, IconClock, IconPackage } from '../ui/Icons';
import { IconArrowRight, IconEdit, IconGear, IconSearchSmall } from '../ui/icons3';
import { IconAnimal } from '../ui/more-icons';
import { ErrorNote, Loading, useAction, useFetch } from '../ui/kit';
import { Skyline, type Status } from '../ui/visuals';

export type { Status };
type Animal = { id: string; code: string; animalType: AnimalType; drawOrder: number | null; slotAt: string | null; status: Status };

const steps: { status: Status; label: string; action: string; icon: ReactNode }[] = [
  { status: 'PENDING', label: 'Waiting', action: '', icon: <IconClock /> },
  { status: 'SLAUGHTERED', label: 'Slaughtered', action: 'Mark as slaughtered', icon: <IconEdit /> },
  { status: 'PROCESSING', label: 'Processing', action: 'Mark as processing', icon: <IconGear /> },
  { status: 'PACKED', label: 'Packed', action: 'Mark as packed', icon: <IconPackage /> },
];
const filters = [{ key: 'ALL', label: 'All' }, ...steps.map(step => ({ key: step.status, label: step.label }))];

/** A small four-step track used inside other cards. */
export function StatusTrack({ status }: { status: Status }) {
  const at = steps.findIndex(step => step.status === status);
  return <ol className="am-track" aria-label={`Status: ${steps[at].label}`}>{steps.map((step, index) =>
    <li key={step.status} className={index < at ? 'done' : index === at ? 'now' : ''}><i /><span>{step.label}</span></li>)}</ol>;
}

/** The four stages with a tick on each one reached; the next stage shows its own icon. */
function Track({ status }: { status: Status }) {
  const at = steps.findIndex(step => step.status === status);
  return <ol className="am-mtrack" aria-label={`Status: ${steps[at].label}`}>{steps.map((step, index) =>
    <li key={step.status} className={index <= at ? 'done' : ''}><span className="am-mnode">{index <= at ? <IconCheck /> : step.icon}</span><small>{step.label}</small></li>)}</ol>;
}

export function VolunteerAnimals() {
  const { data, error, loading, reload } = useFetch<Animal[]>('/volunteer/animals');
  const { busy, error: failure, run } = useAction();
  const { toast } = useApp();
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setInterval(reload, 20_000); return () => clearInterval(timer); }, [reload]);
  const all = data ?? [];
  const count = (status: Status) => all.filter(item => item.status === status).length;
  const shown = all.filter(item => (filter === 'ALL' || item.status === filter) && item.code.toLowerCase().includes(query.trim().toLowerCase()));
  const strip: { icon: ReactNode; value: number; label: string }[] = [
    { icon: <IconAnimal />, value: all.length, label: 'Total animals' }, { icon: <IconClock />, value: count('PENDING'), label: 'Waiting' },
    { icon: <IconGear />, value: count('PROCESSING'), label: 'Processing' }, { icon: <IconPackage />, value: count('PACKED'), label: 'Packed' },
  ];
  return <>
    <div className="am-track-head">
      <div><div className="eyebrow"><span className="dot" />VOLUNTEER</div><h1 style={{ marginTop: 12 }}>Animal <span className="serif">Management</span></h1>
        <p>Update the status of animals as they move through slaughtering, processing, and packing.</p></div>
      <Skyline />
    </div>
    <div className="stack">
      <div className="am-strip card" role="list">{strip.map(item => <div key={item.label} className="am-strip-item" role="listitem">
        <span className="am-strip-icon">{item.icon}</span><div><b>{item.value}</b><span>{item.label}</span></div></div>)}</div>

      <div className="am-filterbar">
        <div className="am-chips" role="group" aria-label="Filter animals">{filters.map(item => <button key={item.key} type="button" className={'am-chip' + (filter === item.key ? ' on' : '')}
          onClick={() => setFilter(item.key)}>{item.label} ({item.key === 'ALL' ? all.length : count(item.key as Status)})</button>)}</div>
        <label className="searchbox"><IconSearchSmall /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search animal code…" aria-label="Search animal code"
          style={{ border: 0, outline: 0, flex: 1, minWidth: 0, background: 'transparent' }} /></label>
      </div>

      {failure && <ErrorNote message={failure} />}
      {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : shown.length === 0 ?
        <div className="card empty"><h3>{all.length ? 'No animals match' : 'No animals yet'}</h3><p>{all.length ? 'Try another filter or search.' : 'The admin has not allocated animals yet.'}</p></div> :
        <section className="card am-animaltable" aria-label="Animals">
          <div className="am-animalrow head" aria-hidden="true"><span>Animal code</span><span>Type</span><span>Current status</span><span>Action</span></div>
          {shown.map(item => {
            const at = steps.findIndex(step => step.status === item.status);
            const next = steps[at + 1];
            return <div key={item.id} className="am-animalrow">
              <b className="am-code2">{item.code}</b>
              <span className="am-typecell"><span className="am-tile sm"><IconAnimal /></span>{animalLabel[item.animalType]}</span>
              <Track status={item.status} />
              {next ? <button type="button" className={'am-actionbtn' + (at === 0 ? ' primary' : '')} disabled={busy} onClick={() => run(async () => {
                await api(`/volunteer/animals/${item.id}/status`, 'PUT', { status: next.status }, true); toast(`${item.code}: ${next.label.toLowerCase()}`); reload();
              })}>{next.action}<IconArrowRight /></button> : <span className="am-done2"><IconCheck />Completed</span>}
            </div>;
          })}
        </section>}
    </div>
  </>;
}
