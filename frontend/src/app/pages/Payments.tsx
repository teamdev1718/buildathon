import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import { useApp } from '../lib/app-context';
import { animalLabel, dateText, inr, planRows, splitName, type MyBooking, type MyProgram } from '../lib/programs';
import { downloadReceipt } from '../lib/receipt';
import { IconCard, IconCheck, IconChevronRight, IconDownload } from '../ui/Icons';
import { ErrorNote, Loading, Modal, useAction, useFetch } from '../ui/kit';
import { IconAnimal, IconCalendar, IconReceipt } from '../ui/more-icons';
import { Ring, Skyline } from '../ui/visuals';
import { PayModal } from './PaymentPanel';

const stateText = { PAID: 'Paid', DUE: 'Due', OVERDUE: 'Overdue', UPCOMING: 'Upcoming' } as const;
const methodText = { CASH: 'Cash', ONLINE: 'Online' } as const;
const statusText = { PENDING: 'Pending', CONFIRMED: 'Confirmed', REJECTED: 'Not completed' } as const;

function receiptFor(program: MyProgram, booking: MyBooking, memberName: string, only?: string) {
  const confirmed = booking.payments.filter(item => item.status === 'CONFIRMED' && (!only || item.id === only));
  return { member: memberName, household: `${program.household.ownerName} (${program.household.mahalluNumber})`, mahallu: program.mahalluName,
    programme: program.name, animal: animalLabel[booking.animalType], shares: booking.shares, total: booking.money.total, paid: booking.money.paid,
    remaining: booking.money.remaining, payments: confirmed };
}

function History({ booking, onClose }: { booking: MyBooking; onClose(): void }) {
  return <Modal title={<>Payment <span className="serif">history</span></>} onClose={onClose}>
    {booking.payments.length === 0 ? <p className="am-note">No payments yet.</p> : booking.payments.map(item => <div key={item.id} className="am-history-row" style={{ padding: '12px 0' }}>
      <span>{new Date(item.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}<span className="am-sub"> · {methodText[item.method]}{item.note ? ' · ' + item.note : ''}</span></span>
      <span><b>{inr(item.amount)}</b> <span className={'status' + (item.status === 'PENDING' ? ' pend' : item.status === 'REJECTED' ? ' disp' : '')}>{statusText[item.status]}</span></span></div>)}
  </Modal>;
}

function Block({ program, booking, reload }: { program: MyProgram; booking: MyBooking; reload(): void }) {
  const { user } = useAuth();
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const [paying, setPaying] = useState(false);
  const [history, setHistory] = useState(false);
  const money = booking.money;
  const open = program.status === 'OPEN';
  const percent = money.total ? Math.min(100, Math.round(money.paid / money.total * 100)) : 0;
  const rows = planRows(booking, program.payBy);
  const status = money.standing === 'PAID' ? 'Paid in full' : money.standing === 'BEHIND' ? 'Payment due' : 'In progress';
  const plan = booking.payMode === 'ONE_TIME' ? `One payment of ${inr(money.total)} by ${dateText(program.payBy)}`
    : `${inr(money.monthlyAmount)} per month for ${money.installments} ${money.installments === 1 ? 'month' : 'months'}`;
  return <section className="stack am-reveal">
    <div className="card am-paysummary">
      <div className="am-paysummary-name"><span className="am-tile"><IconAnimal /></span>
        <div><b>{splitName(program.name).join('')}</b><span>{animalLabel[booking.animalType]} · {booking.shares} {booking.shares === 1 ? 'share' : 'shares'}</span></div></div>
      <div className="am-paystat"><span>Total amount</span><b>{inr(money.total)}</b></div>
      <div className="am-paystat"><span>Paid</span><b className="green">{inr(money.paid)}</b></div>
      <div className="am-paystat"><span>Remaining</span><b>{inr(money.remaining)}</b></div>
      <span className={'am-pill' + (money.standing === 'BEHIND' ? ' amber' : '')}>{status}</span>
    </div>

    <div className="am-paygrid">
      <div className="card">
        <div className="am-cardhead"><span className="am-tile"><IconCalendar /></span>
          <div><h2>{booking.payMode === 'ONE_TIME' ? 'Payment plan' : 'Monthly instalment plan'}</h2><span className="am-sub">{plan}</span></div></div>
        <ol className="am-plan">{rows.map((row, index) => <li key={index} className={'am-plan-row ' + row.state.toLowerCase()}>
          <span className="am-plan-dot">{row.state === 'PAID' ? <IconCheck /> : null}</span>
          <b className="am-plan-label">{row.label}</b><span className="am-plan-amount">{inr(row.amount)}</span>
          <span className={'am-pill ' + row.state.toLowerCase()}>{stateText[row.state]}</span>
          <span className="am-plan-date">{row.state === 'PAID' && row.paidOn ? dateText(row.paidOn) : `${row.state === 'OVERDUE' ? 'Was due' : 'Due on'} ${dateText(row.due)}`}</span>
          {row.state === 'PAID' ? <button type="button" className="am-iconchip" aria-label={`Download receipt for ${row.label}`} onClick={() => downloadReceipt(receiptFor(program, booking, user?.name ?? ''))}><IconReceipt /></button> : <span className="am-iconchip ghost" />}
        </li>)}</ol>
      </div>

      <aside className="card am-payside">
        <div className="am-ringcard"><Ring percent={percent} label={`${percent} percent paid`} />
          <div><b>Payment progress</b><span>{inr(money.paid)} of {inr(money.total)} paid</span></div></div>
        {error && <ErrorNote message={error} />}
        {open && money.remaining > 0 ? <button type="button" className="pillbtn am-wide" onClick={() => setPaying(true)}><IconCard />Pay now ({inr(money.suggested || money.remaining)})</button> :
          <p className="am-ok" style={{ margin: 0 }}>{money.remaining === 0 ? 'This booking is fully paid. Thank you!' : 'Payments are closed for this programme.'}</p>}
        {money.pending > 0 && <p className="am-note" style={{ margin: 0 }}>{inr(money.pending)} is waiting for confirmation.</p>}
        {money.standing === 'BEHIND' && open && <p className="am-error" style={{ margin: 0 }}>{inr(money.due)} is due now to stay on schedule.</p>}
        <button type="button" className="am-rowbtn" onClick={() => setHistory(true)}><IconReceipt /><span>Payment history</span><IconChevronRight /></button>
        <button type="button" className="am-rowbtn" onClick={() => downloadReceipt(receiptFor(program, booking, user?.name ?? ''))}><IconDownload /><span>Download receipt</span><IconChevronRight /></button>
        {open && booking.payMode === 'INSTALLMENTS' && <label className="am-switchrow"><span><b>Autopay reminders</b><span className="am-sub">A monthly nudge with a pay link.</span></span>
          <span className="switch"><input type="checkbox" checked={booking.autopay} disabled={busy} aria-label="Autopay reminders"
            onChange={event => run(async () => { await api(`/bookings/${booking.id}/autopay`, 'PUT', { enabled: event.target.checked }, true);
              toast(event.target.checked ? 'Autopay reminders on' : 'Autopay reminders off'); reload(); })} /><span className="tr" /></span></label>}
      </aside>
    </div>
    {paying && <PayModal bookingId={booking.id} money={money} close={() => setPaying(false)} done={reload} />}
    {history && <History booking={booking} onClose={() => setHistory(false)} />}
  </section>;
}

export function Payments() {
  const { data, error, loading, reload } = useFetch<MyProgram[]>('/me/programs');
  const mine = (data ?? []).flatMap(program => program.bookings.map(booking => ({ program, booking })));
  return <>
    <div className="am-track-head">
      <div><div className="eyebrow"><span className="dot" />PAYMENTS</div><h1 style={{ marginTop: 12 }}>Your Payments</h1>
        <p>Track your contributions, monthly instalments, and payment history{mine[0] ? ` for ${mine[0].program.name}` : ''}.</p></div>
      <Skyline />
    </div>
    {loading && !data ? <Loading /> : !data ? <ErrorNote message={error} /> : mine.length === 0 ?
      <div className="card empty"><h3>No payments yet</h3><p>Choose your animal and your payment plan appears here.</p><Link className="pillbtn" style={{ marginTop: 14 }} to="/app/welcome">Choose my animal</Link></div> :
      <div className="stack">{mine.map(({ program, booking }) => <Block key={booking.id} program={program} booking={booking} reload={reload} />)}</div>}
  </>;
}
