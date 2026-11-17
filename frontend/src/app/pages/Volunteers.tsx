import { useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { dateText, type Program } from '../lib/programs';
import { ErrorNote, Field, form, Loading, Modal, PageHead, useAction, useFetch } from '../ui/kit';

type Stock = { issued: number; distributed: number; inHand: number };
type Volunteer = { id: string; name: string; phone: string | null; username: string; canStatus: boolean; canDistribute: boolean;
  terminatedAt: string | null; createdAt: string; stock: Stock | null };
type Credentials = { username: string; password: string };
type Overview = { issued: number; distributed: number; inHand: number; householdsServed: number; households: number;
  rows: { id: string; packets: number; createdAt: string; volunteer: string; household: { mahalluNumber: string; ownerName: string } }[] };

function CredentialsModal({ title, credentials, close }: { title: ReactNode; credentials: Credentials; close(): void }) {
  const [copied, setCopied] = useState(false);
  const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
  return <Modal title={title} onClose={close}>
    <p className="am-note" style={{ marginBottom: 12 }}>Give these to the volunteer now. <b>The password is shown only once</b> and cannot be viewed again. You can generate a new one at any time.</p>
    <div className="am-cred" aria-label="Volunteer credentials"><span>Username</span><code>{credentials.username}</code><span>Password</span><code>{credentials.password}</code></div>
    <div className="row-actions" style={{ marginTop: 14 }}>
      <button type="button" className="pillbtn" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {}); }}>{copied ? 'Copied' : 'Copy both'}</button>
      <button type="button" className="pillbtn ghost" onClick={close}>Done</button></div>
    <p className="am-note" style={{ marginTop: 10 }}>They sign in at <b>/volunteer-login</b>.</p>
  </Modal>;
}

function Create({ mahalluId, close, done }: { mahalluId: string; close(): void; done(credentials: Credentials): void }) {
  const { busy, error, submit } = useAction();
  return <Modal title={<>New <span className="serif">volunteer</span></>} onClose={close}>
    <form onSubmit={submit(async data => {
      const created = await api<Credentials>(`/mahallus/${mahalluId}/volunteers`, 'POST', { name: form(data, 'name'),
        ...(form(data, 'phone') && { phone: form(data, 'phone') }), canStatus: data.has('canStatus'), canDistribute: data.has('canDistribute') }, true);
      done(created);
    })}>
      <Field label="Name" name="name" required maxLength={80} autoComplete="off" />
      <Field label="Phone (optional)" name="phone" type="tel" required={false} />
      <div className="field"><label>Roles</label>
        <label className="check am-role"><input type="checkbox" name="canStatus" defaultChecked /><span><b>Animal status</b><span className="am-sub">Marks animals slaughtered, processing and packed.</span></span></label>
        <label className="check am-role"><input type="checkbox" name="canDistribute" /><span><b>Meat distribution</b><span className="am-sub">Hands packed meat to households and records it.</span></span></label></div>
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create and show login'}</button>
    </form>
  </Modal>;
}

function IssueModal({ volunteer, close, done }: { volunteer: Volunteer; close(): void; done(): void }) {
  const { busy, error, submit } = useAction();
  const { toast } = useApp();
  return <Modal title={<>Give <span className="serif">packets</span></>} onClose={close}>
    <p className="am-note" style={{ marginBottom: 12 }}><b>{volunteer.name}</b> has {volunteer.stock?.inHand ?? 0} packets in hand. Add the packets you are handing over now.</p>
    <form onSubmit={submit(async data => {
      await api(`/volunteers/${volunteer.id}/issue`, 'POST', { packets: Number(form(data, 'packets')), ...(form(data, 'note') && { note: form(data, 'note') }) }, true);
      toast('Packets issued'); done(); close();
    })}>
      <Field label="Number of packets" name="packets" type="number" min={1} required inputMode="numeric" />
      <Field label="Note (optional)" name="note" maxLength={200} required={false} placeholder="Batch 1 from COW-01" />
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Hand over'}</button>
    </form>
  </Modal>;
}

function Card({ item, reload }: { item: Volunteer; reload(): void }) {
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [issuing, setIssuing] = useState(false);
  const [shown, setShown] = useState<Credentials | null>(null);
  const ended = item.terminatedAt !== null;
  const setRole = (field: 'canStatus' | 'canDistribute', value: boolean) => run(async () => {
    await api('/volunteers/' + item.id, 'PATCH', { [field]: value }, true); toast('Roles updated'); reload();
  });
  return <article className={'am-mahallu am-reveal' + (ended ? ' am-ended' : '')}>
    <div className="am-headrow"><div><h3>{item.name}</h3>
      <div className="meta"><span className="tag">{item.username}</span>{item.phone && <span style={{ color: 'var(--muted)', fontSize: 14 }}>{item.phone}</span>}</div></div>
      <span className={'tag' + (ended ? ' off' : '')}>{ended ? `Terminated ${dateText(item.terminatedAt!)}` : 'Active'}</span></div>
    {!ended && <div className="am-roles">
      <label className="am-switchrow"><span><b>Animal status</b></span><span className="switch"><input type="checkbox" checked={item.canStatus} disabled={busy || (item.canStatus && !item.canDistribute)}
        aria-label="Animal status role" onChange={event => setRole('canStatus', event.target.checked)} /><span className="tr" /></span></label>
      <label className="am-switchrow"><span><b>Meat distribution</b></span><span className="switch"><input type="checkbox" checked={item.canDistribute} disabled={busy || (item.canDistribute && !item.canStatus)}
        aria-label="Meat distribution role" onChange={event => setRole('canDistribute', event.target.checked)} /><span className="tr" /></span></label></div>}
    {item.canDistribute && item.stock && <div className="kv" style={{ margin: 0 }}><span>Packets: given {item.stock.issued} · handed out {item.stock.distributed}</span><b>{item.stock.inHand} in hand</b></div>}
    {error && <p className="am-error" role="alert">{error}</p>}
    {!ended && <div className="row-actions">
      {item.canDistribute && <button type="button" className="pillbtn sm" onClick={() => setIssuing(true)}>Give packets</button>}
      <button type="button" className="pillbtn ghost sm" disabled={busy} onClick={() => {
        if (!window.confirm(`Generate a new password for ${item.name}? They will be signed out.`)) return;
        void run(async () => setShown(await api<Credentials>(`/volunteers/${item.id}/reset-password`, 'POST', {}, true)));
      }}>New password</button>
      <button type="button" className="pillbtn danger sm" disabled={busy} onClick={() => {
        if (!window.confirm(`Terminate ${item.name}? They lose access immediately.`)) return;
        void run(async () => { await api(`/volunteers/${item.id}/terminate`, 'POST', {}, true); toast('Volunteer terminated'); reload(); });
      }}>Terminate</button></div>}
    {issuing && <IssueModal volunteer={item} close={() => setIssuing(false)} done={reload} />}
    {shown && <CredentialsModal title={<>New <span className="serif">password</span></>} credentials={shown} close={() => setShown(null)} />}
  </article>;
}

function Log({ programId, refreshKey }: { programId: string; refreshKey: number }) {
  const { data, error, loading, reload } = useFetch<Overview>(`/programs/${programId}/distribution?k=${refreshKey}`);
  const { run } = useAction();
  const { toast } = useApp();
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  return <section className="card" style={{ marginTop: 22 }}>
    <div className="eyebrow"><span className="dot" />DISTRIBUTION</div>
    <h2 style={{ fontSize: 22, margin: '8px 0 16px' }}>Who received <span className="serif">meat</span></h2>
    <div className="stat-grid" role="list" style={{ marginTop: 0 }}>
      <div className="stat"><div className="eyebrow">Given out</div><div className="v">{data.issued}</div><div className="s">packets to volunteers</div></div>
      <div className="stat"><div className="eyebrow">Handed over</div><div className="v">{data.distributed}</div><div className="s">packets to households</div></div>
      <div className="stat"><div className="eyebrow">With volunteers</div><div className="v">{data.inHand}</div><div className="s">packets still in hand</div></div>
      <div className="stat"><div className="eyebrow">Households</div><div className="v">{data.householdsServed}/{data.households}</div><div className="s">have received</div></div>
    </div>
    {data.rows.length === 0 ? <div className="empty"><h3>Nothing handed out yet</h3><p>Entries appear here as volunteers give meat to households.</p></div> :
      <div className="tx-wrap" style={{ marginTop: 18 }}><table className="tx"><thead><tr><th>When</th><th>Household</th><th>Packets</th><th>By</th><th /></tr></thead>
        <tbody>{data.rows.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td><b>{row.household.ownerName}</b><div className="am-sub">{row.household.mahalluNumber}</div></td><td className="amt">{row.packets}</td><td>{row.volunteer}</td>
          <td><button type="button" className="chipbtn" onClick={() => {
            if (!window.confirm('Remove this entry? The packets go back to the volunteer.')) return;
            void run(async () => { await api(`/distributions/${row.id}/void`, 'POST', {}, true); toast('Entry removed'); reload(); });
          }}>Remove</button></td></tr>)}</tbody></table></div>}
  </section>;
}

export function Volunteers() {
  const { activeMahallu } = useApp();
  const id = activeMahallu?.mahalluId;
  const { data, error, loading, reload } = useFetch<Volunteer[]>(id ? `/mahallus/${id}/volunteers` : null);
  const programs = useFetch<(Program & { bookings: number })[]>(id ? `/mahallus/${id}/programs` : null);
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<Credentials | null>(null);
  const [version, setVersion] = useState(0);
  if (!id) return null;
  const running = programs.data?.find(item => item.status === 'OPEN');
  const refresh = () => { reload(); setVersion(count => count + 1); };
  return <>
    <PageHead eyebrow={activeMahallu?.mahalluName ?? 'Volunteers'} title={<>Your <span className="serif">volunteers</span></>}
      sub="Create a login for each helper. They can only do the tasks you give them, and you can end their access at any time."
      action={<button type="button" className="pillbtn" onClick={() => setCreating(true)}>New volunteer</button>} />
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
      <div className="card empty"><h3>No volunteers yet</h3><p>Create one to let them update animals or give out meat.</p></div> :
      <div className="am-card-list">{data.map(item => <Card key={item.id} item={item} reload={refresh} />)}</div>}
    {running && <Log programId={running.id} refreshKey={version} />}
    {creating && <Create mahalluId={id} close={() => setCreating(false)} done={credentials => { setCreating(false); setShown(credentials); refresh(); }} />}
    {shown && <CredentialsModal title={<>Volunteer <span className="serif">login</span></>} credentials={shown} close={() => setShown(null)} />}
  </>;
}
