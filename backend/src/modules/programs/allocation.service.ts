import { randomInt } from 'node:crypto';
import type { z } from 'zod';
import { db, runSerializable } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';
import { animalCode, animalTypes, planAllocation, shuffle, slotAt } from './programs.logic.js';
import type { allocationInput, drawInput } from './programs.schema.js';

type Actor = { id: string; permissions: string[] };

async function adminProgram(actor: Actor, programId: string) {
  const program = await db.program.findUnique({ where: { id: programId }, include: { animals: true } });
  if (!program) throw new ApiError(404, 'NOT_FOUND', 'Program not found.');
  await assertMahalluAdmin(actor, program.mahalluId);
  return program;
}

function requireOpen(status: string) {
  if (status !== 'OPEN') throw new ApiError(409, 'NOT_OPEN', 'Allocation and the draw are only possible while the program is open.');
}

export const allocationService = {
  /** Wipes the current allocation and draw, then packs every booking into the fewest animals. Runs only when the admin asks. */
  async allocate(actor: Actor, programId: string) {
    const program = await adminProgram(actor, programId);
    requireOpen(program.status);
    await runSerializable(async tx => {
      const bookings = await tx.booking.findMany({ where: { programId }, orderBy: { createdAt: 'asc' } });
      await tx.slaughterAnimal.deleteMany({ where: { programId } });
      for (const type of animalTypes) {
        const setting = program.animals.find(item => item.animalType === type);
        const mine = bookings.filter(item => item.animalType === type);
        if (!setting || !mine.length) continue;
        const plan = planAllocation(mine.map(item => ({ id: item.id, shares: item.shares })), setting.sharesPerAnimal);
        const created = await tx.slaughterAnimal.createManyAndReturn({ select: { id: true, code: true },
          data: Array.from({ length: plan.animals }, (_, index) => ({ programId, animalType: type, code: animalCode(type, index + 1) })) });
        created.sort((a, b) => a.code.localeCompare(b.code));
        await tx.shareAllocation.createMany({ data: plan.placements.map(item => ({
          animalId: created[item.animal].id, bookingId: item.bookingId, shares: item.shares })) });
      }
      await tx.program.update({ where: { id: programId }, data: { allocatedAt: new Date(), drawStartAt: null, drawMinutes: null } });
    });
    return allocationService.view(actor, programId);
  },

  async view(actor: Actor, programId: string) {
    const program = await adminProgram(actor, programId);
    const [animals, bookings] = await Promise.all([
      db.slaughterAnimal.findMany({ where: { programId }, include: { allocations: { include: { booking: { select: { id: true,
        household: { select: { mahalluNumber: true, ownerName: true } } } } } } } },
      ),
      db.booking.findMany({ where: { programId }, include: { allocations: true, household: { select: { mahalluNumber: true, ownerName: true } } } }),
    ]);
    const capacity = new Map(program.animals.map(item => [item.animalType, item.sharesPerAnimal]));
    const rows = animals.map(animal => ({
      id: animal.id, code: animal.code, status: animal.status,
      animalType: animal.animalType, capacity: capacity.get(animal.animalType) ?? 1, drawOrder: animal.drawOrder, slotAt: animal.slotAt,
      filled: animal.allocations.reduce((sum, item) => sum + item.shares, 0),
      holders: animal.allocations.map(item => ({ bookingId: item.bookingId, shares: item.shares, ...item.booking.household }))
        .sort((a, b) => a.mahalluNumber.localeCompare(b.mahalluNumber, undefined, { numeric: true })),
    })).sort((a, b) => (a.drawOrder ?? 1e9) - (b.drawOrder ?? 1e9) || a.code.localeCompare(b.code));
    const bookingRows = bookings.map(item => ({
      id: item.id, animalType: item.animalType, shares: item.shares, household: item.household,
      allocated: item.allocations.reduce((sum, row) => sum + row.shares, 0),
      allocations: item.allocations.map(row => ({ animalId: row.animalId, shares: row.shares })),
    }));
    const bookedShares = bookingRows.reduce((sum, item) => sum + item.shares, 0);
    const allocatedShares = bookingRows.reduce((sum, item) => sum + item.allocated, 0);
    return {
      allocatedAt: program.allocatedAt, drawStartAt: program.drawStartAt, drawMinutes: program.drawMinutes,
      drawn: rows.length > 0 && rows.every(row => row.drawOrder !== null),
      bookedShares, allocatedShares, unallocatedShares: bookedShares - allocatedShares, animals: rows, bookings: bookingRows,
    };
  },

  /** Manual edit: replaces how one booking's shares are spread over animals of its type, never above an animal's capacity. */
  async editBooking(actor: Actor, bookingId: string, input: z.output<typeof allocationInput>) {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { program: { include: { animals: true } } } });
    if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
    await assertMahalluAdmin(actor, booking.program.mahalluId);
    requireOpen(booking.program.status);
    const ids = input.items.map(item => item.animalId);
    if (new Set(ids).size !== ids.length) throw new ApiError(400, 'INVALID_INPUT', 'List each animal once.');
    if (input.items.reduce((sum, item) => sum + item.shares, 0) > booking.shares) {
      throw new ApiError(409, 'TOO_MANY_SHARES', 'That is more shares than this household booked.');
    }
    await runSerializable(async tx => {
      const animals = await tx.slaughterAnimal.findMany({ where: { id: { in: ids }, programId: booking.programId, animalType: booking.animalType } });
      if (animals.length !== ids.length) throw new ApiError(404, 'NOT_FOUND', 'Choose animals of the same type from this program.');
      const capacity = booking.program.animals.find(item => item.animalType === booking.animalType)!.sharesPerAnimal;
      for (const item of input.items) {
        const others = await tx.shareAllocation.aggregate({ _sum: { shares: true }, where: { animalId: item.animalId, bookingId: { not: bookingId } } });
        if ((others._sum.shares ?? 0) + item.shares > capacity) {
          const code = animals.find(animal => animal.id === item.animalId)!.code;
          throw new ApiError(409, 'ANIMAL_FULL', `${code} cannot take that many shares.`);
        }
      }
      await tx.shareAllocation.deleteMany({ where: { bookingId } });
      await tx.shareAllocation.createMany({ data: input.items.map(item => ({ bookingId, animalId: item.animalId, shares: item.shares })) });
    });
    return allocationService.view(actor, booking.programId);
  },

  /** Random draw of the slaughter order across every animal, with a time slot for each. Admin can reorder afterwards. */
  async draw(actor: Actor, programId: string, input: z.output<typeof drawInput>, random: (limit: number) => number = randomInt) {
    const program = await adminProgram(actor, programId);
    requireOpen(program.status);
    const animals = await db.slaughterAnimal.findMany({ where: { programId }, select: { id: true } });
    if (!animals.length) throw new ApiError(409, 'NOT_ALLOCATED', 'Allocate shares to animals before the draw.');
    const order = shuffle(animals.map(item => item.id), random);
    await db.$transaction([
      db.program.update({ where: { id: programId }, data: { drawStartAt: input.startAt, drawMinutes: input.minutesPerAnimal } }),
      ...order.map((id, index) => db.slaughterAnimal.update({ where: { id }, data: { drawOrder: index + 1,
        slotAt: slotAt(input.startAt, input.minutesPerAnimal, index + 1) } })),
    ]);
    return allocationService.view(actor, programId);
  },

  async reorder(actor: Actor, programId: string, animalIds: string[]) {
    const program = await adminProgram(actor, programId);
    requireOpen(program.status);
    if (!program.drawStartAt || !program.drawMinutes) throw new ApiError(409, 'NOT_DRAWN', 'Run the draw before changing the order.');
    const animals = await db.slaughterAnimal.findMany({ where: { programId }, select: { id: true } });
    const known = new Set(animals.map(item => item.id));
    if (animalIds.length !== known.size || new Set(animalIds).size !== known.size || animalIds.some(id => !known.has(id))) {
      throw new ApiError(400, 'INVALID_ORDER', 'List every animal exactly once.');
    }
    const { drawStartAt, drawMinutes } = program;
    await db.$transaction(animalIds.map((id, index) => db.slaughterAnimal.update({ where: { id },
      data: { drawOrder: index + 1, slotAt: slotAt(drawStartAt, drawMinutes, index + 1) } })));
    return allocationService.view(actor, programId);
  },
};
