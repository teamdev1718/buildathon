import { useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { CustomSelect } from '../ui/CustomSelect';
import { Field, form, Loading, useAction, useFetch } from '../ui/kit';

type Directory = { id: string; name: string; district: string }[];
type Context = Parameters<ReturnType<typeof useApp>['setContext']>[0];

function LinkForm({ directory, done }: { directory: Directory; done(): void }) {
  const [selected, setSelected] = useState(directory[0]?.id ?? '');
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

/** Links the signed-in account to a household using the mahallu number and phone the committee has on record. */
export function HouseholdLink({ done }: { done(): void }) {
  const directory = useFetch<Directory>('/mahallus/directory');
  return directory.loading ? <Loading /> : <LinkForm directory={directory.data ?? []} done={done} />;
}
