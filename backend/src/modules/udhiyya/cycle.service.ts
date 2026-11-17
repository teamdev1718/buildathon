import type { z } from 'zod';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { animalsNeeded, expectedPaid, paymentStanding } from './udhiyya.logic.js';
import type { animalInput, cycleInput, planInput } from './udhiyya.schema.js';

const order = ['ACTIVE', 'PROCUREMENT', 'DISTRIBUTION', 'CLOSED'] as const;
const withPlans = { plans: { orderBy: { sharePrice: 'asc' as const } } };

export async function requireCycle(cycleId: string) {
  const cycle = await db.udhiyyaCycle.findUnique({ where: { id: cycleId }, include: withPlans });
  if (!cycle) throw new ApiError(404, 'NOT_FOUND', 'Cycle not found.');
  return cycle;
}

export const cycleService = {
  /** The mahal runs one open cycle at a time; closed cycles stay as history. */
  current: () => db.udhiyyaCycle.findFirst({ where: { status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' }, include: withPlans }),

  list: () => db.udhiyyaCycle.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: withPlans }),

  async create(input: z.output<typeof cycleInput>) {
    if (await db.udhiyyaCycle.findFirst({ where: { status: { not: 'CLOSED' } } })) {
      throw new ApiError(409, 'CYCLE_OPEN', 'Close the current cycle before starting a new one.');
    }
    return db.udhiyyaCycle.create({ data: input, include: withPlans });
  },

  async addPlan(cycleId: string, input: z.output<typeof planInput>) {
    const cycle = await requireCycle(cycleId);
    if (cycle.status !== 'ACTIVE') throw new ApiError(409, 'CYCLE_LOCKED', 'Plans can only change while the cycle is active.');
    return db.animalPlan.create({ data: { ...input, cycleId } });
  },

  async advance(cycleId: string, status: (typeof order)[number]) {
    const cycle = await requireCycle(cycleId);
    if (order.indexOf(status) !== order.indexOf(cycle.status) + 1) {
      throw new ApiError(409, 'INVALID_TRANSITION', 'A cycle moves forward one stage at a time.');
    }
    const changed = await db.udhiyyaCycle.updateMany({ where: { id: cycleId, status: cycle.status }, data: { status } });
    if (!changed.count) throw new ApiError(409, 'INVALID_TRANSITION', 'The cycle changed. Reload and try again.');
    return requireCycle(cycleId);
  },

  async addAnimal(cycleId: string, input: z.output<typeof animalInput>) {
    const cycle = await requireCycle(cycleId);
    if (cycle.status === 'CLOSED') throw new ApiError(409, 'CYCLE_LOCKED', 'The cycle is closed.');
    return db.animal.create({ data: { ...input, cycleId } });
  },

  async animals(cycleId: string) {
    await requireCycle(cycleId);
    return db.animal.findMany({ where: { cycleId }, orderBy: { createdAt: 'asc' } });
  },

  async summary(cycleId: string, now = new Date()) {
    const cycle = await requireCycle(cycleId);
    const [enrollments, animals, pending] = await Promise.all([
      db.enrollment.findMany({ where: { cycleId, status: 'ACTIVE' },
        include: { payments: { where: { status: 'CONFIRMED' }, select: { amount: true } } } }),
      db.animal.groupBy({ by: ['animalType'], where: { cycleId }, _count: true }),
      db.payment.aggregate({ _sum: { amount: true }, _count: true,
        where: { status: 'PENDING', enrollment: { cycleId, status: 'ACTIVE' } } }),
    ]);
    let expected = 0, collected = 0, paidFamilies = 0, behind = 0;
    const sharesByPlan = new Map<string, number>();
    for (const e of enrollments) {
      const paid = e.payments.reduce((sum, p) => sum + p.amount, 0);
      expected += e.totalAmount;
      collected += paid;
      sharesByPlan.set(e.planId, (sharesByPlan.get(e.planId) ?? 0) + e.shares);
      const standing = paymentStanding(paid, e.totalAmount, expectedPaid(e.createdAt, now, e, e.totalAmount));
      if (standing === 'PAID') paidFamilies++;
      if (standing === 'BEHIND') behind++;
    }
    const recorded = new Map(animals.map(a => [a.animalType, a._count]));
    return {
      cycle, enrollments: enrollments.length, paidFamilies, behind, expected, collected,
      pendingAmount: pending._sum.amount ?? 0, pendingPayments: pending._count,
      plans: cycle.plans.map(plan => {
        const shares = sharesByPlan.get(plan.id) ?? 0;
        return { id: plan.id, name: plan.name, shares, animalsNeeded: animalsNeeded(shares, plan.sharesPerAnimal),
          animalsRecorded: recorded.get(plan.animalType) ?? 0 };
      }),
    };
  },
};
