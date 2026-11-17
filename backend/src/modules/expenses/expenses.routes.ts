import { route } from '../../lib/api.js';
import { limiter } from '../../lib/http.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { idParam } from '../udhiyya/udhiyya.schema.js';
import { expenseInput, expenseService, expenseUpdate, voidInput } from './expenses.service.js';

const auth = [requireAuth];
const open = [limiter(120, 60_000)];

// Public: anyone can read a program's books.
route({ method: 'get', path: '/public/ledgers', summary: 'Programs whose income and expenses are public', middleware: open }, () => expenseService.publicIndex());
route({ method: 'get', path: '/public/ledgers/:id', summary: 'Public ledger: money collected, expenses, animals and meat progress', middleware: open },
(_input, req) => expenseService.publicLedger(idParam(req.params.id)));

// Mahallu admin: record expenses.
route({ method: 'get', path: '/programs/:id/expenses', summary: 'Expenses including voided ones (mahallu admin)', protected: true, middleware: auth },
(_input, req) => expenseService.list(currentUser(req), idParam(req.params.id)));
route({ method: 'post', path: '/programs/:id/expenses', summary: 'Record an expense that appears on the public ledger (mahallu admin)', protected: true,
  status: 201, middleware: auth, body: expenseInput }, (input, req) => expenseService.add(currentUser(req), idParam(req.params.id), input));
route({ method: 'patch', path: '/expenses/:id', summary: 'Correct an expense (mahallu admin)', protected: true, middleware: auth, body: expenseUpdate },
(input, req) => expenseService.update(currentUser(req), idParam(req.params.id), input));
route({ method: 'post', path: '/expenses/:id/void', summary: 'Void an expense with a reason; it stays visible on the ledger (mahallu admin)', protected: true,
  middleware: auth, body: voidInput }, (input, req) => expenseService.void(currentUser(req), idParam(req.params.id), input.reason));
