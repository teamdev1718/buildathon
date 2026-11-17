import { expectedPaid, installmentPlan } from '../udhiyya/udhiyya.logic.js';

const day = 24 * 60 * 60 * 1000;

/** When members are asked to have paid in full if the admin did not choose a date: a week before Udhiyya. */
export const defaultPayBy = (targetDate: Date) => new Date(targetDate.getTime() - 7 * day);

export type Standing = 'PAID' | 'ON_TRACK' | 'BEHIND';

export function addMonths(from: Date, months: number) {
  const result = new Date(from.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * The payment schedule for one booking. The total follows the live price, so the monthly amount is spread over the months
 * between booking and the pay-by date. A one-time booking simply owes everything by the pay-by date.
 */
export function schedule(input: { payMode: 'ONE_TIME' | 'INSTALLMENTS'; bookedAt: Date; payBy: Date; total: number; paid: number; now: Date }) {
  const { payMode, bookedAt, payBy, total, paid, now } = input;
  const remaining = Math.max(0, total - paid);
  const plan = payMode === 'ONE_TIME' ? { installments: 1, monthlyAmount: total } : installmentPlan(bookedAt, payBy, total);
  const expected = payMode === 'ONE_TIME' ? (now >= payBy ? total : 0) : expectedPaid(bookedAt, now, plan, total);
  const standing: Standing = paid >= total ? 'PAID' : paid < expected ? 'BEHIND' : 'ON_TRACK';
  const due = Math.max(0, expected - paid);
  const covered = plan.monthlyAmount > 0 ? Math.floor(paid / plan.monthlyAmount) : plan.installments;
  const nextDue = remaining === 0 ? null : payMode === 'ONE_TIME' ? payBy
    : new Date(Math.min(addMonths(bookedAt, covered).getTime(), payBy.getTime()));
  const suggested = remaining === 0 ? 0 : Math.min(remaining, due > 0 ? due : plan.monthlyAmount);
  return { installments: plan.installments, monthlyAmount: plan.monthlyAmount, expected, due, standing, nextDue, suggested, remaining };
}

export const toPaise = (rupees: number) => rupees * 100;

type FinanceInput = {
  shares: number; animalType: string; payMode: 'ONE_TIME' | 'INSTALLMENTS'; createdAt: Date;
  program: { payByDate: Date | null; targetDate: Date; animals: { animalType: string; price: number; sharesPerAnimal: number }[] };
  payments: { amount: number; status: string }[];
};

/** Everything a member or admin needs to see about one booking's money, always computed from the live price. */
export function financeOf(booking: FinanceInput, now = new Date()) {
  const animal = booking.program.animals.find(item => item.animalType === booking.animalType);
  const total = animal ? booking.shares * Math.ceil(animal.price / animal.sharesPerAnimal) : 0;
  const sum = (status: string) => booking.payments.filter(item => item.status === status).reduce((acc, item) => acc + item.amount, 0);
  const paid = sum('CONFIRMED');
  const payBy = booking.program.payByDate ?? defaultPayBy(booking.program.targetDate);
  return { total, paid, pending: sum('PENDING'), credit: Math.max(0, paid - total), payBy,
    ...schedule({ payMode: booking.payMode, bookedAt: booking.createdAt, payBy, total, paid, now }) };
}
