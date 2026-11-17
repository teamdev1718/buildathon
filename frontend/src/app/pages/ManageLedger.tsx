import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { dateText, inr, splitName, type Program } from '../lib/programs';
import { CustomSelect } from '../ui/CustomSelect';
import { IconDownload } from '../ui/Icons';
import { ErrorNote, Field, form, Loading, Modal, PageHead, useAction, useFetch } from '../ui/kit';

export const categoryLabel: Record<string, string> = { ANIMALS: 'Animals', TRANSPORT: 'Transport', LABOUR: 'Labour', PACKING: 'Packing', FOOD: 'Food and water', OTHER: 'Other' };
type Summary = {
  households: number; bookedHouseholds: number; bookings: number; shares: number;
  money: { expected: number; collected: number; outstanding: number; cash: number; online: number; spent: number; balance: number; paid: number; onTrack: number; behind: number };
  animals: { total: number; pending: number; slaughtered: number; processing: number; packed: number };
  meat: { issued: number; handedOut: number; inHand: number; householdsServed: number; handovers: number; confirmed: number };
};
type Expense = { id: string; title: string; category: string; amount: number; spentOn: string; note: string | null; voidedAt: string | null; voidReason: string | null };
type Entry = { id: string; at: string; type: 'PAYMENT' | 'EXPENSE' | 'MEAT_ISSUE' | 'DISTRIBUTION'; title: string; detail: string; amount: number | null; packets: number | null; status: string };
const typeLabel = { PAYMENT: 'Payments', EXPENSE: 'Expenses', MEAT_ISSUE: 'Meat issued', DISTRIBUTION: 'Meat given' } as const;

function ExpenseForm({ programId, item, close, done }: { programId: string; item: Expense | null; close(): void; done(): void }) {
  const { busy, error, submit } = useAction();
  const { toast } = useApp();
  const [category, setCategory] = useState(item?.category ?? 'ANIMALS');
  return <Modal title={item ? <>Edit <span className="serif">expense</span></> : <>New <span className="serif">expense</span></>} onClose={close}>
    <form onSubmit={submit(async data => {
      const body = { title: form(data, 'title'), category, amount: Number(form(data, 'amount')), spentOn: form(data, 'spentOn'), ...(form(data, 'note') && { note: form(data, 'note') }) };
      if (item) await api('/expenses/' + item.id, 'PATCH', body, true); else await api(`/programs/${programId}/expenses`, 'POST', body, true);
      toast(item ? 'Expense updated' : 'Expense recorded'); done(); close();
    })}>
      <Field label="What was it for?" name="title" required maxLength={120} defaultValue={item?.title} placeholder="Pickup truck for animals" />
      <div className="field"><label>Category</label><CustomSelect variant="input" block value={category} ariaLabel="Category" onChange={setCategory}
        options={Object.entries(categoryLabel).map(([value, label]) => ({ value, label }))} /></div>
      <div className="grid2"><Field label="Amount (₹)" name="amount" type="number" min={1} required inputMode="numeric" defaultValue={item?.amount} />
        <Field label="Date" name="spentOn" type="date" required defaultValue={item?.spentOn.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} /></div>
      <Field label="Note (shown publicly, optional)" name="note" maxLength={300} required={false} defaultValue={item?.note ?? ''} />
      <p className="am-note" style={{ marginBottom: 10 }}>Expenses are public. Do not include personal details.</p>
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Record expense'}</button>
    </form>
  </Modal>;
}

function Expenses({ programId, onChange }: { programId: string; onChange(): void }) {
  const { data, error, loading, reload } = useFetch<Expense[]>(`/programs/${programId}/expenses`);
  const { busy, run, error: failure } = useAction();
  const { toast } = useApp();
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [voiding, setVoiding] = useState<{ id: string; reason: string } | null>(null);
  const refresh = () => { reload(); onChange(); };
  return <section className="card">
    <div className="am-headrow"><div><div className="eyebrow"><span className="dot" />EXPENSES</div><h2 style={{ fontSize: 22, marginTop: 8 }}>Where the money <span className="serif">went</span></h2></div>
      <button type="button" className="pillbtn" onClick={() => setEditing('new')}>Add expense</button></div>
    {failure && <ErrorNote message={failure} />}
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : data.length === 0 ? <div className="empty"><h3>No expenses yet</h3><p>Everything you record here is visible on the public ledger.</p></div> :
      <div className="tx-wrap" style={{ marginTop: 14 }}><table className="tx"><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th /></tr></thead>
        <tbody>{data.map(row => <tr key={row.id} style={row.voidedAt ? { opacity: .55 } : undefined}><td>{dateText(row.spentOn)}</td>
          <td><b style={row.voidedAt ? { textDecoration: 'line-through' } : undefined}>{row.title}</b><div className="am-sub">{row.voidedAt ? `Voided: ${row.voidReason}` : row.note}</div></td>
          <td>{categoryLabel[row.category]}</td><td className="amt" style={{ textAlign: 'right' }}>{inr(row.amount)}</td>
          <td>{!row.voidedAt && <div className="row-actions"><button type="button" className="chipbtn" onClick={() => setEditing(row)}>Edit</button>
            <button type="button" className="chipbtn" onClick={() => setVoiding({ id: row.id, reason: '' })}>Void</button></div>}</td></tr>)}</tbody></table></div>}
    {editing && <ExpenseForm programId={programId} item={editing === 'new' ? null : editing} close={() => setEditing(null)} done={refresh} />}
    {voiding && <Modal title={<>Void <span className="serif">expense</span></>} onClose={() => setVoiding(null)}>
      <p className="am-note" style={{ marginBottom: 12 }}>It stays on the public ledger, struck out, with your reason.</p>
      <Field label="Reason" value={voiding.reason} maxLength={200} onChange={event => setVoiding({ ...voiding, reason: event.target.value })} />
      <button type="button" className="pillbtn danger" disabled={busy || voiding.reason.trim().length < 3} onClick={() => run(async () => {
        await api(`/expenses/${voiding.id}/void`, 'POST', { reason: voiding.reason.trim() }, true); toast('Expense voided'); setVoiding(null); refresh();
      })}>Void expense</button></Modal>}
  </section>;
}

function Feed({ programId, refreshKey }: { programId: string; refreshKey: number }) {
  const { data, error, loading } = useFetch<Entry[]>(`/programs/${programId}/transactions?k=${refreshKey}`);
  const [filter, setFilter] = useState('ALL');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  const rows = data.filter(row => filter === 'ALL' || row.type === filter);
  const exportCsv = () => {
    const cell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = ['Date,Type,Title,Detail,Amount (INR),Packets,Status', ...rows.map(row => [new Date(row.at).toISOString(), typeLabel[row.type], row.title, row.detail, row.amount, row.packets, row.status].map(cell).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'transactions.csv'; link.click(); URL.revokeObjectURL(link.href);
  };
  return <section className="card">
    <div className="eyebrow"><span className="dot" />ALL TRANSACTIONS</div>
    <h2 style={{ fontSize: 22, margin: '8px 0 14px' }}>Every rupee and <span className="serif">packet</span></h2>
    <div className="toolbar"><CustomSelect variant="mini" value={filter} ariaLabel="Filter transactions" onChange={setFilter}
      options={[{ value: 'ALL', label: 'Everything' }, ...Object.entries(typeLabel).map(([value, label]) => ({ value, label }))]} />
      <span className="grow" /><button type="button" className="chipbtn" onClick={exportCsv} disabled={!rows.length}><IconDownload />Export CSV</button></div>
    {rows.length === 0 ? <div className="empty"><h3>Nothing here yet</h3><p>Payments, expenses and meat movements appear as they happen.</p></div> :
      <div className="tx-wrap"><table className="tx"><thead><tr><th>When</th><th>Transaction</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.type + row.id}><td>{new Date(row.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td><b>{row.title}</b><div className="am-sub">{row.detail}</div></td>
          <td><span className={'status' + (row.status === 'PENDING' ? ' pend' : row.status === 'REJECTED' || row.status === 'VOIDED' ? ' disp' : '')}>{row.status.toLowerCase()}</span></td>
          <td className="amt" style={{ textAlign: 'right' }}>{row.amount !== null ? (row.type === 'EXPENSE' ? '−' : '+') + inr(row.amount) : `${row.packets} packets`}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function ManageLedger() {
  const { activeMahallu } = useApp();
  const id = activeMahallu?.mahalluId;
  const programs = useFetch<(Program & { bookings: number })[]>(id ? `/mahallus/${id}/programs` : null);
  const [version, setVersion] = useState(0);
  const program = programs.data?.find(item => item.status === 'OPEN') ?? programs.data?.[0];
  const summary = useFetch<Summary>(program ? `/programs/${program.id}/summary?k=${version}` : null);
  if (!id) return null;
  if (programs.loading && !programs.data) return <Loading />;
  if (!program) return <><PageHead eyebrow="Ledger" title={<>The <span className="serif">books</span></>} /><div className="card empty"><h3>No program yet</h3><p>Create and start a program to see its money and meat here.</p>
    <Link className="pillbtn" style={{ marginTop: 14 }} to="/app/manage/programs">Go to programs</Link></div></>;
  const s = summary.data;
  return <>
    <PageHead eyebrow={`${activeMahallu?.mahalluName} · ${program.status === 'OPEN' ? 'running' : program.status.toLowerCase()}`} title={<>{splitName(program.name)[0]}<span className="serif">{splitName(program.name)[1]}</span> ledger</>}
      sub="Money in, money out, animals and meat in one place. Expenses are shown to the public."
      action={<Link className="pillbtn ghost" to={`/transparency/${program.id}`}>View public ledger</Link>} />
    {!s ? (summary.loading ? <Loading /> : <ErrorNote message={summary.error} />) : <div className="stack">
      <div className="stat-grid" role="list">
        <div className="stat"><div className="eyebrow">Collected</div><div className="v">{inr(s.money.collected)}</div><div className="s">of {inr(s.money.expected)} · {inr(s.money.cash)} cash, {inr(s.money.online)} online</div></div>
        <div className="stat"><div className="eyebrow">Spent</div><div className="v">{inr(s.money.spent)}</div><div className="s">recorded expenses</div></div>
        <div className="stat"><div className="eyebrow">Balance</div><div className="v" style={{ color: s.money.balance < 0 ? 'var(--coral-ink)' : undefined }}>{inr(s.money.balance)}</div><div className="s">collected minus spent</div></div>
        <div className="stat"><div className="eyebrow">Outstanding</div><div className="v">{inr(s.money.outstanding)}</div><div className="s">{s.money.behind} behind · {s.money.paid} paid in full</div></div></div>
      <div className="stat-grid" role="list" style={{ marginTop: 0 }}>
        <div className="stat"><div className="eyebrow">Households</div><div className="v">{s.bookedHouseholds}/{s.households}</div><div className="s">{s.shares} shares booked</div></div>
        <div className="stat"><div className="eyebrow">Animals packed</div><div className="v">{s.animals.packed}/{s.animals.total}</div><div className="s">{s.animals.slaughtered} slaughtered · {s.animals.processing} processing</div></div>
        <div className="stat"><div className="eyebrow">Meat handed out</div><div className="v">{s.meat.handedOut}</div><div className="s">of {s.meat.issued} packets · {s.meat.inHand} with volunteers</div></div>
        <div className="stat"><div className="eyebrow">Households served</div><div className="v">{s.meat.householdsServed}</div><div className="s">{s.meat.confirmed} confirmed receipt</div></div></div>
      <Expenses programId={program.id} onChange={() => setVersion(count => count + 1)} />
      <Feed programId={program.id} refreshKey={version} />
    </div>}
  </>;
}
