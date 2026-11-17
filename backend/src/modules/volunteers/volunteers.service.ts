import argon2 from 'argon2';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { db, runSerializable } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { secret } from '../../lib/secrets.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';
import { createSession } from '../auth/session.service.js';
import { trackingService } from '../tracking/tracking.service.js';
import { generatePassword, generateUsername, isNextStatus, volunteerEmail, type Status } from './volunteers.logic.js';
import type { volunteerInput, volunteerLogin, volunteerUpdate } from './volunteers.schema.js';

type Actor = { id: string; permissions: string[] };
const hash = (password: string) => argon2.hash(password, { type: argon2.argon2id });
const dummyHash = hash(secret());
const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', what + ' not found.');
const isUnique = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
const invalid = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.');

async function adminVolunteer(actor: Actor, volunteerId: string) {
  const volunteer = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer) throw notFound('Volunteer');
  await assertMahalluAdmin(actor, volunteer.mahalluId);
  return volunteer;
}

async function openProgramOf(mahalluId: string) {
  const program = await db.program.findFirst({ where: { mahalluId, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
  if (!program) throw new ApiError(409, 'NO_PROGRAM', 'There is no running program right now.');
  return program;
}

/** The signed-in volunteer, only while their access has not been terminated, with the capability they are using. */
async function activeVolunteer(userId: string, capability: 'canStatus' | 'canDistribute') {
  const volunteer = await db.volunteer.findUnique({ where: { userId }, include: { mahallu: { select: { name: true } } } });
  if (!volunteer || volunteer.terminatedAt || !volunteer[capability]) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
  return volunteer;
}

const profile = (row: { id: string; name: string; phone: string | null; canStatus: boolean; canDistribute: boolean; terminatedAt: Date | null; createdAt: Date }) => ({
  id: row.id, name: row.name, phone: row.phone, canStatus: row.canStatus, canDistribute: row.canDistribute,
  terminatedAt: row.terminatedAt, createdAt: row.createdAt,
});

async function stockOf(tx: Prisma.TransactionClient, volunteerId: string, programId: string) {
  const [issued, handed] = await Promise.all([
    tx.meatIssue.aggregate({ _sum: { packets: true }, where: { volunteerId, programId } }),
    tx.distribution.aggregate({ _sum: { packets: true }, where: { volunteerId, programId } }),
  ]);
  const given = issued._sum.packets ?? 0;
  const distributed = handed._sum.packets ?? 0;
  return { issued: given, distributed, inHand: given - distributed };
}

export const volunteerService = {
  /** Signs a volunteer in with the generated username and password. Terminated accounts fail like wrong passwords. */
  async login(input: z.output<typeof volunteerLogin>) {
    const user = await db.user.findUnique({ where: { username: input.username }, include: { volunteer: true } });
    const valid = await argon2.verify(user?.passwordHash ?? await dummyHash, input.password);
    if (!user?.passwordHash || !valid || !user.verifiedAt || !user.volunteer || user.volunteer.terminatedAt) throw invalid();
    return createSession(user.id);
  },

  async create(actor: Actor, mahalluId: string, input: z.output<typeof volunteerInput>) {
    await assertMahalluAdmin(actor, mahalluId);
    const mahallu = await db.mahallu.findUnique({ where: { id: mahalluId } });
    if (!mahallu) throw notFound('Mahallu');
    const password = generatePassword();
    const passwordHash = await hash(password);
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = generateUsername(mahallu.code, input.name);
      try {
        const user = await db.user.create({ data: { email: volunteerEmail(username), name: input.name, username, passwordHash,
          verifiedAt: new Date(), volunteer: { create: { mahalluId, name: input.name, phone: input.phone ?? null,
            canStatus: input.canStatus, canDistribute: input.canDistribute, createdById: actor.id } } },
        include: { volunteer: true } });
        await db.auditEvent.create({ data: { userId: actor.id, action: 'volunteer.created' } });
        return { volunteer: profile(user.volunteer!), username, password };
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
    }
    throw new ApiError(409, 'USERNAME_TAKEN', 'Could not make a unique username. Try again.');
  },

  async list(actor: Actor, mahalluId: string) {
    await assertMahalluAdmin(actor, mahalluId);
    const program = await db.program.findFirst({ where: { mahalluId, status: 'OPEN' }, select: { id: true } });
    const rows = await db.volunteer.findMany({ where: { mahalluId }, orderBy: [{ terminatedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      include: { user: { select: { username: true } } } });
    return Promise.all(rows.map(async row => ({ ...profile(row), username: row.user.username,
      stock: program ? await stockOf(db, row.id, program.id) : null })));
  },

  async update(actor: Actor, volunteerId: string, input: z.output<typeof volunteerUpdate>) {
    const volunteer = await adminVolunteer(actor, volunteerId);
    if (volunteer.terminatedAt) throw new ApiError(409, 'TERMINATED', 'This volunteer has been terminated.');
    const next = { canStatus: input.canStatus ?? volunteer.canStatus, canDistribute: input.canDistribute ?? volunteer.canDistribute };
    if (!next.canStatus && !next.canDistribute) throw new ApiError(400, 'INVALID_INPUT', 'Keep at least one role, or terminate the volunteer.');
    const updated = await db.volunteer.update({ where: { id: volunteerId }, data: input });
    if (input.name) await db.user.update({ where: { id: volunteer.userId }, data: { name: input.name } });
    return profile(updated);
  },

  async resetPassword(actor: Actor, volunteerId: string) {
    const volunteer = await adminVolunteer(actor, volunteerId);
    if (volunteer.terminatedAt) throw new ApiError(409, 'TERMINATED', 'This volunteer has been terminated.');
    const password = generatePassword();
    const passwordHash = await hash(password);
    await db.$transaction([
      db.user.update({ where: { id: volunteer.userId }, data: { passwordHash } }),
      db.refreshSession.updateMany({ where: { userId: volunteer.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    const user = await db.user.findUniqueOrThrow({ where: { id: volunteer.userId }, select: { username: true } });
    return { username: user.username, password };
  },

  /** Ends access at once: password removed, sessions revoked, and the account can no longer authenticate. History stays. */
  async terminate(actor: Actor, volunteerId: string) {
    const volunteer = await adminVolunteer(actor, volunteerId);
    if (volunteer.terminatedAt) throw new ApiError(409, 'TERMINATED', 'This volunteer was already terminated.');
    await db.$transaction([
      db.volunteer.update({ where: { id: volunteerId }, data: { terminatedAt: new Date() } }),
      db.user.update({ where: { id: volunteer.userId }, data: { passwordHash: null, verifiedAt: null } }),
      db.refreshSession.updateMany({ where: { userId: volunteer.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.auditEvent.create({ data: { userId: actor.id, action: 'volunteer.terminated' } }),
    ]);
    return { terminated: true };
  },

  async issue(actor: Actor, volunteerId: string, packets: number, note?: string) {
    const volunteer = await adminVolunteer(actor, volunteerId);
    if (volunteer.terminatedAt || !volunteer.canDistribute) throw new ApiError(409, 'NOT_DISTRIBUTOR', 'This volunteer is not an active distributor.');
    const program = await openProgramOf(volunteer.mahalluId);
    await db.meatIssue.create({ data: { volunteerId, programId: program.id, packets, note: note ?? null, createdById: actor.id } });
    return stockOf(db, volunteerId, program.id);
  },

  async overview(actor: Actor, programId: string) {
    const program = await db.program.findUnique({ where: { id: programId } });
    if (!program) throw notFound('Program');
    await assertMahalluAdmin(actor, program.mahalluId);
    const [volunteers, rows, households] = await Promise.all([
      db.volunteer.findMany({ where: { mahalluId: program.mahalluId, canDistribute: true }, orderBy: { createdAt: 'asc' } }),
      db.distribution.findMany({ where: { programId }, orderBy: { createdAt: 'desc' }, take: 300,
        include: { volunteer: { select: { name: true } }, household: { select: { mahalluNumber: true, ownerName: true } } } }),
      db.household.count({ where: { mahalluId: program.mahalluId } }),
    ]);
    const perVolunteer = await Promise.all(volunteers.map(async item => ({ id: item.id, name: item.name, terminated: item.terminatedAt !== null,
      ...await stockOf(db, item.id, programId) })));
    return {
      issued: perVolunteer.reduce((sum, item) => sum + item.issued, 0), distributed: perVolunteer.reduce((sum, item) => sum + item.distributed, 0),
      inHand: perVolunteer.reduce((sum, item) => sum + item.inHand, 0), householdsServed: new Set(rows.map(row => row.householdId)).size, households,
      volunteers: perVolunteer,
      rows: rows.map(row => ({ id: row.id, packets: row.packets, createdAt: row.createdAt, receivedAt: row.receivedAt, volunteer: row.volunteer.name, household: row.household })),
    };
  },

  async voidDistribution(actor: Actor, distributionId: string) {
    const row = await db.distribution.findUnique({ where: { id: distributionId }, include: { program: true } });
    if (!row) throw notFound('Distribution');
    await assertMahalluAdmin(actor, row.program.mahalluId);
    await db.distribution.delete({ where: { id: distributionId } });
    await db.auditEvent.create({ data: { userId: actor.id, action: 'distribution.voided' } });
    return { voided: true };
  },

  /** Admin correction: any status, either direction. */
  async setStatus(actor: Actor, animalId: string, to: Status) {
    const animal = await db.slaughterAnimal.findUnique({ where: { id: animalId }, include: { program: true } });
    if (!animal) throw notFound('Animal');
    await assertMahalluAdmin(actor, animal.program.mahalluId);
    const result = await volunteerService.writeStatus(animalId, to, actor.id);
    await trackingService.onStatusChange(animalId, to);
    return result;
  },

  writeStatus(animalId: string, to: Status, byId: string) {
    const now = new Date();
    const stamps = { SLAUGHTERED: { slaughteredAt: now }, PROCESSING: { processingAt: now }, PACKED: { packedAt: now } } as const;
    const reset = to === 'PENDING' ? { slaughteredAt: null, processingAt: null, packedAt: null }
      : to === 'SLAUGHTERED' ? { processingAt: null, packedAt: null } : to === 'PROCESSING' ? { packedAt: null } : {};
    return db.slaughterAnimal.update({ where: { id: animalId }, data: { status: to, statusById: byId, ...reset, ...(to === 'PENDING' ? {} : stamps[to]) },
      select: { id: true, code: true, status: true } });
  },

  // ----- What a signed-in volunteer does -----

  async me(userId: string) {
    const volunteer = await db.volunteer.findUnique({ where: { userId }, include: { mahallu: { select: { name: true } } } });
    if (!volunteer || volunteer.terminatedAt) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    const program = await db.program.findFirst({ where: { mahalluId: volunteer.mahalluId, status: 'OPEN' }, select: { id: true, name: true } });
    return { ...profile(volunteer), mahalluId: volunteer.mahalluId, mahalluName: volunteer.mahallu.name, program };
  },

  /** Everything the volunteer dashboard shows, in one request, whichever role the volunteer has. */
  async dashboard(userId: string) {
    const volunteer = await db.volunteer.findUnique({ where: { userId }, include: { mahallu: { select: { name: true } } } });
    if (!volunteer || volunteer.terminatedAt) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    const program = await db.program.findFirst({ where: { mahalluId: volunteer.mahalluId, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true } });
    const base = { volunteer: { name: volunteer.name, mahalluName: volunteer.mahallu.name, canStatus: volunteer.canStatus, canDistribute: volunteer.canDistribute }, program };
    if (!program) return { ...base, animals: { total: 0, pending: 0, slaughtered: 0, processing: 0, packed: 0 }, meat: { issued: 0, distributed: 0, inHand: 0, programDistributed: 0 } };
    const [groups, mine, all] = await Promise.all([
      db.slaughterAnimal.groupBy({ by: ['status'], where: { programId: program.id }, _count: true }),
      stockOf(db, volunteer.id, program.id),
      db.distribution.aggregate({ _sum: { packets: true }, where: { programId: program.id } }),
    ]);
    const count = (status: string) => groups.find(row => row.status === status)?._count ?? 0;
    return { ...base,
      animals: { total: groups.reduce((sum, row) => sum + row._count, 0), pending: count('PENDING'), slaughtered: count('SLAUGHTERED'), processing: count('PROCESSING'), packed: count('PACKED') },
      meat: { ...mine, programDistributed: all._sum.packets ?? 0 } };
  },

  /** The volunteer's own recent work: animals they moved along and meat they handed over. */
  async activity(userId: string) {
    const volunteer = await db.volunteer.findUnique({ where: { userId } });
    if (!volunteer || volunteer.terminatedAt) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    const [animals, handovers] = await Promise.all([
      db.slaughterAnimal.findMany({ where: { statusById: userId, status: { not: 'PENDING' } }, take: 60, orderBy: { createdAt: 'desc' } }),
      db.distribution.findMany({ where: { volunteerId: volunteer.id }, orderBy: { createdAt: 'desc' }, take: 60,
        include: { household: { select: { mahalluNumber: true, ownerName: true } } } }),
    ]);
    const entries = [
      ...animals.map(row => ({ id: row.id, type: 'ANIMAL' as const, title: `${row.code} marked ${row.status.toLowerCase()}`, detail: row.animalType.toLowerCase(),
        at: row.packedAt ?? row.processingAt ?? row.slaughteredAt ?? row.createdAt })),
      ...handovers.map(row => ({ id: row.id, type: 'HANDOVER' as const, title: `${row.packets} ${row.packets === 1 ? 'packet' : 'packets'} given to ${row.household.ownerName}`,
        detail: row.household.mahalluNumber, at: row.createdAt })),
    ];
    return entries.sort((a, b) => +b.at - +a.at).slice(0, 80);
  },

  async animals(userId: string) {
    const volunteer = await activeVolunteer(userId, 'canStatus');
    const program = await openProgramOf(volunteer.mahalluId);
    const rows = await db.slaughterAnimal.findMany({ where: { programId: program.id },
      orderBy: [{ drawOrder: { sort: 'asc', nulls: 'last' } }, { code: 'asc' }] });
    return rows.map(row => ({ id: row.id, code: row.code, animalType: row.animalType, drawOrder: row.drawOrder, slotAt: row.slotAt, status: row.status,
      slaughteredAt: row.slaughteredAt, processingAt: row.processingAt, packedAt: row.packedAt }));
  },

  async advance(userId: string, animalId: string, to: Status) {
    const volunteer = await activeVolunteer(userId, 'canStatus');
    const animal = await db.slaughterAnimal.findUnique({ where: { id: animalId }, include: { program: true } });
    if (!animal || animal.program.mahalluId !== volunteer.mahalluId) throw notFound('Animal');
    if (animal.program.status !== 'OPEN') throw new ApiError(409, 'NOT_OPEN', 'This program is not running.');
    if (!isNextStatus(animal.status, to)) throw new ApiError(409, 'INVALID_STATUS', 'Move the animal one step at a time. Ask the admin to correct mistakes.');
    // The status in the where clause makes two volunteers tapping at once safe: only one wins.
    const changed = await db.slaughterAnimal.updateMany({ where: { id: animalId, status: animal.status }, data: { status: to, statusById: userId,
      ...(to === 'SLAUGHTERED' ? { slaughteredAt: new Date() } : to === 'PROCESSING' ? { processingAt: new Date() } : { packedAt: new Date() }) } });
    if (!changed.count) throw new ApiError(409, 'INVALID_STATUS', 'Someone already updated this animal. Reload to see it.');
    await trackingService.onStatusChange(animalId, to);
    return { id: animalId, code: animal.code, status: to };
  },

  async stock(userId: string) {
    const volunteer = await activeVolunteer(userId, 'canDistribute');
    const program = await openProgramOf(volunteer.mahalluId);
    const recent = await db.distribution.findMany({ where: { volunteerId: volunteer.id, programId: program.id }, orderBy: { createdAt: 'desc' }, take: 30,
      include: { household: { select: { mahalluNumber: true, ownerName: true } } } });
    return { ...await stockOf(db, volunteer.id, program.id), recent: recent.map(row => ({ id: row.id, packets: row.packets, createdAt: row.createdAt, household: row.household })) };
  },

  async households(userId: string, query: string) {
    const volunteer = await activeVolunteer(userId, 'canDistribute');
    const program = await openProgramOf(volunteer.mahalluId);
    const digits = query.replace(/\D/g, '');
    const rows = await db.household.findMany({ where: { mahalluId: volunteer.mahalluId, ...(query ? { OR: [
      { ownerName: { contains: query, mode: 'insensitive' } }, { mahalluNumber: { contains: query, mode: 'insensitive' } },
      ...(digits ? [{ phone: { contains: digits } }] : [])] } : {}) }, orderBy: { mahalluNumber: 'asc' }, take: 25,
    select: { id: true, mahalluNumber: true, ownerName: true, memberCount: true } });
    const received = await db.distribution.groupBy({ by: ['householdId'], where: { programId: program.id, householdId: { in: rows.map(row => row.id) } }, _sum: { packets: true } });
    return rows.map(row => ({ ...row, received: received.find(item => item.householdId === row.id)?._sum.packets ?? 0 }));
  },

  async distribute(userId: string, input: { householdId: string; packets: number }) {
    const volunteer = await activeVolunteer(userId, 'canDistribute');
    const program = await openProgramOf(volunteer.mahalluId);
    const household = await db.household.findUnique({ where: { id: input.householdId } });
    if (!household || household.mahalluId !== volunteer.mahalluId) throw notFound('Household');
    const result = await runSerializable(async tx => {
      const stock = await stockOf(tx, volunteer.id, program.id);
      if (input.packets > stock.inHand) throw new ApiError(409, 'NOT_ENOUGH_STOCK', `You only have ${stock.inHand} packets in hand.`);
      const created = await tx.distribution.create({ data: { programId: program.id, volunteerId: volunteer.id, householdId: household.id, packets: input.packets } });
      return { id: created.id, ...stock, distributed: stock.distributed + input.packets, inHand: stock.inHand - input.packets };
    });
    await trackingService.onHandover(result.id);
    return result;
  },
};
