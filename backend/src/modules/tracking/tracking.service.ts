import { db } from '../../lib/db.js';
import { ApiError, log } from '../../lib/http.js';
import { notificationService } from '../notifications/notification.service.js';

type Message = { key: string; kind: string; title: string; body: string; link?: string };
const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', what + ' not found.');
const quiet = new Set(['OPT_IN_REQUIRED', 'USER_NOT_FOUND']);

/** Puts a message in the member's inbox once, and also sends it by email and Telegram if they opted in. */
async function notify(userId: string, message: Message) {
  const created = await db.inboxItem.createMany({ data: { userId, key: `${message.key}.${userId}`, kind: message.kind, title: message.title,
    body: message.body, link: message.link ?? null }, skipDuplicates: true });
  if (!created.count) return false;
  for (const channel of ['email', 'telegram'] as const) {
    try {
      await notificationService.send({ key: `${message.key}.${userId}.${channel}`, userId, channel, type: message.kind,
        data: { subject: message.title, message: message.body } });
    } catch (error) {
      if (!(error instanceof ApiError && quiet.has(error.code))) log('tracking.notify_failed');
    }
  }
  return true;
}

async function holdersOf(animalId: string) {
  const rows = await db.shareAllocation.findMany({ where: { animalId }, select: { booking: { select: { household: { select: { userId: true } } } } } });
  return [...new Set(rows.map(row => row.booking.household.userId).filter((id): id is string => id !== null))];
}

export const trackingService = {
  /**
   * Called after an animal's status moves forward. When one animal is slaughtered the next animal in the draw order is "next",
   * and its households are told to be ready. Households are also told when their own animal is slaughtered and packed.
   */
  async onStatusChange(animalId: string, to: string) {
    try {
      const animal = await db.slaughterAnimal.findUnique({ where: { id: animalId } });
      if (!animal) return;
      if (to === 'SLAUGHTERED' || to === 'PACKED') {
        const [short, long] = to === 'PACKED' ? ['is packed', 'is packed and ready for distribution'] : ['has been slaughtered', 'has been slaughtered'];
        for (const userId of await holdersOf(animalId)) {
          await notify(userId, { key: `status.${animalId}.${to}`, kind: 'animal.status', title: `${animal.code} ${short}`,
            body: `Your animal ${animal.code} ${long}.`, link: '/app/tracking' });
        }
      }
      if (to === 'SLAUGHTERED' && animal.drawOrder !== null) {
        const next = await db.slaughterAnimal.findFirst({ where: { programId: animal.programId, drawOrder: { gt: animal.drawOrder }, status: 'PENDING' },
          orderBy: { drawOrder: 'asc' } });
        if (next) {
          for (const userId of await holdersOf(next.id)) {
            await notify(userId, { key: `next.${next.id}`, kind: 'animal.next', title: `${next.code} is next`,
              body: `Your animal ${next.code} is next in line. Please be ready.`, link: '/app/tracking' });
          }
        }
      }
    } catch {
      log('tracking.status_hook_failed');
    }
  },

  async onHandover(distributionId: string) {
    try {
      const row = await db.distribution.findUnique({ where: { id: distributionId }, include: { household: { select: { userId: true, ownerName: true } } } });
      if (!row?.household.userId) return;
      await notify(row.household.userId, { key: `meat.${row.id}`, kind: 'meat.given', title: 'Meat handed to your household',
        body: `${row.packets} ${row.packets === 1 ? 'packet' : 'packets'} recorded for ${row.household.ownerName}. Please confirm once you have them.`, link: '/app/tracking' });
    } catch {
      log('tracking.handover_hook_failed');
    }
  },

  async inbox(userId: string) {
    const [items, unread] = await Promise.all([
      db.inboxItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
        select: { id: true, kind: true, title: true, body: true, link: true, createdAt: true, readAt: true } }),
      db.inboxItem.count({ where: { userId, readAt: null } }),
    ]);
    return { unread, items };
  },

  async markRead(userId: string, ids?: string[]) {
    await db.inboxItem.updateMany({ where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    return trackingService.inbox(userId);
  },

  /** What a member needs to follow the day: where each of their animals is in the queue, and meat handed to their households. */
  async tracking(userId: string) {
    const bookings = await db.booking.findMany({ where: { household: { userId }, program: { status: { in: ['OPEN', 'ENDED'] } } },
      include: { program: { select: { id: true, name: true, status: true, createdAt: true } }, allocations: { include: { animal: true } } } });
    const programIds = [...new Set(bookings.map(item => item.programId))];
    const [animals, handovers] = await Promise.all([
      db.slaughterAnimal.findMany({ where: { programId: { in: programIds } }, select: { id: true, programId: true, code: true, drawOrder: true, status: true } }),
      db.distribution.findMany({ where: { programId: { in: programIds }, household: { userId } }, orderBy: { createdAt: 'desc' },
        include: { household: { select: { mahalluNumber: true, ownerName: true } }, program: { select: { name: true } } } }),
    ]);
    return {
      programs: programIds.map(programId => {
        const program = bookings.find(item => item.programId === programId)!.program;
        const all = animals.filter(item => item.programId === programId);
        const count = (status: string) => all.filter(item => item.status === status).length;
        const mine = new Map<string, { code: string; animalType: string; shares: number; status: string; drawOrder: number | null; slotAt: Date | null; id: string }>();
        for (const booking of bookings.filter(item => item.programId === programId)) {
          for (const item of booking.allocations) {
            const known = mine.get(item.animalId);
            mine.set(item.animalId, { id: item.animalId, code: item.animal.code, animalType: item.animal.animalType, status: item.animal.status,
              drawOrder: item.animal.drawOrder, slotAt: item.animal.slotAt, shares: (known?.shares ?? 0) + item.shares });
          }
        }
        const current = all.filter(item => item.status === 'PENDING' && item.drawOrder !== null).sort((a, b) => a.drawOrder! - b.drawOrder!)[0];
        return {
          id: program.id, name: program.name, status: program.status,
          queue: { total: all.length, pending: count('PENDING'), slaughtered: count('SLAUGHTERED'), processing: count('PROCESSING'), packed: count('PACKED'),
            upNext: current ? { code: current.code, drawOrder: current.drawOrder } : null },
          animals: [...mine.values()].sort((a, b) => (a.drawOrder ?? 1e9) - (b.drawOrder ?? 1e9)).map(item => ({
            ...item, ahead: item.drawOrder === null || item.status !== 'PENDING' ? null
              : all.filter(other => other.status === 'PENDING' && other.drawOrder !== null && other.drawOrder < item.drawOrder!).length,
          })),
          handovers: handovers.filter(item => item.programId === programId).map(item => ({ id: item.id, packets: item.packets, createdAt: item.createdAt,
            receivedAt: item.receivedAt, household: item.household })),
        };
      }),
    };
  },

  async confirmReceipt(userId: string, distributionId: string) {
    const row = await db.distribution.findUnique({ where: { id: distributionId }, include: { household: { select: { userId: true } } } });
    if (!row || row.household.userId !== userId) throw notFound('Handover');
    await db.distribution.updateMany({ where: { id: distributionId, receivedAt: null }, data: { receivedAt: new Date() } });
    return { confirmed: true };
  },
};
