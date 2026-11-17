import { z } from 'zod';
import { route } from '../../lib/api.js';
import { limiter } from '../../lib/http.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { sendSession } from '../auth/session.service.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { distributeInput, issueInput, statusInput, volunteerInput, volunteerLogin, volunteerUpdate } from './volunteers.schema.js';
import { volunteerService } from './volunteers.service.js';

const auth = [requireAuth];
const empty = z.strictObject({});

route({ method: 'post', path: '/auth/volunteer-login', summary: 'Sign in a volunteer with the username and password the admin generated',
  middleware: [limiter(40, 15 * 60_000)], body: volunteerLogin }, async (input, _req, res) => sendSession(res, await volunteerService.login(input)));

// Mahallu admin: manage volunteers.
route({ method: 'get', path: '/mahallus/:id/volunteers', summary: 'List volunteers with their meat stock (mahallu admin)', protected: true,
  middleware: auth }, (_input, req) => volunteerService.list(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/mahallus/:id/volunteers', summary: 'Create a volunteer; the generated password is shown once (mahallu admin)',
  protected: true, status: 201, middleware: auth, body: volunteerInput },
(input, req) => volunteerService.create(currentUser(req), idParam(req.params.id), input));
route({ method: 'patch', path: '/volunteers/:id', summary: 'Change a volunteer\'s name or roles (mahallu admin)', protected: true,
  middleware: auth, body: volunteerUpdate }, (input, req) => volunteerService.update(currentUser(req), idParam(req.params.id), input));
route({ method: 'post', path: '/volunteers/:id/reset-password', summary: 'Generate a new password and sign the volunteer out (mahallu admin)',
  protected: true, middleware: auth, body: empty }, (_input, req) => volunteerService.resetPassword(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/volunteers/:id/terminate', summary: 'End a volunteer\'s access immediately (mahallu admin)', protected: true,
  middleware: auth, body: empty }, (_input, req) => volunteerService.terminate(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/volunteers/:id/issue', summary: 'Hand packets of meat to a distribution volunteer (mahallu admin)', protected: true,
  status: 201, middleware: auth, body: issueInput }, (input, req) => volunteerService.issue(currentUser(req), idParam(req.params.id), input.packets, input.note));
route({ method: 'get', path: '/programs/:id/distribution', summary: 'Packets issued, handed out and to whom (mahallu admin)', protected: true,
  middleware: auth }, (_input, req) => volunteerService.overview(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/distributions/:id/void', summary: 'Remove a distribution entered by mistake (mahallu admin)', protected: true,
  middleware: auth, body: empty }, (_input, req) => volunteerService.voidDistribution(currentUser(req), idParam(req.params.id)));
route({ method: 'put', path: '/animals/:id/status', summary: 'Set an animal\'s status to any step to correct a mistake (mahallu admin)', protected: true,
  middleware: auth, body: statusInput }, (input, req) => volunteerService.setStatus(currentUser(req), idParam(req.params.id), input.status));

// Volunteers: their own work.
route({ method: 'get', path: '/volunteer/me', summary: 'Your volunteer profile and the running program', protected: true, middleware: auth },
(_input, req) => volunteerService.me(currentUser(req).id));
route({ method: 'get', path: '/volunteer/overview', summary: 'Animal progress and your meat packets at a glance (volunteers)', protected: true, middleware: auth },
(_input, req) => volunteerService.dashboard(currentUser(req).id));
route({ method: 'get', path: '/volunteer/activity', summary: 'Your recent animal updates and handovers (volunteers)', protected: true, middleware: auth },
(_input, req) => volunteerService.activity(currentUser(req).id));
route({ method: 'get', path: '/volunteer/animals', summary: 'Animals in slaughter order with their status (status volunteers)', protected: true, middleware: auth },
(_input, req) => volunteerService.animals(currentUser(req).id));
route({ method: 'put', path: '/volunteer/animals/:id/status', summary: 'Move an animal to the next step: slaughtered, processing, packed (status volunteers)',
  protected: true, middleware: auth, body: statusInput }, (input, req) => volunteerService.advance(currentUser(req).id, idParam(req.params.id), input.status));
route({ method: 'get', path: '/volunteer/stock', summary: 'Packets given to you, handed out and in hand (distribution volunteers)', protected: true, middleware: auth },
(_input, req) => volunteerService.stock(currentUser(req).id));
route({ method: 'get', path: '/volunteer/households', summary: 'Find households to give packets to (distribution volunteers)', protected: true, middleware: auth },
(_input, req) => volunteerService.households(currentUser(req).id, typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : ''));
route({ method: 'post', path: '/volunteer/distribute', summary: 'Record packets handed to a household (distribution volunteers)', protected: true,
  status: 201, middleware: [requireAuth, limiter(120, 60_000)], body: distributeInput },
(input, req) => volunteerService.distribute(currentUser(req).id, input));
