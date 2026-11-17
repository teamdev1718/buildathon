import { z } from 'zod';
import { route } from '../../lib/api.js';
import { ApiError, limiter } from '../../lib/http.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { empty } from './programs.schema.js';
import { paymentService } from './payments.service.js';

declare module 'express-serve-static-core' {
  interface Request { rawBody?: Buffer }
}

const auth = [requireAuth];
const rupees = z.number().int().min(1).max(10_000_000);

route({ method: 'get', path: '/payments/config', summary: 'Whether online payments are available', protected: true, middleware: auth },
() => paymentService.config());

route({ method: 'post', path: '/bookings/:id/payments/online', summary: 'Start a Razorpay payment for your own booking', protected: true,
  status: 201, middleware: [requireAuth, limiter(20, 60_000)], body: z.strictObject({ amount: rupees }) },
(input, req) => paymentService.startOnline(currentUser(req), idParam(req.params.id), input.amount));
route({ method: 'post', path: '/payments/:id/verify', summary: 'Confirm a Razorpay payment using the signature from checkout', protected: true,
  middleware: [requireAuth, limiter(30, 60_000)], body: z.strictObject({ razorpayPaymentId: z.string().min(5).max(64), signature: z.string().min(20).max(128) }) },
(input, req) => paymentService.verifyOnline(currentUser(req), idParam(req.params.id), input));
route({ method: 'post', path: '/integrations/razorpay/webhook', summary: 'Razorpay server-to-server payment notifications (signed)',
  middleware: [limiter(120, 60_000)], body: z.looseObject({}) }, (input, req) => {
  const signature = req.get('X-Razorpay-Signature');
  if (!signature || !req.rawBody) throw new ApiError(401, 'BAD_SIGNATURE', 'Invalid signature.');
  return paymentService.webhook(req.rawBody, signature, input);
});

route({ method: 'post', path: '/bookings/:id/payments/cash', summary: 'Record cash handed over to the committee (mahallu admin)', protected: true,
  status: 201, middleware: auth, body: z.strictObject({ amount: rupees, note: z.string().trim().min(1).max(200).optional() }) },
(input, req) => paymentService.recordCash(currentUser(req), idParam(req.params.id), input.amount, input.note));
route({ method: 'post', path: '/payments/:id/void', summary: 'Void a cash payment recorded by mistake (mahallu admin)', protected: true,
  middleware: auth, body: z.strictObject({ note: z.string().trim().min(3).max(200) }) },
(input, req) => paymentService.voidCash(currentUser(req), idParam(req.params.id), input.note));
route({ method: 'put', path: '/bookings/:id/autopay', summary: 'Turn payment autopay reminders on or off for your booking', protected: true,
  middleware: auth, body: z.strictObject({ enabled: z.boolean() }) },
(input, req) => paymentService.setAutopay(currentUser(req), idParam(req.params.id), input.enabled));

route({ method: 'get', path: '/me/payments', summary: 'Your payment history', protected: true, middleware: auth },
(_input, req) => paymentService.history(currentUser(req).id));
route({ method: 'get', path: '/programs/:id/payments', summary: 'Totals and every transaction in a program (mahallu admin)', protected: true,
  middleware: auth }, (_input, req) => paymentService.programPayments(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/programs/:id/reminders', summary: 'Send payment reminders to households behind schedule (mahallu admin)',
  protected: true, middleware: auth, body: empty }, (_input, req) => paymentService.sendReminders(currentUser(req), idParam(req.params.id)));
