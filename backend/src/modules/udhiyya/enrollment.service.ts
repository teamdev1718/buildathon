import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { db } from '../../lib/db.js';
import { ApiError, log } from '../../lib/http.js';
import { notificationService } from '../notifications/notification.service.js';
import { cycleService, requireCycle } from './cycle.service.js';
import { expectedPaid, installmentPlan, paymentStanding } from './udhiyya.logic.js';
import type { enrollInput } from './udhiyya.schema.js';

type Tx = Prisma.TransactionClient;
const serializable = { isolationLevel: 'Serializable' as const };
const include = { payments: true, plan: true } as const;

const view = (e: Prisma.EnrollmentGetPayload<{ include: typeof include }>, now = new Date()) => {
  const confirmed = e.payments.filter(p => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0);
  const pending = e.payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);
  const expected = expectedPaid(e.createdAt, now, e, e.totalAmount);
  return {
    id: e.id, cycleId: e.cycleId, planName: e.plan.name, shares: e.shares, holderNames: e.holderNames,
    totalAmount: e.totalAmount, installments: e.installments, monthlyAmount: e.monthlyAmount, status: e.status,
    confirmed, pending, remaining: e.totalAmount - confirmed, expected,
    standing: paymentStanding(confirmed, e.totalAmount, expected), createdAt: e.createdAt,
    payments: e.payments.map(p => ({ id: p.id, amount: p.amount, method: p.method, status: p.status,
      reference: p.reference, createdAt: p.createdAt })).sort((a, b) => +b.createdAt - +a.createdAt),
  };
};

async function openEnrollment(tx: Tx, enrollmentId: string) {
  const enrollment = await tx.enrollment.findUnique({ where: { id: enrollmentId }, include: { cycle: true } });
  if (!enrollment || enrollment.status !== 'ACTIVE') throw new ApiError(404, 'NOT_FOUND', 'Enrollment not found.');
  if (!['ACTIVE', 'PROCUREMENT'].includes(enrollment.cycle.status)) {
    throw new ApiError(409, 'CYCLE_LOCKED', 'Payments are closed for this cycle.');
  }
  return enrollment;
}

async function room(tx: Tx, enrollmentId: string, total: number, countPending: boolean) {
  const sums = await tx.payment.groupBy({ by: ['status'], where: { enrollmentId, status: { in: ['CONFIRMED', 'PENDING'] } },
    _sum: { amount: true } });
  const sum = (status: string) => sums.find(s => s.status === status)?._sum.amount ?? 0;
  return total - sum('CONFIRMED') - (countPending ? sum('PENDING') : 0);
}

const overpayment = () => new ApiError(409, 'OVERPAYMENT', 'This is more than the remaining balance.');

export const enrollmentService = {
  async enroll(userId: string, input: z.output<typeof enrollInput>, now = new Date()) {
    const plan = await db.animalPlan.findUnique({ where: { id: input.planId }, include: { cycle: true } });
    if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found.');
    if (plan.cycle.status !== 'ACTIVE') throw new ApiError(409, 'ENROLMENT_CLOSED', 'Enrolment is closed for this cycle.');
    const totalAmount = plan.sharePrice * input.shares;
    const schedule = installmentPlan(now, plan.cycle.priceLockDate, totalAmount);
    try {
      const created = await db.enrollment.create({ data: { cycleId: plan.cycleId, userId, planId: plan.id,
        shares: input.shares, holderNames: input.holderNames, totalAmount, ...schedule }, include });
      return view(created, now);
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ApiError(409, 'ALREADY_ENROLLED', 'You are already enrolled in this plan.');
      }
      throw error;
    }
  },

  async mine(userId: string) {
    const rows = await db.enrollment.findMany({ where: { userId, status: 'ACTIVE' }, include, orderBy: { createdAt: 'desc' } });
    return rows.map(row => view(row));
  },

  /** Members report an online (UPI) transfer; it counts only once a collector confirms it. */
  submitOnline(userId: string, enrollmentId: string, input: { amount: number; reference: string }) {
    return db.$transaction(async tx => {
      const enrollment = await openEnrollment(tx, enrollmentId);
      if (enrollment.userId !== userId) throw new ApiError(404, 'NOT_FOUND', 'Enrollment not found.');
      if (input.amount > await room(tx, enrollmentId, enrollment.totalAmount, true)) throw overpayment();
      return tx.payment.create({ data: { enrollmentId, amount: input.amount, method: 'ONLINE', status: 'PENDING',
        reference: input.reference, recordedById: userId } });
    }, serializable);
  },

  async recordCash(collectorId: string, enrollmentId: string, amount: number) {
    const payment = await db.$transaction(async tx => {
      const enrollment = await openEnrollment(tx, enrollmentId);
      if (amount > await room(tx, enrollmentId, enrollment.totalAmount, false)) throw overpayment();
      return tx.payment.create({ data: { enrollmentId, amount, method: 'CASH', status: 'CONFIRMED',
        recordedById: collectorId, reviewedAt: new Date() } });
    }, serializable);
    await db.auditEvent.create({ data: { userId: collectorId, action: 'udhiyya.cash.recorded' } });
    return payment;
  },

  async review(reviewerId: string, paymentId: string, approve: boolean) {
    const payment = await db.$transaction(async tx => {
      const row = await tx.payment.findUnique({ where: { id: paymentId }, include: { enrollment: true } });
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Payment not found.');
      if (row.status !== 'PENDING') throw new ApiError(409, 'ALREADY_REVIEWED', 'This payment was already reviewed.');
      if (approve && row.amount > await room(tx, row.enrollmentId, row.enrollment.totalAmount, false)) throw overpayment();
      return tx.payment.update({ where: { id: paymentId },
        data: { status: approve ? 'CONFIRMED' : 'REJECTED', reviewedAt: new Date() } });
    }, serializable);
    await db.auditEvent.create({ data: { userId: reviewerId,
      action: approve ? 'udhiyya.payment.confirmed' : 'udhiyya.payment.rejected' } });
    return payment;
  },

  pending: () => db.payment.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 100,
    select: { id: true, amount: true, reference: true, createdAt: true,
      enrollment: { select: { id: true, plan: { select: { name: true } },
        user: { select: { name: true, email: true } } } } } }),

  async search(query: string) {
    const cycle = await cycleService.current();
    if (!cycle) return [];
    const match = query ? { user: { OR: [{ name: { contains: query, mode: 'insensitive' as const } },
      { email: { contains: query, mode: 'insensitive' as const } }] } } : {};
    const rows = await db.enrollment.findMany({ where: { cycleId: cycle.id, status: 'ACTIVE', ...match },
      include: { ...include, user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' }, take: 25 });
    return rows.map(row => ({ ...view(row), member: row.user }));
  },

  /** Nudges members who are behind schedule; one notification per enrollment, channel and month. */
  async sendReminders(cycleId: string, now = new Date()) {
    await requireCycle(cycleId);
    const rows = await db.enrollment.findMany({ where: { cycleId, status: 'ACTIVE' },
      include: { ...include, user: true } });
    const month = now.toISOString().slice(0, 7);
    const result = { behind: 0, sent: 0, skipped: 0, failed: 0 };
    for (const row of rows) {
      const state = view(row, now);
      if (state.standing !== 'BEHIND' || !row.user.verifiedAt) continue;
      result.behind++;
      const message = `Your Udhiyya installment is due. Paid ₹${state.confirmed} of ₹${state.totalAmount}; ` +
        `the monthly amount is ₹${state.monthlyAmount}.`;
      for (const channel of ['email', 'telegram'] as const) {
        try {
          const sent = await notificationService.send({ key: `udhiyya.${row.id}.${month}.${channel}`,
            userId: row.userId, channel, type: 'udhiyya.reminder',
            data: { subject: 'Udhiyya installment reminder', message } });
          if (sent.status === 'FAILED') result.failed++;
          else if (!sent.duplicate) result.sent++;
        } catch (error) {
          if (error instanceof ApiError && error.code === 'OPT_IN_REQUIRED') result.skipped++;
          else throw error;
        }
      }
    }
    log('udhiyya.reminders', result);
    return result;
  },
};
