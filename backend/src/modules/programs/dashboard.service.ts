import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';
import { financeOf } from './payments.logic.js';

type Actor = { id: string; permissions: string[] };

async function adminProgram(actor: Actor, programId: string) {
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) throw new ApiError(404, 'NOT_FOUND', 'Program not found.');
  await assertMahalluAdmin(actor, program.mahalluId);
  return program;
}

export type Entry = { id: string; at: Date; type: 'PAYMENT' | 'EXPENSE' | 'MEAT_ISSUE' | 'DISTRIBUTION'; title: string; detail: string; amount: number | null;
  packets: number | null; status: string };

export const dashboardService = {
  /** One screen of numbers for the admin: money, animals, meat and who is behind. */
  async summary(actor: Actor, programId: string, now = new Date()) {
    const program = await adminProgram(actor, programId);
    const [households, bookings, animals, issued, handed, served, expenses] = await Promise.all([
      db.household.count({ where: { mahalluId: program.mahalluId } }),
      db.booking.findMany({ where: { programId }, include: { program: { include: { animals: true } }, payments: true } }),
      db.slaughterAnimal.groupBy({ by: ['status'], where: { programId }, _count: true }),
      db.meatIssue.aggregate({ _sum: { packets: true }, where: { programId } }),
      db.distribution.aggregate({ _sum: { packets: true }, _count: true, where: { programId } }),
      db.distribution.findMany({ where: { programId }, distinct: ['householdId'], select: { householdId: true } }),
      db.expense.aggregate({ _sum: { amount: true }, where: { programId, voidedAt: null } }),
    ]);
    const money = bookings.map(booking => financeOf(booking, now));
    const confirmed = bookings.flatMap(booking => booking.payments.filter(item => item.status === 'CONFIRMED'));
    const sum = (method: string) => confirmed.filter(item => item.method === method).reduce((acc, item) => acc + item.amount, 0);
    const count = (status: string) => animals.find(row => row.status === status)?._count ?? 0;
    const collected = money.reduce((acc, item) => acc + item.paid, 0);
    const spent = expenses._sum.amount ?? 0;
    const given = issued._sum.packets ?? 0;
    const out = handed._sum.packets ?? 0;
    const receipts = await db.distribution.count({ where: { programId, receivedAt: { not: null } } });
    return {
      program: { id: program.id, name: program.name, status: program.status },
      households, bookedHouseholds: new Set(bookings.map(item => item.householdId)).size, bookings: bookings.length,
      shares: bookings.reduce((acc, item) => acc + item.shares, 0),
      money: { expected: money.reduce((acc, item) => acc + item.total, 0), collected, outstanding: money.reduce((acc, item) => acc + item.remaining, 0),
        cash: sum('CASH'), online: sum('ONLINE'), spent, balance: collected - spent,
        paid: money.filter(item => item.standing === 'PAID').length, onTrack: money.filter(item => item.standing === 'ON_TRACK').length,
        behind: money.filter(item => item.standing === 'BEHIND').length },
      animals: { total: animals.reduce((acc, row) => acc + row._count, 0), pending: count('PENDING'), slaughtered: count('SLAUGHTERED'),
        processing: count('PROCESSING'), packed: count('PACKED') },
      meat: { issued: given, handedOut: out, inHand: given - out, householdsServed: served.length, handovers: handed._count, confirmed: receipts },
    };
  },

  /** Every money and meat movement in one list, newest first. */
  async transactions(actor: Actor, programId: string) {
    await adminProgram(actor, programId);
    const [payments, expenses, issues, handovers] = await Promise.all([
      db.programPayment.findMany({ where: { booking: { programId } }, orderBy: { createdAt: 'desc' }, take: 300,
        include: { booking: { select: { animalType: true, household: { select: { mahalluNumber: true, ownerName: true } } } } } }),
      db.expense.findMany({ where: { programId }, orderBy: { createdAt: 'desc' }, take: 300 }),
      db.meatIssue.findMany({ where: { programId }, orderBy: { createdAt: 'desc' }, take: 300, include: { volunteer: { select: { name: true } } } }),
      db.distribution.findMany({ where: { programId }, orderBy: { createdAt: 'desc' }, take: 300,
        include: { volunteer: { select: { name: true } }, household: { select: { mahalluNumber: true, ownerName: true } } } }),
    ]);
    const entries: Entry[] = [
      ...payments.map(row => ({ id: row.id, at: row.createdAt, type: 'PAYMENT' as const, title: `${row.method === 'CASH' ? 'Cash' : 'Online'} payment`,
        detail: `${row.booking.household.ownerName} (${row.booking.household.mahalluNumber}) · ${row.booking.animalType.toLowerCase()}`, amount: row.amount, packets: null,
        status: row.status })),
      ...expenses.map(row => ({ id: row.id, at: row.createdAt, type: 'EXPENSE' as const, title: row.title, detail: row.category.toLowerCase(), amount: row.amount, packets: null,
        status: row.voidedAt ? 'VOIDED' : 'RECORDED' })),
      ...issues.map(row => ({ id: row.id, at: row.createdAt, type: 'MEAT_ISSUE' as const, title: 'Packets given to volunteer', detail: row.volunteer.name + (row.note ? ' · ' + row.note : ''),
        amount: null, packets: row.packets, status: 'RECORDED' })),
      ...handovers.map(row => ({ id: row.id, at: row.createdAt, type: 'DISTRIBUTION' as const, title: 'Meat handed to household',
        detail: `${row.household.ownerName} (${row.household.mahalluNumber}) · by ${row.volunteer.name}`, amount: null, packets: row.packets,
        status: row.receivedAt ? 'CONFIRMED' : 'RECORDED' })),
    ];
    return entries.sort((a, b) => +b.at - +a.at).slice(0, 500);
  },
};
