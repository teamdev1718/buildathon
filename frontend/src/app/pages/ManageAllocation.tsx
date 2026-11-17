import { useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalEmoji, animalLabel, type AnimalType } from '../lib/programs';
import { ErrorNote, Field, Loading, Modal, useAction, useFetch } from '../ui/kit';

type Holder = { bookingId: string; shares: number; mahalluNumber: string; ownerName: string };
type Unit = { id: string; code: string; animalType: AnimalType; capacity: number; filled: number; drawOrder: number | null; slotAt: string | null; holders: Holder[] };
type Row = { id: string; animalType: AnimalType; shares: number; allocated: number; household: { mahalluNumber: string; ownerName: string };
  allocations: { animalId: string; shares: number }[] };
type View = { allocatedAt: string | null; drawStartAt: string | null; drawMinutes: number | null; drawn: boolean; bookedShares: number;
  allocatedShares: number; unallocatedShares: number; animals: Unit[]; bookings: Row[] };

const when = (value: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function EditShares({ view, row, close, done }: { view: View; row: Row; close(): void; done(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const options = view.animals.filter(unit => unit.animalType === row.animalType);
  const mine = (id: string) => row.allocations.find(item => item.animalId === id)?.shares ?? 0;
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(options.map(unit => [unit.id, mine(unit.id)])));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return <Modal title={<>Place <span className="serif">shares</span></>} onClose={close}>
    <p className="am-note" style={{ marginBottom: 14 }}><b>{row.household.ownerName}</b> ({row.household.mahalluNumber}) booked {row.shares} {row.shares === 1 ? 'share' : 'shares'} of {animalLabel[row.animalType]}.
      Choose which animals they share in.</p>
    <div className="stack" style={{ gap: 10 }}>{options.map(unit => {
      const others = unit.filled - mine(unit.id);
      return <div key={unit.id} className="am-place">
        <div><b>{unit.code}</b><div className="am-sub">{others} of {unit.capacity} taken by others</div></div>
        <input className="inp" type="number" min={0} max={Math.max(0, unit.capacity - others)} value={values[unit.id]} aria-label={`Shares on ${unit.code}`}
          onChange={event => setValues({ ...values, [unit.id]: Math.max(0, Number(event.target.value) || 0) })} />
      </div>;
    })}</div>
    <div className="kv" style={{ marginTop: 14 }}><span>Placed</span><b style={{ color: total > row.shares ? 'var(--coral-ink)' : undefined }}>{total} of {row.shares}</b></div>
    {error && <p className="am-error" role="alert">{error}</p>}
    <button className="pillbtn" type="button" disabled={busy || total > row.shares} style={{ marginTop: 12 }} onClick={() => run(async () => {
      await api(`/bookings/${row.id}/allocation`, 'PUT', { items: options.filter(unit => values[unit.id] > 0).map(unit => ({ animalId: unit.id, shares: values[unit.id] })) }, true);
      toast('Allocation saved'); done(); close();
    })}>{busy ? 'Saving…' : 'Save'}</button>
  </Modal>;
}

export function Allocation({ programId, open, onChange }: { programId: string; open: boolean; onChange(): void }) {
  const { data, error, loading, reload } = useFetch<View>(`/programs/${programId}/allocation`);
  const { busy, error: failure, run } = useAction();
  const { toast } = useApp();
  const [editing, setEditing] = useState<Row | null>(null);
  const [start, setStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 7); date.setHours(8, 0, 0, 0); return localInput(date); });
  const [minutes, setMinutes] = useState('15');
  const refresh = () => { reload(); onChange(); };
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  const hasAnimals = data.animals.length > 0;

  const move = (index: number, by: -1 | 1) => {
    const ids = data.animals.map(unit => unit.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(async () => { await api(`/programs/${programId}/order`, 'PUT', { animalIds: ids }, true); refresh(); });
  };

  return <section className="card" style={{ marginTop: 22 }}>
    <div className="am-headrow">
      <div><div className="eyebrow"><span className="dot" />ALLOCATION</div>
        <h2 style={{ fontSize: 22, marginTop: 8 }}>Animals and <span className="serif">shares</span></h2></div>
      {open && <button type="button" className="pillbtn" disabled={busy || data.bookedShares === 0} onClick={() => {
        if (hasAnimals && !window.confirm('Allocate again? This rebuilds every animal and clears manual edits and the draw.')) return;
        void run(async () => { await api(`/programs/${programId}/allocate`, 'POST', {}, true); toast('Shares allocated'); refresh(); });
      }}>{busy ? 'Working…' : hasAnimals ? 'Allocate again' : 'Allocate shares'}</button>}
    </div>
    {failure && <ErrorNote message={failure} />}
    {!hasAnimals ? <div className="empty"><h3>Nothing allocated yet</h3>
      <p>{data.bookedShares === 0 ? 'Bookings are needed first.' : 'Press Allocate shares to create the animals with unique codes and place every household.'}</p></div> : <>
      <div className="stat-grid" role="list" style={{ marginTop: 16 }}>
        <div className="stat"><div className="eyebrow">Animals</div><div className="v">{data.animals.length}</div><div className="s">to be slaughtered</div></div>
        <div className="stat"><div className="eyebrow">Placed</div><div className="v">{data.allocatedShares}/{data.bookedShares}</div><div className="s">shares on animals</div></div>
        <div className="stat"><div className="eyebrow">Needs attention</div><div className="v" style={{ color: data.unallocatedShares ? 'var(--coral-ink)' : undefined }}>{data.unallocatedShares}</div>
          <div className="s">{data.unallocatedShares ? 'shares not placed. Allocate again or place by hand' : 'all shares placed'}</div></div>
        <div className="stat"><div className="eyebrow">Draw</div><div className="v">{data.drawn ? 'Done' : 'Not yet'}</div><div className="s">{data.drawn ? `${data.drawMinutes} min per animal` : 'run it below'}</div></div>
      </div>

      <h3 style={{ margin: '24px 0 10px' }}>{data.drawn ? 'Slaughter order' : 'Animals'}</h3>
      <div className="tx-wrap"><table className="tx"><thead><tr>{data.drawn && <th>#</th>}<th>Code</th><th>Animal</th><th>Filled</th><th>Shared by</th>{data.drawn && <th>Slot</th>}{data.drawn && open && <th />}</tr></thead>
        <tbody>{data.animals.map((unit, index) => <tr key={unit.id}>
          {data.drawn && <td className="amt">{unit.drawOrder}</td>}
          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{unit.code}</td>
          <td>{animalEmoji[unit.animalType]} {animalLabel[unit.animalType]}</td>
          <td><span className={'tag' + (unit.filled < unit.capacity ? ' amber' : '')}>{unit.filled}/{unit.capacity}</span></td>
          <td style={{ minWidth: 220 }}>{unit.holders.length ? unit.holders.map(item => `${item.ownerName} (${item.mahalluNumber})${item.shares > 1 ? ' ×' + item.shares : ''}`).join(', ') : '—'}</td>
          {data.drawn && <td>{when(unit.slotAt)}</td>}
          {data.drawn && open && <td><div className="row-actions"><button type="button" className="chipbtn" disabled={busy || index === 0} aria-label={`Move ${unit.code} earlier`} onClick={() => move(index, -1)}>▲</button>
            <button type="button" className="chipbtn" disabled={busy || index === data.animals.length - 1} aria-label={`Move ${unit.code} later`} onClick={() => move(index, 1)}>▼</button></div></td>}
        </tr>)}</tbody></table></div>

      <h3 style={{ margin: '24px 0 10px' }}>Households</h3>
      <div className="tx-wrap"><table className="tx"><thead><tr><th>House</th><th>Owner</th><th>Animal</th><th>Shares</th><th>Placed on</th>{open && <th />}</tr></thead>
        <tbody>{data.bookings.map(row => <tr key={row.id}>
          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.household.mahalluNumber}</td><td><b>{row.household.ownerName}</b></td>
          <td>{animalEmoji[row.animalType]} {animalLabel[row.animalType]}</td>
          <td><span className={'tag' + (row.allocated < row.shares ? ' off' : '')}>{row.allocated}/{row.shares}</span></td>
          <td>{row.allocations.map(item => { const unit = data.animals.find(a => a.id === item.animalId); return `${unit?.code ?? '?'}${item.shares > 1 ? ' ×' + item.shares : ''}`; }).join(', ') || '—'}</td>
          {open && <td><button type="button" className="chipbtn" onClick={() => setEditing(row)}>Edit</button></td>}
        </tr>)}</tbody></table></div>

      {open && <div className="am-draw">
        <h3 style={{ margin: '24px 0 4px' }}>Draw the order</h3>
        <p className="am-note">A random draw decides which animal is slaughtered first and gives each a time slot. You can change the order afterwards.</p>
        <div className="am-inline" style={{ marginTop: 10 }}>
          <Field label="First slaughter" type="datetime-local" value={start} onChange={event => setStart(event.target.value)} />
          <Field label="Minutes per animal" type="number" min={1} max={240} value={minutes} onChange={event => setMinutes(event.target.value)} />
          <button type="button" className="pillbtn" disabled={busy || !start} onClick={() => {
            if (data.drawn && !window.confirm('Draw again? The current order will be replaced.')) return;
            void run(async () => {
              await api(`/programs/${programId}/draw`, 'POST', { startAt: new Date(start).toISOString(), minutesPerAnimal: Number(minutes) }, true);
              toast('Draw complete'); refresh();
            });
          }}>{data.drawn ? 'Draw again' : 'Run the draw'}</button>
        </div></div>}
    </>}
    {editing && <EditShares view={data} row={editing} close={() => setEditing(null)} done={refresh} />}
  </section>;
}
