import { route } from '../../lib/api.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { dashboardService } from './dashboard.service.js';

route({ method: 'get', path: '/programs/:id/summary', summary: 'Money, animals and meat at a glance (mahallu admin)', protected: true, middleware: [requireAuth] },
(_input, req) => dashboardService.summary(currentUser(req), idParam(req.params.id)));
route({ method: 'get', path: '/programs/:id/transactions', summary: 'Every payment, expense and meat movement, newest first (mahallu admin)', protected: true,
  middleware: [requireAuth] }, (_input, req) => dashboardService.transactions(currentUser(req), idParam(req.params.id)));
