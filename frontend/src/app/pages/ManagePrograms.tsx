import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { dateText, statusLabel, type Program } from '../lib/programs';
import { ErrorNote, Field, form, Loading, Modal, PageHead, useAction, useFetch } from '../ui/kit';

type Row = Program & { bookings: number };

function Create({ mahalluId, done, close }: { mahalluId: string; done(id: string): void; close(): void }) {
  const { busy, error, submit } = useAction();
  const year = new Date().getFullYear() + 1;
  return <Modal title={<>New <span className="serif">program</span></>} onClose={close}>
    <form onSubmit={submit(async data => {
      const created = await api<Program>(`/mahallus/${mahalluId}/programs`, 'POST', { name: form(data, 'name'), year: Number(form(data, 'year')),
        targetDate: form(data, 'targetDate'), ...(form(data, 'description') && { description: form(data, 'description') }) }, true);
      done(created.id);
    })}>
      <Field label="Program name" name="name" required maxLength={80} defaultValue={`Udhiyya ${year}`} />
      <div className="grid2">
        <Field label="Year" name="year" type="number" min={2024} max={2100} required defaultValue={year} />
        <Field label="Udhiyya date (Eid al-Adha)" name="targetDate" type="date" required />
      </div>
      <Field label="Note for members (optional)" name="description" maxLength={500} required={false} />
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create program'}</button>
    </form>
  </Modal>;
}

export function ManagePrograms() {
  const navigate = useNavigate();
  const { activeMahallu } = useApp();
  const id = activeMahallu?.mahalluId;
  const { data, error, loading, reload } = useFetch<Row[]>(id ? `/mahallus/${id}/programs` : null);
  const [creating, setCreating] = useState(false);
  if (!id) return null;
  const busy = data?.some(item => item.status !== 'ENDED');
  return <>
    <PageHead eyebrow={activeMahallu?.mahalluName ?? 'Programs'} title={<>Your <span className="serif">programs</span></>}
      sub="A program is one Udhiyya season. Set the animals and prices, then start it so households can book."
      action={<button type="button" className="pillbtn" disabled={busy} title={busy ? 'End the current program first' : undefined}
        onClick={() => setCreating(true)}>New program</button>} />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
      <div className="card empty"><h3>No programs yet</h3><p>Create Udhiyya for this year to get started.</p></div> :
      <div className="am-card-list">{data.map(item => <Link key={item.id} to={`/app/manage/programs/${item.id}`} className="am-mahallu am-reveal am-link">
        <div className="am-headrow"><div><h3>{item.name}</h3>
          <div className="meta"><span style={{ color: 'var(--muted)', fontSize: 14 }}>Udhiyya on {dateText(item.targetDate)} · {item.bookings} bookings</span></div></div>
        <span className={'tag' + (item.status === 'DRAFT' ? ' amber' : item.status === 'ENDED' ? ' off' : '')}>{statusLabel[item.status]}</span></div>
      </Link>)}</div>}
    {creating && <Create mahalluId={id} done={programId => { reload(); setCreating(false); navigate(`/app/manage/programs/${programId}`); }} close={() => setCreating(false)} />}
  </>;
}
