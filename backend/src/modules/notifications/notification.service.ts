import { z } from 'zod';
import { db } from '../../lib/db.js';
import { ApiError, log } from '../../lib/http.js';
import { emailService } from '../email/email.service.js';
import { sendTelegram } from '../telegram/telegram.service.js';

const notification = z.strictObject({
  key: z.string().regex(/^[\w./-]{1,150}$/),
  userId: z.uuid(),
  channel: z.enum(['email', 'telegram']),
  type: z.string().regex(/^[\w.-]{1,60}$/),
  data: z.strictObject({ subject: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(3000) }),
});

export const notificationService = {
  async send(input: z.input<typeof notification>) {
    const { data, ...record } = notification.parse(input);
    const user = await db.user.findUnique({ where: { id: record.userId } });
    if (!user?.verifiedAt) throw new ApiError(404, 'USER_NOT_FOUND', 'Recipient is unavailable.');
    const target = record.channel === 'email' ? (user.emailOptIn ? user.email : null) : user.telegramChatId;
    if (!target) throw new ApiError(409, 'OPT_IN_REQUIRED', 'Recipient has not opted in.');
    const inserted = await db.notification.createMany({ data: record, skipDuplicates: true });
    if (!inserted.count) {
      const previous = await db.notification.findUniqueOrThrow({ where: { key: record.key } });
      if (previous.userId !== record.userId || previous.channel !== record.channel || previous.type !== record.type) {
        throw new ApiError(409, 'KEY_CONFLICT', 'Use a unique notification key.');
      }
      return { status: previous.status, duplicate: true };
    }
    let status: string;
    try {
      if (record.channel === 'email') {
        ({ status } = await emailService.send({ to: target, subject: data.subject, data: data.message,
          template: 'notification', key: 'notification/' + record.key }));
      } else {
        await sendTelegram(target, data.message);
        status = 'ACCEPTED';
      }
    } catch {
      status = 'FAILED';
    }
    await db.notification.update({ where: { key: record.key }, data: { status } });
    log('notification.result', { channel: record.channel, status });
    return { status, duplicate: false };
  },
};

