// Pure helpers for installment schedules and meat splits. Amounts are whole rupees; weights are grams.

export function monthsBetween(from: Date, to: Date) {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return Math.max(0, to.getUTCDate() < from.getUTCDate() ? months - 1 : months);
}

/** Splits the total over the whole months left before the price-lock date; late joiners pay more per month. */
export function installmentPlan(now: Date, priceLockDate: Date, total: number) {
  const installments = Math.max(1, monthsBetween(now, priceLockDate));
  return { installments, monthlyAmount: Math.ceil(total / installments) };
}

/** How much should have been paid by `now` if the member is on schedule (the first instalment is due on enrolment). */
export function expectedPaid(enrolledAt: Date, now: Date, plan: { installments: number; monthlyAmount: number }, total: number) {
  const due = Math.min(plan.installments, 1 + monthsBetween(enrolledAt, now));
  return Math.min(total, due * plan.monthlyAmount);
}

export function paymentStanding(confirmed: number, total: number, expected: number) {
  if (confirmed >= total) return 'PAID' as const;
  return confirmed >= expected ? 'ON_TRACK' as const : 'BEHIND' as const;
}

export function animalsNeeded(shares: number, sharesPerAnimal: number) {
  return Math.ceil(shares / sharesPerAnimal);
}

export function meatSplit(cycle: { meatKgPerShare: number; familyPercent: number; relativesPercent: number; poorPercent: number },
  paidShares: number, beneficiaries: number) {
  const perShare = cycle.meatKgPerShare * 1000;
  const total = paidShares * perShare;
  const memberGramsPerShare = Math.floor(perShare * (cycle.familyPercent + cycle.relativesPercent) / 100);
  const poolGrams = Math.floor(total * cycle.poorPercent / 100);
  return { memberGramsPerShare, poolGrams,
    gramsPerBeneficiary: beneficiaries ? Math.floor(poolGrams / beneficiaries) : 0 };
}

export const tokenAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
