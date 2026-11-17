import { route } from '../../lib/api.js';
import { limiter } from '../../lib/http.js';
import { currentUser, requireAuth, requirePermission } from '../../middleware/auth.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { adminInput, householdInput, householdUpdate, importInput, linkInput, mahalluInput, mahalluUpdate } from './mahallus.schema.js';
import { assertMahalluAdmin, mahalluService } from './mahallus.service.js';

const superAdmin = [requireAuth, requirePermission('mahallu.manage')];

// Super admin: manage mahallus and give access.
route({ method: 'get', path: '/mahallus', summary: 'List mahallus with admins and member counts (mahallu.manage required)',
  protected: true, middleware: superAdmin }, () => mahalluService.list());
route({ method: 'post', path: '/mahallus', summary: 'Create a mahallu (mahallu.manage required)', protected: true,
  status: 201, middleware: superAdmin, body: mahalluInput }, input => mahalluService.create(input));
route({ method: 'patch', path: '/mahallus/:id', summary: 'Rename, move or deactivate a mahallu (mahallu.manage required)',
  protected: true, middleware: superAdmin, body: mahalluUpdate },
(input, req) => mahalluService.update(idParam(req.params.id), input));
route({ method: 'post', path: '/mahallus/:id/admins', summary: 'Give or remove mahallu admin access by email (mahallu.manage required)',
  protected: true, middleware: superAdmin, body: adminInput },
(input, req) => mahalluService.setAdmin(idParam(req.params.id), input));

// Any signed-in user: pick a mahallu, link a household, see memberships.
route({ method: 'get', path: '/mahallus/directory', summary: 'Active mahallus to join', protected: true,
  middleware: [requireAuth] }, () => mahalluService.directory());
route({ method: 'get', path: '/me/context', summary: 'Your mahallu staff roles and linked households', protected: true,
  middleware: [requireAuth] }, (_input, req) => mahalluService.context(currentUser(req).id));
route({ method: 'post', path: '/me/households/link', summary: 'Link your account to a household with mahallu number and phone',
  protected: true, middleware: [requireAuth, limiter(10, 15 * 60_000)], body: linkInput },
(input, req) => mahalluService.link(currentUser(req).id, input));

// Mahallu admin: manage households.
route({ method: 'get', path: '/mahallus/:id/households', summary: 'Search a mahallu\'s households (mahallu admin)',
  protected: true, middleware: [requireAuth] }, async (_input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), id);
  return mahalluService.households(id, typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '');
});
route({ method: 'post', path: '/mahallus/:id/households', summary: 'Add one household (mahallu admin)', protected: true,
  status: 201, middleware: [requireAuth], body: householdInput }, async (input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), id);
  return mahalluService.addHousehold(id, input);
});
route({ method: 'post', path: '/mahallus/:id/households/import', summary: 'Import households from CSV or Excel rows (mahallu admin)',
  protected: true, middleware: [requireAuth, limiter(20, 60_000)], body: importInput }, async (input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), id);
  return mahalluService.importHouseholds(id, input.rows);
});
route({ method: 'patch', path: '/households/:id', summary: 'Edit a household (mahallu admin)', protected: true,
  middleware: [requireAuth], body: householdUpdate }, async (input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), await mahalluService.householdMahallu(id));
  return mahalluService.updateHousehold(id, input);
});
route({ method: 'delete', path: '/households/:id', summary: 'Remove a household (mahallu admin)', protected: true,
  middleware: [requireAuth] }, async (_input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), await mahalluService.householdMahallu(id));
  return mahalluService.removeHousehold(id);
});
