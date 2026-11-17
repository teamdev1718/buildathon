import { z } from 'zod';
import { route } from '../../lib/api.js';
import { db } from '../../lib/db.js';
import { currentUser, requireAuth, requirePermission } from '../../middleware/auth.js';
import { name } from '../auth/auth.schema.js';

route({ method: 'get', path: '/users/me', summary: 'Get your profile', protected: true,
  middleware: [requireAuth] }, (_input, req) => currentUser(req));
route({ method: 'patch', path: '/users/me', summary: 'Update your name, phone or notification preference', protected: true,
  middleware: [requireAuth], body: z.strictObject({ name: name.optional(), emailOptIn: z.boolean().optional(),
    phone: z.string().trim().regex(/^[0-9+\- ]{6,20}$/, 'Enter a valid phone number.').nullable().optional() }) },
async (input, req) => {
  const user = currentUser(req);
  const profile = await db.user.update({ where: { id: user.id }, data: input,
    select: { name: true, emailOptIn: true, phone: true } });
  return { ...user, ...profile };
});
route({ method: 'get', path: '/users', summary: 'List the latest 50 users (users.read required)', protected: true,
  middleware: [requireAuth, requirePermission('users.read')] }, () => db.user.findMany({
  take: 50, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, createdAt: true },
}));

