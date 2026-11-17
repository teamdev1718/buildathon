import { useState } from 'react';
import { api } from '../../api/client';
import { useApp, type Linked } from '../lib/app-context';
import { CustomSelect } from '../ui/CustomSelect';
import { IconShield } from '../ui/Icons';
import { Field, form, Loading, PageHead, useAction, useFetch } from '../ui/kit';

type Directory = { id: string; name: string; district: string }[];
type Context = Parameters<ReturnType<typeof useApp>['setContext']>[0];

function LinkForm({ mahalluId, directory, done }: { mahalluId: string; directory: Directory; done(): void }) {
  const [selected, setSelected] = useState(mahalluId || directory[0]?.id || '');
  const { busy, error, submit } = useAction();
  const { setContext, toast } = useApp();
  if (!directory.length) return <div className="empty"><h3>No mahallus open yet</h3><p>Check back once your mahallu has been set up.</p></div>;
  return <form onSubmit={submit(async data => {
    setContext(await api<Context>('/me/households/link', 'POST', { mahalluId: selected,
      mahalluNumber: form(data, 'mahalluNumber'), phone: form(data, 'phone') }, true));
    toast('Household linked'); done();
  })}>
    <div className="field"><label>Your mahallu</label>
      <CustomSelect variant="input" block value={selected} ariaLabel="Mahallu" onChange={setSelected}
        options={directory.map(item => ({ value: item.id, label: `${item.name} · ${item.district}` }))} /></div>
    <Field label="Mahallu number" name="mahalluNumber" required maxLength={20} placeholder="A-101" hint="The number your mahallu office gave your house." />
    <Field label="Phone number" name="phone" type="tel" required placeholder="98765 43210" hint="The number registered with your mahallu." />
    {error && <p className="am-error" role="alert">{error}</p>}
    <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Link my household'}</button>
  </form>;
}

function House({ item }: { item: Linked }) {
  return <article className="card am-reveal"><div className="am-headrow">
    <div><div className="eyebrow"><span className="dot" />{item.mahalluName}</div>
      <h2 style={{ marginTop: 8 }}>{item.ownerName}</h2></div><span className="tag"><IconShield />Verified</span></div>
    <div className="divider" />
    <div className="kv"><span>Mahallu number</span><b>{item.mahalluNumber}</b></div>
    <div className="kv"><span>Members in house</span><b>{item.memberCount}</b></div>
  </article>;
}

export function Join() {
  const { ctx } = useApp();
  const directory = useFetch<Directory>('/mahallus/directory');
  const [adding, setAdding] = useState(false);
  const houses = ctx?.households ?? [];
  return <>
    <PageHead eyebrow="Membership" title={<>My <span className="serif">mahallu</span></>}
      sub={houses.length ? 'Your household is verified with your mahallu committee.' : 'Link your household with the mahallu number and phone your committee has on record.'}
      action={houses.length > 0 && !adding ? <button type="button" className="pillbtn ghost" onClick={() => setAdding(true)}>Link another</button> : undefined} />
    <div className="stack">
      {houses.map(item => <House key={item.id} item={item} />)}
      {(houses.length === 0 || adding) && <section className="card" style={{ maxWidth: 560 }}>
        {directory.loading ? <Loading /> : <LinkForm mahalluId="" directory={directory.data ?? []} done={() => setAdding(false)} />}
      </section>}
    </div>
  </>;
}
