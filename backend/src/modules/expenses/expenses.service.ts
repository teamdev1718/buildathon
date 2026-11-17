import { z } from 'zod';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';

type Actor = { id: string; permissions: string[] };
export const categories = ['ANIMALS', 'TRANSPORT', 'LABOUR', 'PACKING', 'FOOD', 'OTHER'] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
const day = z.iso.date().transform(value => new Date(value + 'T00:00:00.000Z'));

export const expenseInput = z.strictObject({
  title: text(120), category: z.enum(categories), amount: z.number().int().min(1).max(100_000_000), spentOn: day, note: text(300).optional(),
});
export const expenseUpdate = expenseInput.partial();
export const voidInput = z.strictObject({ reason: text(200).min(3) });

const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', what + ' not found.');
const view = (row: { id: string; title: string; category: string; amount: number; spentOn: Date; note: string | null; voidedAt: Date | null; voidReason: string | null }) => ({
  id: row.id, title: row.title, category: row.category, amount: row.amount, spentOn: row.spentOn, note: row.note, voidedAt: row.voidedAt, voidReason: row.voidReason,
});

async function adminProgram(actor: Actor, programId: string) {
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) throw notFound('Program');
  await assertMahalluAdmin(actor, program.mahalluId);
  return program;
}

export const expenseService = {
  async list(actor: Actor, programId: string) {
    await adminProgram(actor, programId);
    const rows = await db.expense.findMany({ where: { programId }, orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(view);
  },

  async add(actor: Actor, programId: string, input: z.output<typeof expenseInput>) {
    const program = await adminProgram(actor, programId);
    if (program.status === 'DRAFT') throw new ApiError(409, 'NOT_STARTED', 'Start the program before recording expenses.');
    const created = await db.expense.create({ data: { ...input, note: input.note ?? null, programId, createdById: actor.id } });
    await db.auditEvent.create({ data: { userId: actor.id, action: 'expense.added' } });
    return view(created);
  },

  async update(actor: Actor, expenseId: string, input: z.output<typeof expenseUpdate>) {
    const expense = await db.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw notFound('Expense');
    await adminProgram(actor, expense.programId);
    if (expense.voidedAt) throw new ApiError(409, 'VOIDED', 'A voided expense cannot be changed.');
    const updated = await db.expense.update({ where: { id: expenseId }, data: input });
    await db.auditEvent.create({ data: { userId: actor.id, action: 'expense.updated' } });
    return view(updated);
  },

  /** Expenses are never deleted: a voided one stays on the public ledger, struck out, with the reason. */
  async void(actor: Actor, expenseId: string, reason: string) {
    const expense = await db.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw notFound('Expense');
    await adminProgram(actor, expense.programId);
    const changed = await db.expense.updateMany({ where: { id: expenseId, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason } });
    if (!changed.count) throw new ApiError(409, 'VOIDED', 'This expense was already voided.');
    await db.auditEvent.create({ data: { userId: actor.id, action: 'expense.voided' } });
    return { voided: true };
  },

  /** Programs whose books anyone may read. Only aggregate money and expenses are shown, never households. */
  async publicIndex() {
    const rows = await db.program.findMany({ where: { status: { in: ['OPEN', 'ENDED'] }, mahallu: { active: true } }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, name: true, status: true, targetDate: true, mahallu: { select: { name: true, district: true } } } });
    return rows.map(row => ({ id: row.id, name: row.name, status: row.status, targetDate: row.targetDate, mahalluName: row.mahallu.name, district: row.mahallu.district }));
  },

  async publicLedger(programId: string) {
    const program = await db.program.findFirst({ where: { id: programId, status: { in: ['OPEN', 'ENDED'] }, mahallu: { active: true } },
      select: { id: true, name: true, status: true, targetDate: true, mahallu: { select: { name: true, district: true } } } });
    if (!program) throw notFound('Ledger');
    const [paid, expenses, animals, handed, households] = await Promise.all([
      db.programPayment.aggregate({ _sum: { amount: true }, _count: true, where: { status: 'CONFIRMED', booking: { programId } } }),
      db.expense.findMany({ where: { programId }, orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }] }),
      db.slaughterAnimal.groupBy({ by: ['status'], where: { programId }, _count: true }),
      db.distribution.aggregate({ _sum: { packets: true }, where: { programId } }),
      db.distribution.findMany({ where: { programId }, distinct: ['householdId'], select: { householdId: true } }),
    ]);
    const live = expenses.filter(row => !row.voidedAt);
    const spent = live.reduce((sum, row) => sum + row.amount, 0);
    const collected = paid._sum.amount ?? 0;
    const byCategory = categories.map(category => ({ category, amount: live.filter(row => row.category === category).reduce((sum, row) => sum + row.amount, 0) }))
      .filter(row => row.amount > 0);
    const count = (status: string) => animals.find(row => row.status === status)?._count ?? 0;
    return {
      program: { id: program.id, name: program.name, status: program.status, targetDate: program.targetDate, mahalluName: program.mahallu.name, district: program.mahallu.district },
      collected, payments: paid._count, spent, balance: collected - spent, byCategory,
      animals: { total: animals.reduce((sum, row) => sum + row._count, 0), slaughtered: count('SLAUGHTERED'), processing: count('PROCESSING'), packed: count('PACKED') },
      meat: { packetsHandedOut: handed._sum.packets ?? 0, householdsServed: households.length },
      expenses: expenses.map(view), generatedAt: new Date(),
    };
  },
};
