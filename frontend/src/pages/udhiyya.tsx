import { useState } from 'react';
import { api } from '../api/client';
import { AsyncForm, Field, value } from '../components/forms';
import { day, kg, Loaded, Progress, rupees, Standing, useLoad, type Cycle, type Enrollment } from '../features/udhiyya/shared';

type Token = { code: string; slot: string | null; grams: number; status: string; collectedAt: string | null; cycle: { name: string; status: string } };

function monthsLeft(lock: string) {
  const now = new Date(), end = new Date(lock);
  const months = (end.getUTCFullYear() - now.getUTCFullYear()) * 12 + end.getUTCMonth() - now.getUTCMonth();
  return Math.max(1, end.getUTCDate() < now.getUTCDate() ? months - 1 : months);
}

function Enroll({ cycle, done }: { cycle: Cycle; done(): void }) {
  const [planId, setPlanId] = useState(cycle.plans[0]?.id ?? '');
  const [shares, setShares] = useState(1);
  const plan = cycle.plans.find(item => item.id === planId);
  const months = monthsLeft(cycle.priceLockDate);
  if (!plan) return <p>The mahal has not published animal plans yet.</p>;
  return <AsyncForm submit="Join this Udhiyya" action={async form => {
    await api('/udhiyya/enrollments', 'POST', { planId, shares,
      holderNames: Array.from({ length: shares }, (_, index) => value(form, 'holder' + index).trim()) }, true);
    done();
    return 'You are enrolled. Your monthly amount is shown below.';
  }}>
    <label className="field"><span>Animal plan</span>
      <select value={planId} onChange={event => setPlanId(event.target.value)}>
        {cycle.plans.map(item => <option key={item.id} value={item.id}>
          {item.name} · {rupees(item.sharePrice)} per share</option>)}
      </select></label>
    <label className="field"><span>Number of shares</span>
      <select value={shares} onChange={event => setShares(Number(event.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7].map(count => <option key={count} value={count}>{count}</option>)}
      </select></label>
    {Array.from({ length: shares }, (_, index) => <Field key={index} label={`Name on share ${index + 1}`}
      name={'holder' + index} maxLength={60} placeholder="Person the Udhiyya is for" />)}
    <p className="notice">Total {rupees(plan.sharePrice * shares)} · about {rupees(Math.ceil(plan.sharePrice * shares / months))} a month
      for {months} month{months === 1 ? '' : 's'} until the price lock on {day(cycle.priceLockDate)}.</p>
  </AsyncForm>;
}

function EnrollmentCard({ item, reload }: { item: Enrollment; reload(): void }) {
  return <article className="card">
    <header className="row"><h3>{item.planName} · {item.shares} share{item.shares > 1 ? 's' : ''}</h3><Standing value={item.standing} /></header>
    <p>For: {item.holderNames.join(', ')}</p>
    <Progress done={item.confirmed} total={item.totalAmount} label="Amount paid" />
    <p><strong>{rupees(item.confirmed)}</strong> of {rupees(item.totalAmount)} paid · {rupees(item.monthlyAmount)} a month
      × {item.installments}{item.pending > 0 && <> · {rupees(item.pending)} awaiting confirmation</>}</p>
    {item.standing === 'BEHIND' && <p className="notice error">You should have paid {rupees(item.expected)} by now.</p>}
    {item.remaining - item.pending > 0 && <details><summary>Paid online? Tell the collector</summary>
      <AsyncForm submit="Submit UPI payment" action={async form => {
        await api(`/udhiyya/enrollments/${item.id}/online-payments`, 'POST',
          { amount: Number(value(form, 'amount')), reference: value(form, 'reference').trim() }, true);
        reload();
        return 'Submitted. It counts once a collector confirms it.';
      }}>
        <Field label="Amount (₹)" name="amount" type="number" min={1} max={item.remaining - item.pending} />
        <Field label="UPI reference" name="reference" maxLength={40} />
      </AsyncForm></details>}
    {item.payments.length > 0 && <table><caption>Payments</caption>
      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
      <tbody>{item.payments.map(payment => <tr key={payment.id}><td>{day(payment.createdAt)}</td>
        <td>{rupees(payment.amount)}</td><td>{payment.method === 'CASH' ? 'Cash' : 'UPI'}</td>
        <td>{payment.status.toLowerCase()}</td></tr>)}</tbody></table>}
  </article>;
}

export function Udhiyya() {
  const cycle = useLoad<{ cycle: Cycle | null }>('/udhiyya/cycle');
  const mine = useLoad<Enrollment[]>('/udhiyya/enrollments/mine');
  const tokens = useLoad<Token[]>('/udhiyya/tokens/mine');
  return <div className="stack">
    <section className="panel wide"><h1>Udhiyya</h1>
      <Loaded result={cycle}>{({ cycle: current }) => current ? <>
        <p>{current.name} · Udhiyya around {day(current.targetDate)} · price locks {day(current.priceLockDate)}</p>
        {current.status === 'ACTIVE' ? <Enroll cycle={current} done={mine.reload} /> :
          <p className="notice">Enrolment is closed for this cycle.</p>}
      </> : <p>The mahal has not opened an Udhiyya cycle yet. Check back soon.</p>}</Loaded></section>
    <section className="panel wide"><h2>My installments</h2>
      <Loaded result={mine}>{items => items.length ? <div className="cards">
        {items.map(item => <EnrollmentCard key={item.id} item={item} reload={mine.reload} />)}</div> :
        <p>You have not joined yet.</p>}</Loaded></section>
    <Loaded result={tokens}>{items => items.length > 0 && <section className="panel wide"><h2>My meat token</h2>
      {items.map(token => <article className="card" key={token.code}>
        <p className="code" aria-label="Token code">{token.code}</p>
        <p>{token.cycle.name} · {kg(token.grams)}{token.slot && <> · pickup {token.slot}</>}</p>
        <p>{token.status === 'COLLECTED' ? 'Collected ✔' : 'Show this code to a volunteer at the collection point.'}</p>
      </article>)}</section>}</Loaded>
  </div>;
}
