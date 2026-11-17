import { db, runSerializable } from '../../lib/db.js';
import { ApiError, log } from '../../lib/http.js';
import { notificationService } from '../notifications/notification.service.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';
import { financeOf, toPaise } from './payments.logic.js';
import { razorpay } from './razorpay.js';

type Actor = { id: string; permissions: string[] };
const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', what + ' not found.');
const withProgram = { program: { include: { animals: true } }, household: true, payments: true } as const;

async function loadBooking(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: withProgram });
  if (!booking) throw notFound('Booking');
  return booking;
}

function requireOpen(status: string) {
  if (status !== 'OPEN') throw new ApiError(409, 'NOT_OPEN', 'Payments can only be made while the program is open.');
}

const view = (payment: { id: string; amount: number; method: string; status: string; note: string | null; createdAt: Date; confirmedAt: Date | null }) => ({
  id: payment.id, amount: payment.amount, method: payment.method, status: payment.status, note: payment.note,
  createdAt: payment.createdAt, confirmedAt: payment.confirmedAt,
});

/** Marks a Razorpay order paid exactly once, whether the browser or the webhook gets there first. */
async function confirmOrder(orderId: string, razorpayPaymentId: string, amountPaise?: number) {
  const payment = await db.programPayment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment) return false;
  if (amountPaise !== undefined && amountPaise !== toPaise(payment.amount)) {
    log('payments.amount_mismatch');
    return false;
  }
  const changed = await db.programPayment.updateMany({ where: { id: payment.id, status: 'PENDING' },
    data: { status: 'CONFIRMED', razorpayPaymentId, confirmedAt: new Date() } });
  return changed.count > 0 || payment.status === 'CONFIRMED';
}

export const paymentService = {
  config: () => ({ online: razorpay.enabled(), keyId: razorpay.enabled() ? razorpay.keyId() : null }),

  /** Starts a Razorpay payment for a member's own booking. Nothing counts until the signature or webhook confirms it. */
  async startOnline(actor: Actor, bookingId: string, amount: number, request = fetch) {
    const booking = await loadBooking(bookingId);
    if (booking.household.userId !== actor.id) throw notFound('Booking');
    requireOpen(booking.program.status);
    const money = financeOf(booking);
    if (money.remaining <= 0) throw new ApiError(409, 'ALREADY_PAID', 'This booking is fully paid.');
    if (amount > money.remaining) throw new ApiError(409, 'OVERPAYMENT', 'That is more than the remaining balance.');
    const payment = await db.programPayment.create({ data: { bookingId, amount, method: 'ONLINE', status: 'PENDING' } });
    try {
      const order = await razorpay.createOrder({ amountPaise: toPaise(amount), receipt: payment.id.slice(0, 40), notes: { paymentId: payment.id } }, request);
      await db.programPayment.update({ where: { id: payment.id }, data: { razorpayOrderId: order.orderId } });
      return { paymentId: payment.id, orderId: order.orderId, amountPaise: toPaise(amount), currency: 'INR', keyId: razorpay.keyId(),
        description: `${booking.program.name} · ${booking.animalType.toLowerCase()}` };
    } catch (error) {
      await db.programPayment.update({ where: { id: payment.id }, data: { status: 'REJECTED', note: 'Order could not be created' } });
      throw error;
    }
  },

  /** The checkout widget calls this with the signature Razorpay returned. */
  async verifyOnline(actor: Actor, paymentId: string, input: { razorpayPaymentId: string; signature: string }) {
    const payment = await db.programPayment.findUnique({ where: { id: paymentId }, include: { booking: { include: { household: true } } } });
    if (!payment || payment.booking.household.userId !== actor.id || !payment.razorpayOrderId) throw notFound('Payment');
    if (!razorpay.verifyCheckout(payment.razorpayOrderId, input.razorpayPaymentId, input.signature)) {
      throw new ApiError(400, 'BAD_SIGNATURE', 'We could not verify this payment. If money left your account it will be reconciled shortly.');
    }
    await confirmOrder(payment.razorpayOrderId, input.razorpayPaymentId);
    return view(await db.programPayment.findUniqueOrThrow({ where: { id: paymentId } }));
  },

  /** Razorpay calls this server to server; the raw body must match its signature. */
  async webhook(rawBody: Buffer, signature: string, event: unknown) {
    if (!razorpay.verifyWebhook(rawBody, signature)) throw new ApiError(401, 'BAD_SIGNATURE', 'Invalid signature.');
    const body = event as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } } } };
    const entity = body.payload?.payment?.entity;
    if ((body.event === 'payment.captured' || body.event === 'order.paid') && entity?.id && entity.order_id) {
      await confirmOrder(entity.order_id, entity.id, entity.amount);
    }
    return { received: true };
  },

  async recordCash(actor: Actor, bookingId: string, amount: number, note?: string) {
    const booking = await loadBooking(bookingId);
    await assertMahalluAdmin(actor, booking.program.mahalluId);
    requireOpen(booking.program.status);
    const payment = await runSerializable(async tx => {
      const fresh = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: withProgram });
      if (amount > financeOf(fresh).remaining) throw new ApiError(409, 'OVERPAYMENT', 'That is more than the remaining balance.');
      return tx.programPayment.create({ data: { bookingId, amount, method: 'CASH', status: 'CONFIRMED', recordedById: actor.id,
        note: note ?? null, confirmedAt: new Date() } });
    });
    await db.auditEvent.create({ data: { userId: actor.id, action: 'payment.cash.recorded' } });
    return view(payment);
  },

  /** Cash recorded by mistake can be voided by an admin; online payments are never voided here. */
  async voidCash(actor: Actor, paymentId: string, note: string) {
    const payment = await db.programPayment.findUnique({ where: { id: paymentId }, include: { booking: { include: { program: true } } } });
    if (!payment) throw notFound('Payment');
    await assertMahalluAdmin(actor, payment.booking.program.mahalluId);
    if (payment.method !== 'CASH' || payment.status !== 'CONFIRMED') throw new ApiError(409, 'CANNOT_VOID', 'Only confirmed cash payments can be voided.');
    const changed = await db.programPayment.updateMany({ where: { id: paymentId, status: 'CONFIRMED' }, data: { status: 'REJECTED', note } });
    if (!changed.count) throw new ApiError(409, 'CANNOT_VOID', 'Only confirmed cash payments can be voided.');
    await db.auditEvent.create({ data: { userId: actor.id, action: 'payment.cash.voided' } });
    return { voided: true };
  },

  async setAutopay(actor: Actor, bookingId: string, enabled: boolean) {
    const booking = await loadBooking(bookingId);
    if (booking.household.userId !== actor.id) throw notFound('Booking');
    requireOpen(booking.program.status);
    await db.booking.update({ where: { id: bookingId }, data: { autopay: enabled } });
    return { autopay: enabled };
  },

  /** Every payment on the member's own bookings, newest first. */
  async history(userId: string) {
    const rows = await db.programPayment.findMany({ where: { booking: { household: { userId } } }, orderBy: { createdAt: 'desc' }, take: 200,
      include: { booking: { select: { animalType: true, program: { select: { name: true } } } } } });
    return rows.map(row => ({ ...view(row), programName: row.booking.program.name, animalType: row.booking.animalType }));
  },

  /** Admin view: totals and every transaction in the program. */
  async programPayments(actor: Actor, programId: string) {
    const program = await db.program.findUnique({ where: { id: programId } });
    if (!program) throw notFound('Program');
    await assertMahalluAdmin(actor, program.mahalluId);
    const bookings = await db.booking.findMany({ where: { programId }, include: withProgram });
    const finance = bookings.map(booking => financeOf(booking));
    const rows = await db.programPayment.findMany({ where: { booking: { programId } }, orderBy: { createdAt: 'desc' }, take: 300,
      include: { booking: { select: { animalType: true, household: { select: { mahalluNumber: true, ownerName: true } } } } } });
    const confirmed = rows.filter(row => row.status === 'CONFIRMED');
    const sum = (method: string) => confirmed.filter(row => row.method === method).reduce((acc, row) => acc + row.amount, 0);
    return {
      expected: finance.reduce((acc, item) => acc + item.total, 0), collected: finance.reduce((acc, item) => acc + item.paid, 0),
      outstanding: finance.reduce((acc, item) => acc + item.remaining, 0), cash: sum('CASH'), online: sum('ONLINE'),
      behind: finance.filter(item => item.standing === 'BEHIND').length, paidInFull: finance.filter(item => item.standing === 'PAID').length,
      rows: rows.map(row => ({ ...view(row), animalType: row.booking.animalType, household: row.booking.household })),
    };
  },

  /** Sends each household that is behind schedule one reminder per booking, channel and month. */
  async sendReminders(actor: Actor, programId: string, now = new Date()) {
    const program = await db.program.findUnique({ where: { id: programId } });
    if (!program) throw notFound('Program');
    await assertMahalluAdmin(actor, program.mahalluId);
    requireOpen(program.status);
    const bookings = await db.booking.findMany({ where: { programId, household: { userId: { not: null } } }, include: withProgram });
    const month = now.toISOString().slice(0, 7);
    const result = { behind: 0, sent: 0, skipped: 0, failed: 0 };
    for (const booking of bookings) {
      const money = financeOf(booking, now);
      if (!booking.household.userId || (money.standing !== 'BEHIND' && !(booking.autopay && money.remaining > 0))) continue;
      result.behind++;
      const message = `Your ${booking.program.name} payment: ₹${money.paid.toLocaleString('en-IN')} paid of ₹${money.total.toLocaleString('en-IN')}. ` +
        `Please pay ₹${money.suggested.toLocaleString('en-IN')} to stay on schedule.`;
      for (const channel of ['email', 'telegram'] as const) {
        try {
          const sent = await notificationService.send({ key: `pay.${booking.id}.${month}.${channel}`, userId: booking.household.userId, channel,
            type: 'payment.reminder', data: { subject: 'Udhiyya payment reminder', message } });
          if (sent.status === 'FAILED') result.failed++;
          else if (!sent.duplicate) result.sent++;
        } catch (error) {
          if (error instanceof ApiError && (error.code === 'OPT_IN_REQUIRED' || error.code === 'USER_NOT_FOUND')) result.skipped++;
          else throw error;
        }
      }
    }
    log('payments.reminders', result);
    return result;
  },
};
