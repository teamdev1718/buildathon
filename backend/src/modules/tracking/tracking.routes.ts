import { z } from 'zod';
import { route } from '../../lib/api.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { trackingService } from './tracking.service.js';

const auth = [requireAuth];

route({ method: 'get', path: '/me/tracking', summary: 'Where your animals are in the queue, and meat handed to your household', protected: true, middleware: auth },
(_input, req) => trackingService.tracking(currentUser(req).id));
route({ method: 'post', path: '/distributions/:id/confirm', summary: 'Confirm that your household received the meat', protected: true,
  middleware: auth, body: z.strictObject({}) }, (_input, req) => trackingService.confirmReceipt(currentUser(req).id, idParam(req.params.id)));
route({ method: 'get', path: '/me/inbox', summary: 'Your notifications', protected: true, middleware: auth },
(_input, req) => trackingService.inbox(currentUser(req).id));
route({ method: 'post', path: '/me/inbox/read', summary: 'Mark notifications as read (all when no ids are given)', protected: true, middleware: auth,
  body: z.strictObject({ ids: z.array(z.uuid()).max(100).optional() }) }, (input, req) => trackingService.markRead(currentUser(req).id, input.ids));
