import { env, telegramEnabled } from '../../config/env.js';
import { db } from '../../lib/db.js';
import { ApiError, log } from '../../lib/http.js';
import { digest, equal, secret } from '../../lib/secrets.js';
import type { TelegramUpdate } from './telegram.schema.js';

function ensureTelegram() {
  if (!telegramEnabled) throw new ApiError(503, 'TELEGRAM_DISABLED', 'Telegram is unavailable.');
}

export function validateWebhook(header: string | undefined) {
  ensureTelegram();
  if (!header || !equal(header, env.TELEGRAM_WEBHOOK_SECRET ?? '')) {
    throw new ApiError(403, 'WEBHOOK_DENIED', 'Webhook credentials are invalid.');
  }
}

export async function sendTelegram(chatId: string, text: string) {
  ensureTelegram();
  try {
    const response = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Rejected');
    }
    const result = await response.json() as { ok?: boolean };
    if (result.ok !== true) throw new Error('Rejected');
  } catch {
    log('telegram.delivery_failed');
    throw new ApiError(503, 'TELEGRAM_UNAVAILABLE', 'Telegram delivery could not be confirmed.');
  }
}

export async function createLink(userId: string) {
  ensureTelegram();
  const code = secret();
  const fields = { digest: digest(code), expiresAt: new Date(Date.now() + 600_000) };
  await db.telegramLink.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
  return { url: 'https://t.me/' + env.TELEGRAM_BOT_USERNAME + '?start=' + code };
}

export async function disconnectTelegram(userId: string) {
  await db.$transaction([
    db.telegramLink.deleteMany({ where: { userId } }),
    db.user.update({ where: { id: userId }, data: { telegramChatId: null } }),
  ]);
  return { ok: true };
}

export async function handleTelegram(update: TelegramUpdate) {
  const message = update.message;
  if (message?.chat.type !== 'private' || !message.text) return { ok: true };
  const [command, value] = message.text.trim().split(/\s+/, 2);
  const chatId = String(message.chat.id);
  const reply = await db.$transaction(async tx => {
    const inserted = await tx.telegramUpdate.createMany({ data: { id: String(update.update_id) }, skipDuplicates: true });
    if (!inserted.count) return;
    switch (command) {
      case '/start': {
        if (!value || !/^[\w-]{43}$/.test(value)) return 'Open your profile in the app to connect this chat.';
        const hash = digest(value);
        const link = await tx.telegramLink.findUnique({ where: { digest: hash } });
        if (!link || !(await tx.telegramLink.deleteMany({
          where: { userId: link.userId, digest: hash, expiresAt: { gt: new Date() } },
        })).count) return 'This link has expired. Request a new one in the app.';
        const existing = await tx.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true } });
        if (existing && existing.id !== link.userId) return 'Disconnect this chat before connecting another account.';
        await tx.user.update({ where: { id: link.userId }, data: { telegramChatId: chatId } });
        return 'Connected. Use /stop or the profile page to disconnect.';
      }
      case '/stop':
        await tx.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } });
        return 'Telegram notifications are disconnected.';
      case '/status':
        return (await tx.user.count({ where: { telegramChatId: chatId } })) ? 'Connected.' : 'No account is connected.';
      default:
        return 'Use /start to connect, /status to check your connection, or /stop to disconnect.';
    }
  });
  // Claim before the network call to prevent duplicate sends on webhook retries.
  if (reply) await sendTelegram(chatId, reply).catch(() => {});
  return { ok: true };
}

