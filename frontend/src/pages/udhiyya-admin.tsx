import { useState } from 'react';
import { api } from '../api/client';
import { AsyncForm, Field, value } from '../components/forms';
import { day, kg, Loaded, Progress, rupees, useLoad, type Cycle } from '../features/udhiyya/shared';

type Summary = {
  cycle: Cycle; enrollments: number; paidFamilies: number; behind: number; expected: number; collected: number;
  pendingAmount: number; pendingPayments: number;
  plans: { id: string; name: string; shares: number; animalsNeeded: number; animalsRecorded: number }[];
};
type Animal = { id: string; animalType: string; label: string; cost: number | null; weightKg: number | null; seller: string | null };
type Beneficiary = { id: string; name: string; area: string; phone: string | null; needsDelivery: boolean };
type Token = { id: string; kind: string; code: string; slot: string | null; grams: number; delivery: boolean; status: string;
  name: string; area: string | null; address: string | null };

const next: Record<string, { to: string; label: string } | undefined> = {
  ACTIVE: { to: 'PROCUREMENT', label: 'Close enrolment and start procurement' },
  PROCUREMENT: { to: 'DISTRIBUTION', label: 'Start distribution' },
  DISTRIBUTION: { to: 'CLOSED', label: 'Close the cycle' },
};

function NewCycle({ done }: { done(): void }) {
  return <section className="panel wide"><h2>Start a new Udhiyya cycle</h2>
    <AsyncForm submit="Create cycle" action={async form => {
      await api('/udhiyya/cycles', 'POST', {
        name: value(form, 'name').trim(), targetDate: value(form, 'targetDate'), priceLockDate: value(form, 'priceLockDate'),
        familyPercent: Number(value(form, 'family')), relativesPercent: Number(value(form, 'relatives')),
        poorPercent: Number(value(form, 'poor')), meatKgPerShare: Number(value(form, 'kg')),
        slots: value(form, 'slots').split(',').map(slot => slot.trim()).filter(Boolean),
      }, true);
      done();
      return 'Cycle created. Add animal plans next.';
    }}>
      <Field label="Name" name="name" maxLength={80} placeholder="Udhiyya 1448" />
      <Field label="Udhiyya (Eid) date" name="targetDate" type="date" />
      <Field label="Price lock date (final installment)" name="priceLockDate" type="date" />
      <div className="grid3"><Field label="Family %" name="family" type="number" min={0} max={100} defaultValue={33} />
        <Field label="Relatives %" name="relatives" type="number" min={0} max={100} defaultValue={33} />
        <Field label="Poor %" name="poor" type="number" min={0} max={100} defaultValue={34} /></div>
      <Field label="Meat per share (kg)" name="kg" type="number" min={1} max={100} defaultValue={10} />
      <label className="field"><span>Pickup slots (comma separated)</span>
        <input name="slots" placeholder="08:00-09:00, 09:00-10:00" /></label>
    </AsyncForm></section>;
}

function Overview({ cycleId, reloadAll }: { cycleId: string; reloadAll(): void }) {
  const summary = useLoad<Summary>(`/udhiyya/cycles/${cycleId}/summary`);
  const [notice, setNotice] = useState('');
  return <Loaded result={summary}>{data => <section className="panel wide stack">
    <header className="row"><h2>{data.cycle.name}</h2><span className="badge">{data.cycle.status.toLowerCase()}</span></header>
    <p>Udhiyya around {day(data.cycle.targetDate)} · price locks {day(data.cycle.priceLockDate)}</p>
    <Progress done={data.collected} total={data.expected} label="Collected so far" />
    <div className="stats">
      <div className="stat"><strong>{rupees(data.collected)}</strong><span>of {rupees(data.expected)} collected</span></div>
      <div className="stat"><strong>{data.enrollments}</strong><span>families · {data.paidFamilies} fully paid</span></div>
      <div className="stat"><strong>{data.behind}</strong><span>behind schedule</span></div>
      <div className="stat"><strong>{rupees(data.pendingAmount)}</strong><span>{data.pendingPayments} UPI awaiting confirmation</span></div>
    </div>
    <table><caption>Animals needed</caption><thead><tr><th>Plan</th><th>Shares</th><th>Animals needed</th><th>Bought</th></tr></thead>
      <tbody>{data.plans.map(plan => <tr key={plan.id}><td>{plan.name}</td><td>{plan.shares}</td>
        <td>{plan.animalsNeeded}</td><td>{plan.animalsRecorded}</td></tr>)}</tbody></table>
    <div className="actions">
      {next[data.cycle.status] && <button onClick={async () => {
        if (!window.confirm(next[data.cycle.status]!.label + '? This cannot be undone.')) return;
        try { await api(`/udhiyya/cycles/${cycleId}`, 'PATCH', { status: next[data.cycle.status]!.to }, true); setNotice(''); }
        catch (error) { setNotice(error instanceof Error ? error.message : 'Could not change the stage.'); }
        reloadAll();
      }}>{next[data.cycle.status]!.label}</button>}
      {data.cycle.status !== 'CLOSED' && <button className="secondary" onClick={async () => {
        try {
          const result = await api<{ behind: number; sent: number; skipped: number }>(`/udhiyya/cycles/${cycleId}/reminders`, 'POST', {}, true);
          setNotice(`${result.behind} behind · ${result.sent} reminders sent · ${result.skipped} skipped (no opt-in).`);
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not send reminders.'); }
      }}>Remind members who are behind</button>}
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {data.cycle.status === 'ACTIVE' && <details><summary>Add an animal plan</summary>
      <AsyncForm submit="Add plan" action={async form => {
        const animalType = value(form, 'type');
        await api(`/udhiyya/cycles/${cycleId}/plans`, 'POST', { name: value(form, 'name').trim(), animalType,
          sharePrice: Number(value(form, 'price')), sharesPerAnimal: ['COW', 'CAMEL'].includes(animalType) ? 7 : 1 }, true);
        reloadAll();
        return 'Plan added.';
      }}>
        <Field label="Plan name" name="name" maxLength={60} placeholder="Cow share" />
        <label className="field"><span>Animal</span><select name="type">
          <option value="GOAT">Goat (1 share)</option><option value="SHEEP">Sheep (1 share)</option>
          <option value="COW">Cow (7 shares)</option><option value="CAMEL">Camel (7 shares)</option></select></label>
        <Field label="Price per share (₹)" name="price" type="number" min={1} />
      </AsyncForm></details>}
  </section>}</Loaded>;
}

function Procurement({ cycleId }: { cycleId: string }) {
  const animals = useLoad<Animal[]>(`/udhiyya/cycles/${cycleId}/animals`);
  return <section className="panel wide stack"><h2>Animals bought</h2>
    <Loaded result={animals}>{items => items.length ? <table><thead><tr><th>Label</th><th>Type</th><th>Cost</th><th>Seller</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td>{item.label}</td><td>{item.animalType.toLowerCase()}</td>
        <td>{item.cost ? rupees(item.cost) : '—'}</td><td>{item.seller ?? '—'}</td></tr>)}</tbody></table> : <p>None recorded yet.</p>}</Loaded>
    <details><summary>Record an animal</summary><AsyncForm submit="Save animal" action={async form => {
      await api(`/udhiyya/cycles/${cycleId}/animals`, 'POST', { animalType: value(form, 'type'), label: value(form, 'label').trim(),
        ...(value(form, 'cost') && { cost: Number(value(form, 'cost')) }), ...(value(form, 'seller').trim() && { seller: value(form, 'seller').trim() }) }, true);
      animals.reload();
      return 'Saved.';
    }}>
      <label className="field"><span>Animal</span><select name="type"><option value="GOAT">Goat</option><option value="SHEEP">Sheep</option>
        <option value="COW">Cow</option><option value="CAMEL">Camel</option></select></label>
      <Field label="Label" name="label" maxLength={60} placeholder="Goat 1" />
      <Field label="Cost (₹)" name="cost" type="number" min={1} required={false} />
      <Field label="Seller" name="seller" maxLength={80} required={false} />
    </AsyncForm></details></section>;
}

function Distribution({ cycle }: { cycle: Cycle }) {
  const people = useLoad<Beneficiary[]>('/udhiyya/beneficiaries');
  const tokens = useLoad<Token[]>(['PROCUREMENT', 'DISTRIBUTION'].includes(cycle.status) ? `/udhiyya/cycles/${cycle.id}/tokens` : null);
  return <section className="panel wide stack"><h2>Distribution</h2>
    <p>Split: family {cycle.familyPercent}% · relatives {cycle.relativesPercent}% · poor {cycle.poorPercent}% · {cycle.meatKgPerShare} kg a share.</p>
    <h3>Beneficiary register</h3>
    <Loaded result={people}>{items => items.length ? <table><thead><tr><th>Name</th><th>Area</th><th>Delivery</th><th /></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.area}</td><td>{item.needsDelivery ? 'Home' : 'Pickup'}</td>
        <td><button className="secondary" onClick={async () => {
          try { await api('/udhiyya/beneficiaries/' + item.id, 'DELETE', {}, true); } catch { /* reload shows the truth */ }
          people.reload();
        }}>Remove</button></td></tr>)}</tbody></table> : <p>No beneficiaries yet.</p>}</Loaded>
    <details><summary>Add a beneficiary</summary><AsyncForm submit="Add" action={async form => {
      await api('/udhiyya/beneficiaries', 'POST', { name: value(form, 'name').trim(), area: value(form, 'area').trim(),
        needsDelivery: form.has('delivery'), ...(value(form, 'address').trim() && { address: value(form, 'address').trim() }),
        ...(value(form, 'phone').trim() && { phone: value(form, 'phone').trim() }) }, true);
      people.reload();
      return 'Added.';
    }}>
      <Field label="Name" name="name" maxLength={80} /><Field label="Area" name="area" maxLength={60} />
      <Field label="Address" name="address" maxLength={200} required={false} />
      <Field label="Phone" name="phone" maxLength={20} required={false} />
      <label className="check"><input type="checkbox" name="delivery" /> Needs home delivery</label>
    </AsyncForm></details>
    {['PROCUREMENT', 'DISTRIBUTION'].includes(cycle.status) && <>
      <AsyncForm submit="Create missing meat tokens" action={async () => {
        const result = await api<{ createdMembers: number; createdBeneficiaries: number; gramsPerBeneficiary: number }>(
          `/udhiyya/cycles/${cycle.id}/tokens`, 'POST', {}, true);
        tokens.reload();
        return `${result.createdMembers} member and ${result.createdBeneficiaries} beneficiary tokens created (${kg(result.gramsPerBeneficiary)} per beneficiary).`;
      }} />
      <Loaded result={tokens}>{items => items.length > 0 && <table><caption>Tokens (only fully paid members get one)</caption>
        <thead><tr><th>Name</th><th>Type</th><th>Code</th><th>Meat</th><th>Slot / delivery</th><th>Status</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.kind === 'MEMBER' ? 'Member' : 'Beneficiary'}</td>
          <td><code>{item.code}</code></td><td>{kg(item.grams)}</td>
          <td>{item.delivery ? `Deliver · ${item.area}${item.address ? ', ' + item.address : ''}` : item.slot ?? '—'}</td>
          <td>{item.status === 'COLLECTED' ? 'Collected' : 'Pending'}</td></tr>)}</tbody></table>}</Loaded></>}
  </section>;
}

function Collectors() {
  return <section className="panel wide"><h2>Collectors</h2>
    <p>Volunteers with this role can record cash, confirm UPI payments and scan meat tokens. They must already have a verified account.</p>
    <AsyncForm submit="Add collector" action={async form => {
      await api('/udhiyya/collectors', 'POST', { email: value(form, 'email').trim(), enabled: true }, true);
      return 'Collector added.';
    }}><Field label="Volunteer email" name="email" type="email" /></AsyncForm>
    <AsyncForm submit="Remove collector" action={async form => {
      await api('/udhiyya/collectors', 'POST', { email: value(form, 'email').trim(), enabled: false }, true);
      return 'Collector removed.';
    }}><Field label="Volunteer email" name="email" type="email" /></AsyncForm></section>;
}

export function UdhiyyaAdmin() {
  const cycle = useLoad<{ cycle: Cycle | null }>('/udhiyya/cycle');
  const [version, setVersion] = useState(0);
  const reloadAll = () => { cycle.reload(); setVersion(count => count + 1); };
  return <div className="stack"><h1>Udhiyya management</h1>
    <Loaded result={cycle}>{({ cycle: current }) => current ? <div className="stack" key={version}>
      <Overview cycleId={current.id} reloadAll={reloadAll} /><Procurement cycleId={current.id} />
      <Distribution cycle={current} /><Collectors /></div> : <><NewCycle done={reloadAll} /><Collectors /></>}</Loaded></div>;
}
