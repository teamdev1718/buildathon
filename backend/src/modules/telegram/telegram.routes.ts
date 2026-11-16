import { route } from '../../lib/api.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { telegramUpdate } from './telegram.schema.js';
import { createLink, disconnectTelegram, handleTelegram, validateWebhook } from './telegram.service.js';

route({ method: 'post', path: '/integrations/telegram/webhook', body: telegramUpdate,
  summary: 'Receive authenticated Telegram updates', middleware: [(req, _res, next) => {
    validateWebhook(req.get('X-Telegram-Bot-Api-Secret-Token'));
    next();
  }] }, handleTelegram);
route({ method: 'post', path: '/integrations/telegram/link', protected: true,
  middleware: [requireAuth], summary: 'Create a one-time Telegram opt-in link' },
(_input, req) => createLink(currentUser(req).id));
route({ method: 'delete', path: '/integrations/telegram/link', protected: true,
  middleware: [requireAuth], summary: 'Revoke Telegram notification opt-in' },
(_input, req) => disconnectTelegram(currentUser(req).id));

