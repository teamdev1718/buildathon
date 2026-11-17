import { useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { ErrorNote, Field, form, Loading, Modal, PageHead, useAction, useFetch } from '../ui/kit';

type Admin = { name: string; email: string };
type Mahallu = { id: string; name: string; district: string; code: string; active: boolean; households: number; admins: Admin[] };

function Create({ done, close }: { done(): void; close(): void }) {
  const { busy, error, submit } = useAction();
  const { toast } = useApp();
  return <Modal title={<>New <span className="serif">mahallu</span></>} onClose={close}>
    <form onSubmit={submit(async data => {
      await api('/mahallus', 'POST', { name: form(data, 'name'), district: form(data, 'district'), code: form(data, 'code') }, true);
      toast('Mahallu created'); done(); close();
    })}>
      <Field label="Mahallu name" name="name" required maxLength={80} placeholder="Kannur Mahallu" />
      <Field label="District" name="district" required maxLength={60} placeholder="Kannur" />
      <Field label="Code" name="code" required maxLength={16} placeholder="KNR-01" hint="Short and unique. Members never need to type it." />
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create mahallu'}</button>
    </form>
  </Modal>;
}

function Card({ item, reload }: { item: Mahallu; reload(): void }) {
  const { busy, error, run, submit } = useAction();
  const { toast } = useApp();
  return <article className="am-mahallu am-reveal">
    <div className="am-headrow">
      <div><h3>{item.name}</h3><div className="meta"><span className="tag">{item.code}</span><span style={{ color: 'var(--muted)', fontSize: 14 }}>
        {item.district} · {item.households} households</span></div></div>
      <div className="row-actions"><span className={'tag' + (item.active ? '' : ' off')}>{item.active ? 'Active' : 'Inactive'}</span>
        <button type="button" className="chipbtn" disabled={busy} onClick={() => run(async () => {
          await api('/mahallus/' + item.id, 'PATCH', { active: !item.active }, true);
          toast(item.active ? 'Mahallu deactivated' : 'Mahallu activated'); reload();
        })}>{item.active ? 'Deactivate' : 'Activate'}</button></div>
    </div>
    <div><div className="eyebrow" style={{ marginBottom: 8 }}>Mahallu admins</div>
      {item.admins.length ? <div className="am-chip-list">{item.admins.map(admin => <span className="am-person" key={admin.email}>
        <span>{admin.name} · {admin.email}</span>
        <button type="button" disabled={busy} onClick={() => run(async () => {
          await api(`/mahallus/${item.id}/admins`, 'POST', { email: admin.email, enabled: false }, true); toast('Access removed'); reload();
        })}>Remove</button></span>)}</div> : <p className="am-note">No admin yet.</p>}</div>
    <form className="am-inline" onSubmit={submit(async (data) => {
      await api(`/mahallus/${item.id}/admins`, 'POST', { email: form(data, 'email'), enabled: true }, true);
      toast('Admin access given'); reload();
    })}>
      <Field label="Give admin access (verified account email)" name="email" type="email" required placeholder="name@example.com" />
      <button className="pillbtn sm" type="submit" disabled={busy}>Give access</button>
    </form>
    {error && <p className="am-error" role="alert">{error}</p>}
  </article>;
}

export function Mahallus() {
  const { data, error, loading, reload } = useFetch<Mahallu[]>('/mahallus');
  const [creating, setCreating] = useState(false);
  return <>
    <PageHead eyebrow="Super admin" title={<>Your <span className="serif">mahallus</span></>}
      sub="Create a mahallu, then give its committee admin access. Each admin sees only their own members."
      action={<button type="button" className="pillbtn" onClick={() => setCreating(true)}>New mahallu</button>} />
    {loading ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ?
      <div className="card empty"><h3>No mahallus yet</h3><p>Create the first one to get started.</p></div> :
      <div className="am-card-list">{data.map(item => <Card key={item.id} item={item} reload={reload} />)}</div>}
    {creating && <Create done={reload} close={() => setCreating(false)} />}
  </>;
}
