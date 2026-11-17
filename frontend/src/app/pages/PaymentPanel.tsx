import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/auth';
import { useApp } from '../lib/app-context';
import { dateText, inr, type PayMode } from '../lib/programs';
import { openCheckout } from '../lib/razorpay';
import { Field, Modal, useAction, useFetch } from '../ui/kit';

export type Money = {
  total: number; paid: number; pending: number; credit: number; payBy: string; installments: number; monthlyAmount: number; expected: number;
  due: number; standing: 'PAID' | 'ON_TRACK' | 'BEHIND'; nextDue: string | null; suggested: number; remaining: number;
};
export type PaymentRow = { id: string; amount: number; method: 'CASH' | 'ONLINE'; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; note: string | null; createdAt: string };

const standingText = { PAID: 'Paid in full', ON_TRACK: 'On track', BEHIND: 'Payment due' } as const;
const statusText = { PENDING: 'Pending', CONFIRMED: 'Paid', REJECTED: 'Not completed' } as const;

function PayModal({ bookingId, money, close, done }: { bookingId: string; money: Money; close(): void; done(): void }) {
  const { user } = useAuth();
  const { toast } = useApp();
  const config = useFetch<{ online: boolean }>('/payments/config');
  const { busy, error, run, setError } = useAction();
  const [amount, setAmount] = useState(String(money.suggested || money.remaining));
  const [method, setMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= 1 && value <= money.remaining;
  const online = config.data?.online;

  const payOnline = () => run(async () => {
    const order = await api<{ paymentId: string; orderId: string; amountPaise: number; currency: string; keyId: string; description: string }>(
      `/bookings/${bookingId}/payments/online`, 'POST', { amount: value }, true);
    const result = await openCheckout({ key: order.keyId, amount: order.amountPaise, currency: order.currency, order_id: order.orderId,
      name: 'Udhiyya Saver', description: order.description, prefill: { name: user?.name, email: user?.email }, theme: { color: '#0e5c48' } });
    if (!result) { setError('The payment window was closed. Nothing was charged.'); return; }
    await api(`/payments/${order.paymentId}/verify`, 'POST', { razorpayPaymentId: result.razorpay_payment_id, signature: result.razorpay_signature }, true);
    toast('Payment received. Thank you!'); done(); close();
  });

  return <Modal title={<>Make a <span className="serif">payment</span></>} onClose={close}>
    <div className="kv"><span>Remaining</span><b>{inr(money.remaining)}</b></div>
    <div className="am-chips" role="group" aria-label="Suggested amounts" style={{ margin: '12px 0' }}>
      {[...new Set([money.suggested, money.remaining].filter(item => item > 0))].map(item => <button key={item} type="button"
        className={'chipbtn' + (value === item ? ' on' : '')} onClick={() => setAmount(String(item))}>
        {item === money.remaining ? 'Pay in full ' : 'Due now '}{inr(item)}</button>)}
    </div>
    <Field label="Amount (₹)" type="number" min={1} max={money.remaining} inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} />
    <div className="seg" role="group" aria-label="Payment method" style={{ margin: '4px 0 16px' }}>
      <button type="button" className={method === 'ONLINE' ? 'on' : ''} onClick={() => setMethod('ONLINE')}>Pay online</button>
      <button type="button" className={method === 'CASH' ? 'on' : ''} onClick={() => setMethod('CASH')}>Pay cash</button></div>
    {method === 'ONLINE' ? (online === false ? <p className="am-error">Online payments are not enabled yet. Please pay your committee in cash for now.</p> :
      <p className="am-note">UPI, cards and net banking through Razorpay. You will see a secure payment window.</p>) :
      <p className="am-note">Hand the amount to your mahallu committee. They record it in the app and it appears here as paid.</p>}
    {error && <p className="am-error" role="alert">{error}</p>}
    {method === 'ONLINE' && <button type="button" className="pillbtn" disabled={busy || !valid || online !== true} onClick={() => void payOnline()}>
      {busy ? 'Opening…' : `Pay ${valid ? inr(value) : ''}`}</button>}
    {method === 'CASH' && <button type="button" className="pillbtn ghost" onClick={close}>Got it</button>}
  </Modal>;
}

export function PaymentPanel({ bookingId, payMode, money, payments, autopay, open, reload }:
{ bookingId: string; payMode: PayMode; money: Money; payments: PaymentRow[]; autopay: boolean; open: boolean; reload(): void }) {
  const [paying, setPaying] = useState(false);
  const { busy, error, run } = useAction();
  const { toast } = useApp();
  const percent = money.total ? Math.min(100, Math.round(money.paid / money.total * 100)) : 0;
  return <div className="am-pay">
    <div className="am-headrow" style={{ alignItems: 'center' }}>
      <span className={'tag' + (money.standing === 'BEHIND' ? ' amber' : '')}>{standingText[money.standing]}</span>
      <span className="am-sub">{percent}% paid</span></div>
    <div className="progress" role="progressbar" aria-label="Amount paid" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: percent + '%' }} /></div>
    <div className="kv"><span>Paid</span><b>{inr(money.paid)} of {inr(money.total)}</b></div>
    {money.pending > 0 && <div className="kv"><span>In progress</span><b>{inr(money.pending)}</b></div>}
    {money.credit > 0 && <p className="am-ok">You have paid {inr(money.credit)} more than the current price. Ask your committee about adjusting it.</p>}
    {money.remaining > 0 && <p className="am-note" style={{ margin: 0 }}>
      {payMode === 'INSTALLMENTS' ? `${inr(money.monthlyAmount)} a month for ${money.installments} ${money.installments === 1 ? 'month' : 'months'}` : `One payment of ${inr(money.total)}`}
      {` · all paid by ${dateText(money.payBy)}`}{money.nextDue && payMode === 'INSTALLMENTS' ? ` · next ${dateText(money.nextDue)}` : ''}</p>}
    {money.standing === 'BEHIND' && <p className="am-error" style={{ margin: 0 }}>{inr(money.due)} is due now to stay on schedule.</p>}
    {open && money.remaining > 0 && <button type="button" className="pillbtn" onClick={() => setPaying(true)}>Pay now</button>}
    {open && payMode === 'INSTALLMENTS' && <label className="am-switchrow"><span><b>Autopay reminders</b>
      <span className="am-sub">A monthly nudge with a ready-to-pay link.</span></span>
      <span className="switch"><input type="checkbox" checked={autopay} disabled={busy} aria-label="Autopay reminders"
        onChange={event => run(async () => { await api(`/bookings/${bookingId}/autopay`, 'PUT', { enabled: event.target.checked }, true);
          toast(event.target.checked ? 'Autopay reminders on' : 'Autopay reminders off'); reload(); })} /><span className="tr" /></span></label>}
    {error && <p className="am-error" role="alert">{error}</p>}
    {payments.length > 0 && <details className="am-history"><summary>Payment history ({payments.length})</summary>
      {payments.map(item => <div key={item.id} className="am-history-row"><span>{new Date(item.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
        <span className="am-sub"> · {item.method === 'CASH' ? 'Cash' : 'Online'}{item.note ? ' · ' + item.note : ''}</span></span>
        <span><b>{inr(item.amount)}</b> <span className={'status' + (item.status === 'PENDING' ? ' pend' : item.status === 'REJECTED' ? ' disp' : '')}>{statusText[item.status]}</span></span></div>)}
    </details>}
    {paying && <PayModal bookingId={bookingId} money={money} close={() => setPaying(false)} done={reload} />}
  </div>;
}
