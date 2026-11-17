import { useState } from 'react';
import { api } from '../../api/client';
import { useApp } from '../lib/app-context';
import { animalLabel, dateText, inr, type AnimalType } from '../lib/programs';
import { ErrorNote, Field, form, Loading, Modal, useAction, useFetch } from '../ui/kit';

type Row = { id: string; amount: number; method: 'CASH' | 'ONLINE'; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; note: string | null; createdAt: string;
  animalType: AnimalType; household: { mahalluNumber: string; ownerName: string } };
type Overview = { expected: number; collected: number; outstanding: number; cash: number; online: number; behind: number; paidInFull: number; rows: Row[] };
const statusText = { PENDING: 'Pending', CONFIRMED: 'Confirmed', REJECTED: 'Voided' } as const;

export function CashModal({ bookingId, owner, remaining, close, done }: { bookingId: string; owner: string; remaining: number; close(): void; done(): void }) {
  const { busy, error, submit } = useAction();
  const { toast } = useApp();
  return <Modal title={<>Record <span className="serif">cash</span></>} onClose={close}>
    <p className="am-note" style={{ marginBottom: 12 }}>Cash received from <b>{owner}</b>. They still owe {inr(remaining)}.</p>
    <form onSubmit={submit(async data => {
      await api(`/bookings/${bookingId}/payments/cash`, 'POST', { amount: Number(form(data, 'amount')), ...(form(data, 'note') && { note: form(data, 'note') }) }, true);
      toast('Cash recorded'); done(); close();
    })}>
      <Field label="Amount received (₹)" name="amount" type="number" min={1} max={remaining} required inputMode="numeric" defaultValue={remaining} />
      <Field label="Note (optional)" name="note" maxLength={200} required={false} placeholder="Received by …" />
      {error && <p className="am-error" role="alert">{error}</p>}
      <button className="pillbtn" type="submit" disabled={busy || remaining <= 0}>{busy ? 'Saving…' : 'Record payment'}</button>
    </form>
  </Modal>;
}

export function PaymentsCard({ programId, open, refreshKey, onChange }: { programId: string; open: boolean; refreshKey: number; onChange(): void }) {
  const { data, error, loading, reload } = useFetch<Overview>(`/programs/${programId}/payments?k=${refreshKey}`);
  const { busy, error: failure, run } = useAction();
  const { toast } = useApp();
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const [reminder, setReminder] = useState('');
  const gateway = useFetch<{ online: boolean; mode: 'test' | 'live' | null; webhook: boolean }>('/payments/config');
  const refresh = () => { reload(); onChange(); };
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorNote message={error} />;
  const percent = data.expected ? Math.min(100, Math.round(data.collected / data.expected * 100)) : 0;
  return <section className="card" style={{ marginTop: 22 }}>
    <div className="am-headrow">
      <div><div className="eyebrow"><span className="dot" />PAYMENTS</div><h2 style={{ fontSize: 22, marginTop: 8 }}>Money <span className="serif">collected</span></h2></div>
      {open && <button type="button" className="pillbtn ghost" disabled={busy} onClick={() => run(async () => {
        const result = await api<{ behind: number; sent: number; skipped: number }>(`/programs/${programId}/reminders`, 'POST', {}, true);
        setReminder(`${result.behind} households to remind · ${result.sent} sent · ${result.skipped} skipped (no email or Telegram opt-in).`);
        toast('Reminders processed');
      })}>Send reminders</button>}
    </div>
    {gateway.data && (gateway.data.online ?
      <p className="am-ok">Online payments are on in <b>{gateway.data.mode === 'live' ? 'live' : 'test'} mode</b>{gateway.data.mode === 'test' ? ' (no real money moves)' : ''}.{!gateway.data.webhook && ' The webhook is not set up, so a payment is only confirmed if the member returns to the app.'}</p> :
      <p className="am-note">Online payments are off. Add the Razorpay keys on the server to turn them on. Members can still pay cash.</p>)}
    {reminder && <p className="am-ok">{reminder}</p>}
    {failure && <ErrorNote message={failure} />}
    <div className="progress" style={{ margin: '16px 0' }} role="progressbar" aria-label="Collected" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: percent + '%' }} /></div>
    <div className="stat-grid" role="list" style={{ marginTop: 0 }}>
      <div className="stat"><div className="eyebrow">Collected</div><div className="v">{inr(data.collected)}</div><div className="s">of {inr(data.expected)} expected</div></div>
      <div className="stat"><div className="eyebrow">Outstanding</div><div className="v">{inr(data.outstanding)}</div><div className="s">{data.behind} behind schedule</div></div>
      <div className="stat"><div className="eyebrow">Cash</div><div className="v">{inr(data.cash)}</div><div className="s">recorded by committee</div></div>
      <div className="stat"><div className="eyebrow">Online</div><div className="v">{inr(data.online)}</div><div className="s">{data.paidInFull} paid in full</div></div>
    </div>
    <h3 style={{ margin: '24px 0 10px' }}>Transactions</h3>
    {data.rows.length === 0 ? <div className="empty"><h3>No payments yet</h3><p>Online and cash payments appear here as they happen.</p></div> :
      <div className="tx-wrap"><table className="tx"><thead><tr><th>Date</th><th>Household</th><th>Animal</th><th>Method</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th /></tr></thead>
        <tbody>{data.rows.map(row => <tr key={row.id}><td>{dateText(row.createdAt)}</td>
          <td><b>{row.household.ownerName}</b><div className="am-sub">{row.household.mahalluNumber}{row.note ? ' · ' + row.note : ''}</div></td>
          <td>{animalLabel[row.animalType]}</td><td>{row.method === 'CASH' ? 'Cash' : 'Online'}</td>
          <td><span className={'status' + (row.status === 'PENDING' ? ' pend' : row.status === 'REJECTED' ? ' disp' : '')}>{statusText[row.status]}</span></td>
          <td className="amt" style={{ textAlign: 'right' }}>{inr(row.amount)}</td>
          <td>{open && row.method === 'CASH' && row.status === 'CONFIRMED' && <button type="button" className="chipbtn" onClick={() => setNote({ id: row.id, text: '' })}>Void</button>}</td></tr>)}</tbody></table></div>}
    {note && <Modal title={<>Void <span className="serif">payment</span></>} onClose={() => setNote(null)}>
      <p className="am-note" style={{ marginBottom: 12 }}>Use this only for a cash entry made by mistake. The reason is kept on the record.</p>
      <Field label="Reason" value={note.text} maxLength={200} onChange={event => setNote({ ...note, text: event.target.value })} />
      <button type="button" className="pillbtn danger" disabled={busy || note.text.trim().length < 3} onClick={() => run(async () => {
        await api(`/payments/${note.id}/void`, 'POST', { note: note.text.trim() }, true);
        toast('Payment voided'); setNote(null); refresh();
      })}>Void payment</button></Modal>}
  </section>;
}
