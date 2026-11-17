import { route } from '../../lib/api.js';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { cycleService } from './cycle.service.js';
import { enrollmentService } from './enrollment.service.js';
import { animalInput, collectorInput, cycleInput, idParam, planInput, statusInput } from './udhiyya.schema.js';

const manage = [requireAuth, requirePermission('udhiyya.manage')];

route({ method: 'get', path: '/udhiyya/cycle', summary: 'Get the open Udhiyya cycle with its animal plans',
  protected: true, middleware: [requireAuth] }, async () => ({ cycle: await cycleService.current() }));

route({ method: 'get', path: '/udhiyya/cycles', summary: 'List Udhiyya cycles (udhiyya.manage required)',
  protected: true, middleware: manage }, () => cycleService.list());

route({ method: 'post', path: '/udhiyya/cycles', summary: 'Start a new Udhiyya cycle (udhiyya.manage required)',
  protected: true, status: 201, middleware: manage, body: cycleInput }, input => cycleService.create(input));

route({ method: 'post', path: '/udhiyya/cycles/:id/plans', summary: 'Add an animal plan to a cycle (udhiyya.manage required)',
  protected: true, status: 201, middleware: manage, body: planInput },
(input, req) => cycleService.addPlan(idParam(req.params.id), input));

route({ method: 'patch', path: '/udhiyya/cycles/:id', summary: 'Move a cycle to its next stage (udhiyya.manage required)',
  protected: true, middleware: manage, body: statusInput },
(input, req) => cycleService.advance(idParam(req.params.id), input.status));

route({ method: 'get', path: '/udhiyya/cycles/:id/summary', summary: 'Collections, shares and animals needed (udhiyya.manage required)',
  protected: true, middleware: manage }, (_input, req) => cycleService.summary(idParam(req.params.id)));

route({ method: 'get', path: '/udhiyya/cycles/:id/animals', summary: 'List purchased animals (udhiyya.manage required)',
  protected: true, middleware: manage }, (_input, req) => cycleService.animals(idParam(req.params.id)));

route({ method: 'post', path: '/udhiyya/cycles/:id/animals', summary: 'Record a purchased animal (udhiyya.manage required)',
  protected: true, status: 201, middleware: manage, body: animalInput },
(input, req) => cycleService.addAnimal(idParam(req.params.id), input));

route({ method: 'post', path: '/udhiyya/cycles/:id/reminders', summary: 'Remind members who are behind schedule (udhiyya.manage required)',
  protected: true, middleware: manage }, (_input, req) => enrollmentService.sendReminders(idParam(req.params.id)));

route({ method: 'post', path: '/udhiyya/collectors', summary: 'Grant or remove the collector role by email (udhiyya.manage required)',
  protected: true, middleware: manage, body: collectorInput }, async input => {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user?.verifiedAt) throw new ApiError(404, 'USER_NOT_FOUND', 'No verified account has that email.');
  const key = { userId_roleName: { userId: user.id, roleName: 'COLLECTOR' } };
  if (input.enabled) await db.userRole.upsert({ where: key, create: key.userId_roleName, update: {} });
  else await db.userRole.deleteMany({ where: key.userId_roleName });
  return { email: user.email, collector: input.enabled };
});
