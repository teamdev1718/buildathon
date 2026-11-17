import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalLabel, type AnimalType } from '../lib/programs';
import { ErrorNote, Loading, PageHead, useAction, useFetch } from '../ui/kit';

export type Status = 'PENDING' | 'SLAUGHTERED' | 'PROCESSING' | 'PACKED';
type Animal = { id: string; code: string; animalType: AnimalType; drawOrder: number | null; slotAt: string | null; status: Status };
const steps: { status: Status; label: string; action: string }[] = [
  { status: 'PENDING', label: 'Waiting', action: '' }, { status: 'SLAUGHTERED', label: 'Slaughtered', action: 'Mark slaughtered' },
  { status: 'PROCESSING', label: 'Processing', action: 'Start processing' }, { status: 'PACKED', label: 'Packed', action: 'Mark packed' },
];
const when = (value: string | null) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

export function StatusTrack({ status }: { status: Status }) {
  const at = steps.findIndex(step => step.status === status);
  return <ol className="am-track" aria-label={`Status: ${steps[at].label}`}>{steps.map((step, index) =>
    <li key={step.status} className={index < at ? 'done' : index === at ? 'now' : ''}><i /><span>{step.label}</span></li>)}</ol>;
}

export function VolunteerAnimals() {
  const { data, error, loading, reload } = useFetch<Animal[]>('/volunteer/animals');
  const { busy, error: failure, run } = useAction();
  const { toast } = useApp();
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');
  useEffect(() => { const timer = setInterval(reload, 20_000); return () => clearInterval(timer); }, [reload]);
  const shown = (data ?? []).filter(item => filter === 'all' || item.status !== 'PACKED');
  return <>
    <PageHead eyebrow="Volunteer" title={<>Animal <span className="serif">progress</span></>}
      sub="Tap the next step as each animal moves along. Everyone sees the update straight away." />
    <div className="seg" role="group" aria-label="Show" style={{ maxWidth: 320, marginBottom: 18 }}>
      <button type="button" className={filter === 'todo' ? 'on' : ''} onClick={() => setFilter('todo')}>To do</button>
      <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All animals</button></div>
    {failure && <ErrorNote message={failure} />}
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : shown.length === 0 ?
      <div className="card empty"><h3>{data.length ? 'All done' : 'No animals yet'}</h3><p>{data.length ? 'Every animal is packed. Thank you!' : 'The admin has not allocated animals yet.'}</p></div> :
      <div className="am-grid-animals">{shown.map(item => {
        const at = steps.findIndex(step => step.status === item.status);
        const next = steps[at + 1];
        return <article key={item.id} className={'am-animal' + (item.status === 'PACKED' ? ' booked' : '')}>
          <div className="am-headrow"><div className="am-animal-head"><div><h3 style={{ fontFamily: 'var(--font-mono)' }}>{item.code}</h3><div className="am-sub">{animalLabel[item.animalType]}</div></div></div>
            <span className="tag">{item.drawOrder ? `#${item.drawOrder}` : 'Not drawn'}{item.slotAt ? ` · ${when(item.slotAt)}` : ''}</span></div>
          <StatusTrack status={item.status} />
          {next ? <button type="button" className="pillbtn" disabled={busy} onClick={() => run(async () => {
            await api(`/volunteer/animals/${item.id}/status`, 'PUT', { status: next.status }, true);
            toast(`${item.code}: ${next.label.toLowerCase()}`); reload();
          })}>{next.action}</button> : <p className="am-ok" style={{ margin: 0 }}>Packed and ready for distribution.</p>}
        </article>;
      })}</div>}
  </>;
}
