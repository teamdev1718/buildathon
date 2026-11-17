import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';
import { defaultPayBy, financeOf } from './payments.logic.js';
import { animalsNeeded, animalTypes, bookingTotal, sharePrice, sharesPerAnimal } from './programs.logic.js';
import type { animalUpdate, bookingInput, bookingUpdate, programInput, programUpdate } from './programs.schema.js';

type Actor = { id: string; permissions: string[] };
const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', what + ' not found.');
const isUnique = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

const withAnimals = { animals: { orderBy: { sharesPerAnimal: 'asc' as const } } };
type ProgramRow = Prisma.ProgramGetPayload<{ include: typeof withAnimals }>;

const animalView = (row: ProgramRow['animals'][number]) => ({
  animalType: row.animalType, price: row.price, enabled: row.enabled, sharesPerAnimal: row.sharesPerAnimal,
  sharePrice: sharePrice(row.price, row.sharesPerAnimal),
});
const programView = (row: ProgramRow) => ({
  id: row.id, mahalluId: row.mahalluId, name: row.name, year: row.year, targetDate: row.targetDate,
  description: row.description, status: row.status, openedAt: row.openedAt, endedAt: row.endedAt,
  payBy: row.payByDate ?? defaultPayBy(row.targetDate), payByCustom: row.payByDate !== null,
  animals: row.animals.map(animalView),
});

async function loadProgram(programId: string) {
  const program = await db.program.findUnique({ where: { id: programId }, include: withAnimals });
  if (!program) throw notFound('Program');
  return program;
}

/** Admins of the mahallu, or members who are linked to a household in it, may see a program (drafts are admin-only). */
async function assertCanView(actor: Actor, program: ProgramRow) {
  if (program.status !== 'DRAFT' && await db.household.findFirst({ where: { mahalluId: program.mahalluId, userId: actor.id } })) return;
  await assertMahalluAdmin(actor, program.mahalluId);
}

export const programService = {
  async list(mahalluId: string) {
    const rows = await db.program.findMany({ where: { mahalluId }, orderBy: { createdAt: 'desc' },
      include: { ...withAnimals, _count: { select: { bookings: true } } } });
    return rows.map(({ _count, ...row }) => ({ ...programView(row), bookings: _count.bookings }));
  },

  async create(mahalluId: string, input: z.output<typeof programInput>) {
    if (input.payByDate && input.payByDate > input.targetDate) throw new ApiError(400, 'INVALID_INPUT', 'Pay-by date must be on or before Udhiyya.');
    if (await db.program.findFirst({ where: { mahalluId, status: { not: 'ENDED' } } })) {
      throw new ApiError(409, 'PROGRAM_OPEN', 'End the current program before starting a new one.');
    }
    const created = await db.program.create({ data: { ...input, mahalluId,
      animals: { create: animalTypes.map(type => ({ animalType: type, sharesPerAnimal: sharesPerAnimal[type] })) } },
    include: withAnimals });
    return programView(created);
  },

  async get(actor: Actor, programId: string) {
    const program = await loadProgram(programId);
    await assertCanView(actor, program);
    return programView(program);
  },

  async update(actor: Actor, programId: string, input: z.output<typeof programUpdate>) {
    const program = await loadProgram(programId);
    await assertMahalluAdmin(actor, program.mahalluId);
    if (program.status === 'ENDED') throw new ApiError(409, 'PROGRAM_ENDED', 'This program has ended.');
    const target = input.targetDate ?? program.targetDate;
    const payBy = input.payByDate ?? program.payByDate;
    if (payBy && payBy > target) throw new ApiError(400, 'INVALID_INPUT', 'Pay-by date must be on or before Udhiyya.');
    await db.program.update({ where: { id: programId }, data: input });
    return programView(await loadProgram(programId));
  },

  /** Prices stay editable while the program runs; bookings always use the current share price. */
  async updateAnimal(actor: Actor, programId: string, type: (typeof animalTypes)[number], input: z.output<typeof animalUpdate>) {
    const program = await loadProgram(programId);
    await assertMahalluAdmin(actor, program.mahalluId);
    if (program.status === 'ENDED') throw new ApiError(409, 'PROGRAM_ENDED', 'This program has ended.');
    if (input.enabled === false && await db.booking.findFirst({ where: { programId, animalType: type } })) {
      throw new ApiError(409, 'HAS_BOOKINGS', 'Households have already booked this animal. Remove their bookings first.');
    }
    await db.programAnimal.update({ where: { programId_animalType: { programId, animalType: type } }, data: input });
    return programView(await loadProgram(programId));
  },

  async start(actor: Actor, programId: string) {
    const program = await loadProgram(programId);
    await assertMahalluAdmin(actor, program.mahalluId);
    if (program.status !== 'DRAFT') throw new ApiError(409, 'INVALID_TRANSITION', 'Only a draft program can be started.');
    const enabled = program.animals.filter(item => item.enabled);
    if (!enabled.length) throw new ApiError(409, 'NO_ANIMALS', 'Enable at least one animal type.');
    if (enabled.some(item => item.price <= 0)) throw new ApiError(409, 'PRICE_MISSING', 'Set a price for every enabled animal first.');
    const changed = await db.program.updateMany({ where: { id: programId, status: 'DRAFT' }, data: { status: 'OPEN', openedAt: new Date() } });
    if (!changed.count) throw new ApiError(409, 'INVALID_TRANSITION', 'The program changed. Reload and try again.');
    return programView(await loadProgram(programId));
  },

  async end(actor: Actor, programId: string) {
    const program = await loadProgram(programId);
    await assertMahalluAdmin(actor, program.mahalluId);
    const changed = await db.program.updateMany({ where: { id: programId, status: 'OPEN' }, data: { status: 'ENDED', endedAt: new Date() } });
    if (!changed.count) throw new ApiError(409, 'INVALID_TRANSITION', 'Only a running program can be ended.');
    return programView(await loadProgram(programId));
  },

  /** Everything the admin needs to plan: who booked what and how many animals each type needs. */
  async bookings(actor: Actor, programId: string) {
    const program = await loadProgram(programId);
    await assertMahalluAdmin(actor, program.mahalluId);
    const rows = await db.booking.findMany({ where: { programId }, orderBy: { createdAt: 'asc' },
      include: { household: { select: { mahalluNumber: true, ownerName: true, phone: true } }, payments: true } });
    const byType = new Map<string, number>();
    for (const row of rows) byType.set(row.animalType, (byType.get(row.animalType) ?? 0) + row.shares);
    const price = new Map(program.animals.map(item => [item.animalType, item]));
    return {
      totals: program.animals.filter(item => item.enabled || byType.has(item.animalType)).map(item => {
        const shares = byType.get(item.animalType) ?? 0;
        return { animalType: item.animalType, shares, animalsNeeded: animalsNeeded(shares, item.sharesPerAnimal),
          amount: shares * sharePrice(item.price, item.sharesPerAnimal) };
      }),
      rows: rows.map(row => {
        const animal = price.get(row.animalType)!;
        const money = financeOf({ ...row, program }, new Date());
        return { id: row.id, householdId: row.householdId, animalType: row.animalType, shares: row.shares, payMode: row.payMode,
          amount: bookingTotal(row.shares, animal.price, animal.sharesPerAnimal), createdAt: row.createdAt, household: row.household,
          paid: money.paid, remaining: money.remaining, standing: money.standing };
      }),
    };
  },

  /** A member books for their own household; an admin may book on behalf of any household in the mahallu. */
  async book(actor: Actor, programId: string, input: z.output<typeof bookingInput>) {
    const program = await loadProgram(programId);
    const household = await db.household.findUnique({ where: { id: input.householdId } });
    if (!household || household.mahalluId !== program.mahalluId) throw notFound('Household');
    if (household.userId !== actor.id) await assertMahalluAdmin(actor, program.mahalluId);
    if (program.status !== 'OPEN') throw new ApiError(409, 'NOT_OPEN', 'This program is not open for booking.');
    const animal = program.animals.find(item => item.animalType === input.animalType);
    if (!animal?.enabled) throw new ApiError(409, 'ANIMAL_UNAVAILABLE', 'This animal is not offered.');
    try {
      const created = await db.booking.create({ data: { programId, householdId: household.id, animalType: input.animalType,
        shares: input.shares, payMode: input.payMode } });
      return { ...created, amount: bookingTotal(created.shares, animal.price, animal.sharesPerAnimal) };
    } catch (error) {
      if (isUnique(error)) throw new ApiError(409, 'ALREADY_BOOKED', 'This household already booked this animal. Change the shares instead.');
      throw error;
    }
  },

  async bookingAccess(actor: Actor, bookingId: string) {
    const booking = await db.booking.findUnique({ where: { id: bookingId },
      include: { household: true, program: { include: withAnimals } } });
    if (!booking) throw notFound('Booking');
    if (booking.household.userId !== actor.id) await assertMahalluAdmin(actor, booking.program.mahalluId);
    if (booking.program.status !== 'OPEN') throw new ApiError(409, 'NOT_OPEN', 'This program is not open for changes.');
    return booking;
  },

  async changeBooking(actor: Actor, bookingId: string, input: z.output<typeof bookingUpdate>) {
    const booking = await programService.bookingAccess(actor, bookingId);
    // A different share count invalidates where those shares were placed; the admin allocates again.
    if (input.shares !== undefined && input.shares !== booking.shares) await db.shareAllocation.deleteMany({ where: { bookingId } });
    const updated = await db.booking.update({ where: { id: bookingId }, data: input });
    const animal = booking.program.animals.find(item => item.animalType === updated.animalType)!;
    return { ...updated, amount: bookingTotal(updated.shares, animal.price, animal.sharesPerAnimal) };
  },

  async cancelBooking(actor: Actor, bookingId: string) {
    await programService.bookingAccess(actor, bookingId);
    await db.booking.delete({ where: { id: bookingId } });
    return { removed: true };
  },

  /** Open programs in every mahallu the member belongs to, with their household bookings. */
  async mine(userId: string) {
    const households = await db.household.findMany({ where: { userId }, select: { id: true, mahalluId: true, ownerName: true,
      mahalluNumber: true } });
    if (!households.length) return [];
    const programs = await db.program.findMany({ where: { mahalluId: { in: households.map(item => item.mahalluId) },
      status: { in: ['OPEN', 'ENDED'] } }, orderBy: { createdAt: 'desc' }, take: 10,
    include: { ...withAnimals, mahallu: { select: { name: true } },
      bookings: { where: { household: { userId } }, include: { allocations: { include: { animal: true } }, payments: { orderBy: { createdAt: 'desc' } } } } } });
    return programs.map(({ bookings, mahallu, ...row }) => {
      const view = programView(row);
      const household = households.find(item => item.mahalluId === row.mahalluId)!;
      return { ...view, mahalluName: mahallu.name, household,
        bookings: bookings.map(booking => {
          const animal = row.animals.find(item => item.animalType === booking.animalType)!;
          const money = financeOf({ ...booking, program: row });
          return { id: booking.id, animalType: booking.animalType, shares: booking.shares, payMode: booking.payMode,
            amount: bookingTotal(booking.shares, animal.price, animal.sharesPerAnimal), autopay: booking.autopay, money,
            payments: booking.payments.map(item => ({ id: item.id, amount: item.amount, method: item.method, status: item.status,
              note: item.note, createdAt: item.createdAt })),
            animals: booking.allocations.map(item => ({ code: item.animal.code, shares: item.shares, drawOrder: item.animal.drawOrder, status: item.animal.status,
              slotAt: item.animal.slotAt })).sort((a, b) => a.code.localeCompare(b.code)) };
        }) };
    });
  },
};
