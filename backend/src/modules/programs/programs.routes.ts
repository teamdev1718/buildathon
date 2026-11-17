import { route } from '../../lib/api.js';
import { ApiError } from '../../lib/http.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { assertMahalluAdmin } from '../mahallus/mahallus.service.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { allocationService } from './allocation.service.js';
import { allocationInput, animalType, animalUpdate, bookingInput, bookingUpdate, drawInput, empty, orderInput, programInput, programUpdate } from './programs.schema.js';
import { programService } from './programs.service.js';

const auth = [requireAuth];

route({ method: 'get', path: '/mahallus/:id/programs', summary: 'List a mahallu\'s programs (mahallu admin)', protected: true,
  middleware: auth }, async (_input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), id);
  return programService.list(id);
});
route({ method: 'post', path: '/mahallus/:id/programs', summary: 'Create a program such as Udhiyya 2027 (mahallu admin)',
  protected: true, status: 201, middleware: auth, body: programInput }, async (input, req) => {
  const id = idParam(req.params.id);
  await assertMahalluAdmin(currentUser(req), id);
  return programService.create(id, input);
});

route({ method: 'get', path: '/me/programs', summary: 'Programs open to your household, with your bookings', protected: true,
  middleware: auth }, (_input, req) => programService.mine(currentUser(req).id));

route({ method: 'get', path: '/programs/:id', summary: 'One program with animal prices (mahallu members and admins)', protected: true,
  middleware: auth }, (_input, req) => programService.get(currentUser(req), idParam(req.params.id)));
route({ method: 'patch', path: '/programs/:id', summary: 'Edit program details (mahallu admin)', protected: true,
  middleware: auth, body: programUpdate }, (input, req) => programService.update(currentUser(req), idParam(req.params.id), input));
route({ method: 'patch', path: '/programs/:id/animals/:type', summary: 'Set an animal\'s price or availability, any time (mahallu admin)',
  protected: true, middleware: auth, body: animalUpdate }, (input, req) => {
  const type = animalType.safeParse(req.params.type);
  if (!type.success) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
  return programService.updateAnimal(currentUser(req), idParam(req.params.id), type.data, input);
});
route({ method: 'post', path: '/programs/:id/start', summary: 'Start a program so households can book (mahallu admin)',
  protected: true, middleware: auth, body: empty }, (_input, req) => programService.start(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/programs/:id/end', summary: 'End a running program (mahallu admin)', protected: true,
  middleware: auth, body: empty }, (_input, req) => programService.end(currentUser(req), idParam(req.params.id)));

route({ method: 'get', path: '/programs/:id/bookings', summary: 'Bookings with animals needed per type (mahallu admin)',
  protected: true, middleware: auth }, (_input, req) => programService.bookings(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/programs/:id/bookings', summary: 'Book shares for a household (owner or mahallu admin)',
  protected: true, status: 201, middleware: auth, body: bookingInput },
(input, req) => programService.book(currentUser(req), idParam(req.params.id), input));
route({ method: 'patch', path: '/bookings/:id', summary: 'Change shares or payment mode while the program is open', protected: true,
  middleware: auth, body: bookingUpdate }, (input, req) => programService.changeBooking(currentUser(req), idParam(req.params.id), input));
route({ method: 'delete', path: '/bookings/:id', summary: 'Cancel a booking while the program is open', protected: true,
  middleware: auth }, (_input, req) => programService.cancelBooking(currentUser(req), idParam(req.params.id)));

route({ method: 'get', path: '/programs/:id/allocation', summary: 'Animals, their codes and who holds each share (mahallu admin)',
  protected: true, middleware: auth }, (_input, req) => allocationService.view(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/programs/:id/allocate', summary: 'Create animals with unique codes and auto-allocate every booking; replaces earlier allocation (mahallu admin)',
  protected: true, middleware: auth, body: empty }, (_input, req) => allocationService.allocate(currentUser(req), idParam(req.params.id)));
route({ method: 'put', path: '/bookings/:id/allocation', summary: 'Manually place the shares of a booking on animals (mahallu admin)',
  protected: true, middleware: auth, body: allocationInput }, (input, req) => allocationService.editBooking(currentUser(req), idParam(req.params.id), input));
route({ method: 'post', path: '/programs/:id/draw', summary: 'Randomly draw the slaughter order and time slots (mahallu admin)',
  protected: true, middleware: auth, body: drawInput }, (input, req) => allocationService.draw(currentUser(req), idParam(req.params.id), input));
route({ method: 'put', path: '/programs/:id/order', summary: 'Set the slaughter order by hand after the draw (mahallu admin)',
  protected: true, middleware: auth, body: orderInput }, (input, req) => allocationService.reorder(currentUser(req), idParam(req.params.id), input.animalIds));
