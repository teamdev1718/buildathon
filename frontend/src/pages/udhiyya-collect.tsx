import { useState } from 'react';
import { api } from '../api/client';
import { AsyncForm, Field, value } from '../components/forms';
import { kg, Loaded, rupees, Standing, useLoad, type Cycle, type Enrollment } from '../features/udhiyya/shared';

type Found = Enrollment & { member: { name: string; email: string } };
type Pending = { id: string; amount: number; reference: string | null; enrollment: { plan: { name: string }; user: { name: string; email: string } } };
type Progress = Record<'members' | 'beneficiaries', { collected: number; pending: number; gramsCollected: number; gramsPending: number }>;

function Payments({ cycleOpen }: { cycleOpen: boolean }) {
  const [query, setQuery] = useState('');
  const results = useLoad<Found[]>('/udhiyya/enrollments?q=' + encodeURIComponent(query));
  const pending = useLoad<Pending[]>('/udhiyya/payments/pending');
  const refresh = () => { results.reload(); pending.reload(); };
  return <section className="panel wide stack"><h2>Payments</h2>
    <label className="field"><span>Find a member by name or email</span>
      <input value={query} onChange={event => setQuery(event.target.value)} maxLength={60} placeholder="Start typing…" /></label>
    <Loaded result={results}>{items => items.length ? <div className="cards">{items.map(item => <article className="card" key={item.id}>
      <header className="row"><h3>{item.member.name}</h3><Standing value={item.standing} /></header>
      <p>{item.planName} · {item.shares} share{item.shares > 1 ? 's' : ''} · {item.member.email}</p>
      <p>{rupees(item.confirmed)} of {rupees(item.totalAmount)} paid · {rupees(item.monthlyAmount)} a month</p>
      {item.remaining > 0 && cycleOpen && <AsyncForm submit="Record cash" action={async form => {
        await api(`/udhiyya/enrollments/${item.id}/cash-payments`, 'POST', { amount: Number(value(form, 'amount')) }, true);
        refresh();
        return 'Cash recorded.';
      }}><Field label="Cash received (₹)" name="amount" type="number" min={1} max={item.remaining} defaultValue={Math.min(item.monthlyAmount, item.remaining)} /></AsyncForm>}
    </article>)}</div> : <p>No matching enrolments.</p>}</Loaded>
    <h3>Online payments to confirm</h3>
    <Loaded result={pending}>{items => items.length ? <table>
      <thead><tr><th>Member</th><th>Amount</th><th>UPI reference</th><th>Action</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td>{item.enrollment.user.name}</td><td>{rupees(item.amount)}</td>
        <td>{item.reference}</td><td className="row">{(['confirm', 'reject'] as const).map(action =>
          <button key={action} className={action === 'reject' ? 'secondary' : ''} onClick={async () => {
            try { await api(`/udhiyya/payments/${item.id}/${action}`, 'POST', {}, true); } catch { /* shown by reload */ }
            refresh();
          }}>{action === 'confirm' ? 'Confirm' : 'Reject'}</button>)}</td></tr>)}</tbody></table> :
      <p>Nothing waiting.</p>}</Loaded>
  </section>;
}

function Collection({ cycle }: { cycle: Cycle }) {
  const progress = useLoad<Progress>(`/udhiyya/cycles/${cycle.id}/distribution`);
  return <section className="panel wide stack"><h2>Meat collection</h2>
    {cycle.status !== 'DISTRIBUTION' ? <p className="notice">Collection opens when the admin starts distribution.</p> :
      <AsyncForm submit="Mark collected" action={async form => {
        const result = await api<{ name: string; grams: number; delivery: boolean }>('/udhiyya/tokens/collect', 'POST',
          { code: value(form, 'code') }, true);
        progress.reload();
        return `${result.name}: ${kg(result.grams)} handed over${result.delivery ? ' (home delivery)' : ''}.`;
      }}><Field label="Token code" name="code" maxLength={10} autoCapitalize="characters" autoComplete="off" /></AsyncForm>}
    <Loaded result={progress}>{data => <div className="stats">
      {(['members', 'beneficiaries'] as const).map(kind => <div className="stat" key={kind}>
        <strong>{data[kind].collected}/{data[kind].collected + data[kind].pending}</strong>
        <span>{kind === 'members' ? 'Member packets' : 'Beneficiary packets'} collected</span>
        <span>{kg(data[kind].gramsCollected)} handed out</span></div>)}</div>}</Loaded>
  </section>;
}

export function Collector() {
  const cycle = useLoad<{ cycle: Cycle | null }>('/udhiyya/cycle');
  return <div className="stack"><h1>Collector desk</h1>
    <Loaded result={cycle}>{({ cycle: current }) => current ? <>
      <Payments cycleOpen={['ACTIVE', 'PROCUREMENT'].includes(current.status)} /><Collection cycle={current} />
    </> : <p>No open cycle.</p>}</Loaded></div>;
}
