import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { requireCycle } from './cycle.service.js';
import { meatSplit, tokenAlphabet } from './udhiyya.logic.js';
import type { beneficiaryInput } from './udhiyya.schema.js';

const newCode = () => Array.from({ length: 10 }, () => tokenAlphabet[randomInt(tokenAlphabet.length)]).join('');

export const distributionService = {
  beneficiaries: () => db.beneficiary.findMany({ where: { active: true }, orderBy: [{ area: 'asc' }, { name: 'asc' }] }),

  addBeneficiary: (input: z.output<typeof beneficiaryInput>) => db.beneficiary.create({ data: input }),

  async removeBeneficiary(beneficiaryId: string) {
    const changed = await db.beneficiary.updateMany({ where: { id: beneficiaryId, active: true }, data: { active: false } });
    if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Beneficiary not found.');
    return { removed: true };
  },

  /** Creates missing tokens only, so it is safe to run again after late payments or new beneficiaries. */
  async generateTokens(cycleId: string) {
    const cycle = await requireCycle(cycleId);
    if (!['PROCUREMENT', 'DISTRIBUTION'].includes(cycle.status)) {
      throw new ApiError(409, 'CYCLE_NOT_READY', 'Move the cycle to procurement before creating tokens.');
    }
    const [enrollments, beneficiaries] = await Promise.all([
      db.enrollment.findMany({ where: { cycleId, status: 'ACTIVE' },
        include: { payments: { where: { status: 'CONFIRMED' }, select: { amount: true } } } }),
      db.beneficiary.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const sharesByUser = new Map<string, number>();
    for (const e of enrollments) {
      if (e.payments.reduce((sum, p) => sum + p.amount, 0) >= e.totalAmount) {
        sharesByUser.set(e.userId, (sharesByUser.get(e.userId) ?? 0) + e.shares);
      }
    }
    const paidShares = [...sharesByUser.values()].reduce((a, b) => a + b, 0);
    const split = meatSplit(cycle, paidShares, beneficiaries.length);
    let turn = 0;
    const slot = () => cycle.slots.length ? cycle.slots[turn++ % cycle.slots.length] : null;
    const members = [...sharesByUser].map(([userId, shares]) => ({ cycleId, kind: 'MEMBER' as const, userId,
      code: newCode(), slot: slot(), grams: shares * split.memberGramsPerShare, delivery: false }));
    const poor = beneficiaries.map(b => ({ cycleId, kind: 'BENEFICIARY' as const, beneficiaryId: b.id, code: newCode(),
      slot: b.needsDelivery ? null : slot(), grams: split.gramsPerBeneficiary, delivery: b.needsDelivery }));
    const [m, b] = await Promise.all([
      db.meatToken.createMany({ data: members, skipDuplicates: true }),
      db.meatToken.createMany({ data: poor, skipDuplicates: true }),
    ]);
    return { createdMembers: m.count, createdBeneficiaries: b.count, ...split, paidShares };
  },

  async tokens(cycleId: string) {
    await requireCycle(cycleId);
    const rows = await db.meatToken.findMany({ where: { cycleId }, orderBy: [{ kind: 'asc' }, { slot: 'asc' }],
      include: { user: { select: { name: true } }, beneficiary: { select: { name: true, area: true, address: true, phone: true } } } });
    return rows.map(t => ({ id: t.id, kind: t.kind, code: t.code, slot: t.slot, grams: t.grams, delivery: t.delivery,
      status: t.status, collectedAt: t.collectedAt, name: t.user?.name ?? t.beneficiary?.name ?? '',
      area: t.beneficiary?.area ?? null, address: t.beneficiary?.address ?? null, phone: t.beneficiary?.phone ?? null }));
  },

  async progress(cycleId: string) {
    await requireCycle(cycleId);
    const rows = await db.meatToken.groupBy({ by: ['kind', 'status'], where: { cycleId }, _count: true, _sum: { grams: true } });
    const pick = (kind: string, status: string) => rows.find(r => r.kind === kind && r.status === status);
    const line = (kind: string) => ({ collected: pick(kind, 'COLLECTED')?._count ?? 0, pending: pick(kind, 'PENDING')?._count ?? 0,
      gramsCollected: pick(kind, 'COLLECTED')?._sum.grams ?? 0, gramsPending: pick(kind, 'PENDING')?._sum.grams ?? 0 });
    return { members: line('MEMBER'), beneficiaries: line('BENEFICIARY') };
  },

  async mine(userId: string) {
    const rows = await db.meatToken.findMany({ where: { userId }, orderBy: { cycle: { createdAt: 'desc' } }, take: 5,
      select: { code: true, slot: true, grams: true, status: true, collectedAt: true, cycle: { select: { name: true, status: true } } } });
    return rows;
  },

  async collect(collectorId: string, code: string) {
    const token = await db.meatToken.findUnique({ where: { code }, include: { cycle: true,
      user: { select: { name: true } }, beneficiary: { select: { name: true } } } });
    if (!token) throw new ApiError(404, 'NOT_FOUND', 'Unknown token.');
    if (token.cycle.status !== 'DISTRIBUTION') throw new ApiError(409, 'CYCLE_NOT_READY', 'Distribution has not started.');
    const changed = await db.meatToken.updateMany({ where: { id: token.id, status: 'PENDING' },
      data: { status: 'COLLECTED', collectedAt: new Date(), collectedById: collectorId } });
    if (!changed.count) throw new ApiError(409, 'ALREADY_COLLECTED', 'This token was already collected.');
    return { name: token.user?.name ?? token.beneficiary?.name ?? '', kind: token.kind, grams: token.grams, delivery: token.delivery };
  },
};
