import { z } from 'zod';
import { route } from '../../lib/api.js';
import { currentUser, requireAuth, requirePermission } from '../../middleware/auth.js';
import { enrollmentService } from './enrollment.service.js';
import { cashPaymentInput, enrollInput, idParam, onlinePaymentInput } from './udhiyya.schema.js';

const collect = [requireAuth, requirePermission('udhiyya.collect')];
const empty = z.strictObject({});

route({ method: 'post', path: '/udhiyya/enrollments', summary: 'Enrol in an animal plan and get a monthly installment',
  protected: true, status: 201, middleware: [requireAuth], body: enrollInput },
(input, req) => enrollmentService.enroll(currentUser(req).id, input));

route({ method: 'get', path: '/udhiyya/enrollments/mine', summary: 'Your enrolments with balance and payment history',
  protected: true, middleware: [requireAuth] }, (_input, req) => enrollmentService.mine(currentUser(req).id));

route({ method: 'post', path: '/udhiyya/enrollments/:id/online-payments',
  summary: 'Report an online (UPI) payment for collector confirmation', protected: true, status: 201,
  middleware: [requireAuth], body: onlinePaymentInput }, async (input, req) => {
  const payment = await enrollmentService.submitOnline(currentUser(req).id, idParam(req.params.id), input);
  return { id: payment.id, status: payment.status };
});

route({ method: 'get', path: '/udhiyya/enrollments', summary: 'Find enrolments by member name or email (udhiyya.collect required)',
  protected: true, middleware: collect },
(_input, req) => enrollmentService.search(typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : ''));

route({ method: 'post', path: '/udhiyya/enrollments/:id/cash-payments', summary: 'Record a cash payment (udhiyya.collect required)',
  protected: true, status: 201, middleware: collect, body: cashPaymentInput }, async (input, req) => {
  const payment = await enrollmentService.recordCash(currentUser(req).id, idParam(req.params.id), input.amount);
  return { id: payment.id, status: payment.status };
});

route({ method: 'get', path: '/udhiyya/payments/pending', summary: 'Online payments waiting for confirmation (udhiyya.collect required)',
  protected: true, middleware: collect }, () => enrollmentService.pending());

route({ method: 'post', path: '/udhiyya/payments/:id/confirm', summary: 'Confirm an online payment (udhiyya.collect required)',
  protected: true, middleware: collect, body: empty }, async (_input, req) => {
  const payment = await enrollmentService.review(currentUser(req).id, idParam(req.params.id), true);
  return { id: payment.id, status: payment.status };
});

route({ method: 'post', path: '/udhiyya/payments/:id/reject', summary: 'Reject an online payment (udhiyya.collect required)',
  protected: true, middleware: collect, body: empty }, async (_input, req) => {
  const payment = await enrollmentService.review(currentUser(req).id, idParam(req.params.id), false);
  return { id: payment.id, status: payment.status };
});
