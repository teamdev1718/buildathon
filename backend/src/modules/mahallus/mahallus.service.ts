import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { householdInput, householdUpdate, normalizePhone, type adminInput, type linkInput, type mahalluInput,
  type mahalluUpdate } from './mahallus.schema.js';

type Actor = { id: string; permissions: string[] };
const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', what + ' not found.');
const isUnique = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

/** Super admins may act in any mahallu; mahallu admins only in the mahallu they were assigned to. */
export async function assertMahalluAdmin(actor: Actor, mahalluId: string) {
  if (actor.permissions.includes('mahallu.manage')) return;
  const staff = await db.mahalluStaff.findUnique({ where: { userId_mahalluId_role: {
    userId: actor.id, mahalluId, role: 'MAHALLU_ADMIN' } } });
  if (!staff) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
}

const clean = <T extends { phone?: string }>(row: T) => (row.phone === undefined ? row : { ...row, phone: normalizePhone(row.phone) });

export const mahalluService = {
  async list() {
    const rows = await db.mahallu.findMany({ orderBy: { name: 'asc' },
      include: { _count: { select: { households: true } },
        staff: { where: { role: 'MAHALLU_ADMIN' }, select: { user: { select: { name: true, email: true } } } } } });
    return rows.map(({ staff, _count, ...row }) => ({ ...row, households: _count.households,
      admins: staff.map(item => item.user) }));
  },

  directory: () => db.mahallu.findMany({ where: { active: true }, orderBy: { name: 'asc' },
    select: { id: true, name: true, district: true } }),

  async create(input: z.output<typeof mahalluInput>) {
    try { return await db.mahallu.create({ data: input }); }
    catch (error) {
      if (isUnique(error)) throw new ApiError(409, 'CODE_TAKEN', 'That mahallu code is already used.');
      throw error;
    }
  },

  async update(mahalluId: string, input: z.output<typeof mahalluUpdate>) {
    const changed = await db.mahallu.updateMany({ where: { id: mahalluId }, data: input });
    if (!changed.count) throw notFound('Mahallu');
    return db.mahallu.findUniqueOrThrow({ where: { id: mahalluId } });
  },

  async setAdmin(mahalluId: string, input: z.output<typeof adminInput>) {
    if (!await db.mahallu.findUnique({ where: { id: mahalluId } })) throw notFound('Mahallu');
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user?.verifiedAt) throw new ApiError(404, 'USER_NOT_FOUND', 'No verified account has that email.');
    const key = { userId: user.id, mahalluId, role: 'MAHALLU_ADMIN' as const };
    if (input.enabled) await db.mahalluStaff.upsert({ where: { userId_mahalluId_role: key }, create: key, update: {} });
    else await db.mahalluStaff.deleteMany({ where: key });
    return { email: user.email, name: user.name, admin: input.enabled };
  },

  async households(mahalluId: string, query: string) {
    const phoneDigits = query.replace(/\D/g, '');
    const where: Prisma.HouseholdWhereInput = { mahalluId, ...(query ? { OR: [
      { ownerName: { contains: query, mode: 'insensitive' } }, { mahalluNumber: { contains: query, mode: 'insensitive' } },
      ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : [])] } : {}) };
    const [rows, total, linked] = await Promise.all([
      db.household.findMany({ where, orderBy: { mahalluNumber: 'asc' }, take: 200 }),
      db.household.count({ where: { mahalluId } }),
      db.household.count({ where: { mahalluId, userId: { not: null } } }),
    ]);
    const members = await db.household.aggregate({ where: { mahalluId }, _sum: { memberCount: true } });
    return { total, linked, people: members._sum.memberCount ?? 0,
      rows: rows.map(({ userId, ...row }) => ({ ...row, linked: userId !== null })) };
  },

  async addHousehold(mahalluId: string, input: z.output<typeof householdInput>) {
    try { return await db.household.create({ data: { ...clean(input), mahalluId } }); }
    catch (error) {
      if (isUnique(error)) throw new ApiError(409, 'NUMBER_TAKEN', 'That mahallu number already exists.');
      throw error;
    }
  },

  async householdMahallu(householdId: string) {
    const row = await db.household.findUnique({ where: { id: householdId }, select: { mahalluId: true } });
    if (!row) throw notFound('Household');
    return row.mahalluId;
  },

  async updateHousehold(householdId: string, input: z.output<typeof householdUpdate>) {
    try { return await db.household.update({ where: { id: householdId }, data: clean(input) }); }
    catch (error) {
      if (isUnique(error)) throw new ApiError(409, 'NUMBER_TAKEN', 'That mahallu number already exists.');
      throw error;
    }
  },

  async removeHousehold(householdId: string) {
    await db.household.delete({ where: { id: householdId } });
    return { removed: true };
  },

  /** Valid rows are saved (new numbers created, existing numbers updated); invalid rows are reported by row number. */
  async importHouseholds(mahalluId: string, rows: unknown[]) {
    const errors: { row: number; message: string }[] = [];
    const valid = new Map<string, z.output<typeof householdInput>>();
    rows.forEach((raw, index) => {
      const parsed = householdInput.safeParse(raw);
      if (!parsed.success) {
        errors.push({ row: index + 1, message: parsed.error.issues.map(issue => issue.message).join(' ') });
      } else if (valid.has(parsed.data.mahalluNumber)) {
        errors.push({ row: index + 1, message: 'Duplicate mahallu number in this file.' });
      } else valid.set(parsed.data.mahalluNumber, parsed.data);
    });
    const existing = new Set((await db.household.findMany({ where: { mahalluId,
      mahalluNumber: { in: [...valid.keys()] } }, select: { mahalluNumber: true } })).map(row => row.mahalluNumber));
    await db.$transaction([...valid.values()].map(row => db.household.upsert({
      where: { mahalluId_mahalluNumber: { mahalluId, mahalluNumber: row.mahalluNumber } },
      create: { ...clean(row), mahalluId }, update: clean(row) })));
    return { created: valid.size - existing.size, updated: existing.size, errors };
  },

  async context(userId: string) {
    const [staff, households] = await Promise.all([
      db.mahalluStaff.findMany({ where: { userId }, select: { role: true, mahallu: { select: { id: true, name: true } } } }),
      db.household.findMany({ where: { userId }, select: { id: true, mahalluNumber: true, ownerName: true, memberCount: true,
        mahallu: { select: { id: true, name: true } } } }),
    ]);
    return {
      staff: staff.map(item => ({ role: item.role, mahalluId: item.mahallu.id, mahalluName: item.mahallu.name })),
      households: households.map(({ mahallu, ...row }) => ({ ...row, mahalluId: mahallu.id, mahalluName: mahallu.name })),
    };
  },

  /** Both the number and the phone must match, and the answer never says which one was wrong. */
  async link(userId: string, input: z.output<typeof linkInput>) {
    const denied = new ApiError(404, 'NO_MATCH', 'We could not find a household with those details. Check with your mahallu office.');
    const household = await db.household.findUnique({ where: { mahalluId_mahalluNumber: {
      mahalluId: input.mahalluId, mahalluNumber: input.mahalluNumber } }, include: { mahallu: true } });
    if (!household || !household.mahallu.active || household.phone !== normalizePhone(input.phone)) throw denied;
    if (household.userId && household.userId !== userId) throw denied;
    try {
      await db.household.update({ where: { id: household.id }, data: { userId } });
    } catch (error) {
      if (isUnique(error)) throw new ApiError(409, 'ALREADY_LINKED', 'You are already linked to this mahallu.');
      throw error;
    }
    return mahalluService.context(userId);
  },
};
