import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startHarness } from './harness.js';

const { db, call, makeUser, stop, prefix, base } = await startHarness();
const code = 'V' + prefix.toUpperCase();
after(() => stop(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: '@volunteer.invalid' }, username: { startsWith: code.toLowerCase() } } });
  await db.mahallu.deleteMany({ where: { code } });
}));

type Actor = Awaited<ReturnType<typeof makeUser>>;
const volunteerLogin = async (username: string, password: string) => {
  const res = await fetch(base + '/auth/volunteer-login', { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }) });
  const body = await res.json().catch(() => null);
  return { status: res.status, actor: res.ok ? ({ id: '', email: '', token: body.accessToken } as Actor) : undefined };
};

test('volunteers: generated login, animal status steps, meat stock, distribution and termination', async () => {
  const superAdmin = await makeUser('super', ['ADMIN']);
  const admin = await makeUser('vadmin');
  const rival = await makeUser('vrival');
  const member = await makeUser('vmember');
  const mahallu = (await call(superAdmin, 'post', '/mahallus', { name: 'Vol', district: 'D', code })).body;
  const other = (await call(superAdmin, 'post', '/mahallus', { name: 'Vol2', district: 'D', code: code + '2' })).body;
  await call(superAdmin, 'post', `/mahallus/${mahallu.id}/admins`, { email: admin.email, enabled: true });
  await call(superAdmin, 'post', `/mahallus/${other.id}/admins`, { email: rival.email, enabled: true });
  await call(admin, 'post', `/mahallus/${mahallu.id}/households/import`, { rows: [
    { mahalluNumber: '1', ownerName: 'Alice', memberCount: 3, address: 'a', phone: '9200000001' },
    { mahalluNumber: '2', ownerName: 'Bob', memberCount: 3, address: 'b', phone: '9200000002' }] });
  await call(member, 'post', '/me/households/link', { mahalluId: mahallu.id, mahalluNumber: '1', phone: '9200000001' });
  const homes = (await call(admin, 'get', `/mahallus/${mahallu.id}/households`)).body.rows as { id: string; mahalluNumber: string }[];
  const program = (await call(admin, 'post', `/mahallus/${mahallu.id}/programs`, { name: 'Udhiyya 2027', year: 2027, targetDate: '2027-05-26' })).body;
  for (const type of ['COW', 'SHEEP', 'CAMEL']) await call(admin, 'patch', `/programs/${program.id}/animals/${type}`, type === 'COW' ? { price: 70000 } : { enabled: false });
  await call(admin, 'patch', `/programs/${program.id}/animals/GOAT`, { price: 9000 });
  await call(admin, 'post', `/programs/${program.id}/start`, {});
  await call(admin, 'post', `/programs/${program.id}/bookings`, { householdId: homes[0].id, animalType: 'GOAT', shares: 2 });
  await call(admin, 'post', `/programs/${program.id}/allocate`, {});
  await call(admin, 'post', `/programs/${program.id}/draw`, { startAt: '2027-05-26T04:00:00Z', minutesPerAnimal: 15 });

  // Only the mahallu's admin creates volunteers, and each needs a role.
  const spec = { name: 'Ali Khan', phone: '9446000000', canStatus: true, canDistribute: false };
  assert.equal((await call(member, 'post', `/mahallus/${mahallu.id}/volunteers`, spec)).status, 403);
  assert.equal((await call(rival, 'post', `/mahallus/${mahallu.id}/volunteers`, spec)).status, 403);
  assert.equal((await call(admin, 'post', `/mahallus/${mahallu.id}/volunteers`, { ...spec, canStatus: false })).status, 400);
  const statusVol = await call(admin, 'post', `/mahallus/${mahallu.id}/volunteers`, spec);
  assert.equal(statusVol.status, 201);
  const { username, password } = statusVol.body as { username: string; password: string };
  assert.match(password, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  assert(username.startsWith(code.toLowerCase()));
  const distVol = (await call(admin, 'post', `/mahallus/${mahallu.id}/volunteers`, { name: 'Zaid', canStatus: false, canDistribute: true })).body;

  // Login: wrong credentials look alike; the right ones work and carry only the volunteer's roles.
  assert.equal((await volunteerLogin(username, 'wrong-password')).status, 401);
  assert.equal((await volunteerLogin('nobody-9999', password)).status, 401);
  const session = await volunteerLogin(username, password);
  assert.equal(session.status, 200);
  const me = (await call(session.actor, 'get', '/volunteer/me')).body;
  assert.deepEqual([me.canStatus, me.canDistribute, me.program.name], [true, false, 'Udhiyya 2027']);
  assert.equal((await call(session.actor, 'get', '/me/context')).body.volunteer.canStatus, true);
  assert.equal((await call(session.actor, 'get', '/volunteer/stock')).status, 403);
  assert.equal((await call(session.actor, 'get', `/mahallus/${mahallu.id}/households`)).status, 403);
  assert.equal((await call(session.actor, 'post', `/mahallus/${mahallu.id}/volunteers`, spec)).status, 403);

  // Animal status moves forward one step at a time.
  const animals = (await call(session.actor, 'get', '/volunteer/animals')).body as { id: string; code: string; status: string; drawOrder: number }[];
  assert.deepEqual(animals.map(a => a.drawOrder), [1, 2]);
  const first = animals[0];
  const step = (to: string) => call(session.actor, 'put', `/volunteer/animals/${first.id}/status`, { status: to });
  assert.equal((await step('PROCESSING')).status, 409);
  assert.equal((await step('SLAUGHTERED')).status, 200);
  assert.equal((await step('SLAUGHTERED')).status, 409);
  assert.equal((await step('PROCESSING')).status, 200);
  assert.equal((await step('PACKED')).status, 200);
  assert.equal((await step('PENDING')).status, 409);
  const activity = (await call(session.actor, 'get', '/volunteer/activity')).body as { type: string; title: string }[];
  assert.deepEqual(activity.map(row => [row.type, row.title]), [['ANIMAL', `${first.code} marked packed`]]);
  assert.equal((await call(member, 'get', '/volunteer/overview')).status, 403);
  assert.equal((await call(member, 'get', '/me/programs')).body[0].bookings[0].animals.some((a: { status: string }) => a.status === 'PACKED'), true);
  assert.equal((await call(member, 'put', `/volunteer/animals/${animals[1].id}/status`, { status: 'SLAUGHTERED' })).status, 403);
  // Admin can correct a mistake in either direction; others cannot.
  assert.equal((await call(rival, 'put', `/animals/${first.id}/status`, { status: 'PENDING' })).status, 403);
  assert.equal((await call(admin, 'put', `/animals/${first.id}/status`, { status: 'PROCESSING' })).body.status, 'PROCESSING');
  assert.equal((await call(session.actor, 'get', '/volunteer/animals')).body[0].status, 'PROCESSING');

  // Distribution: stock comes from the admin, cannot be overspent, and is tracked per household.
  const distSession = await volunteerLogin(distVol.username, distVol.password);
  assert.equal(distSession.status, 200);
  assert.equal((await call(distSession.actor, 'get', '/volunteer/animals')).status, 403);
  assert.equal((await call(distSession.actor, 'post', '/volunteer/distribute', { householdId: homes[0].id, packets: 1 })).status, 409);
  assert.equal((await call(admin, 'post', `/volunteers/${statusVol.body.volunteer.id}/issue`, { packets: 10 })).status, 409);
  assert.equal((await call(rival, 'post', `/volunteers/${distVol.volunteer.id}/issue`, { packets: 10 })).status, 403);
  const issued = await call(admin, 'post', `/volunteers/${distVol.volunteer.id}/issue`, { packets: 20, note: 'First batch' });
  assert.deepEqual([issued.status, issued.body.issued, issued.body.inHand], [201, 20, 20]);
  const search = (await call(distSession.actor, 'get', '/volunteer/households?q=ali')).body;
  assert.deepEqual(search.map((row: { ownerName: string; received: number }) => [row.ownerName, row.received]), [['Alice', 0]]);
  assert.equal((await call(distSession.actor, 'post', '/volunteer/distribute', { householdId: homes[0].id, packets: 21 })).status, 409);
  const handed = await call(distSession.actor, 'post', '/volunteer/distribute', { householdId: homes[0].id, packets: 5 });
  assert.deepEqual([handed.status, handed.body.distributed, handed.body.inHand], [201, 5, 15]);
  await call(distSession.actor, 'post', '/volunteer/distribute', { householdId: homes[1].id, packets: 3 });
  assert.equal((await call(distSession.actor, 'get', '/volunteer/households?q=alice')).body[0].received, 5);
  const otherHome = (await call(rival, 'post', `/mahallus/${other.id}/households`, { mahalluNumber: '9', ownerName: 'Far', memberCount: 1, address: 'x', phone: '9200000009' })).body;
  assert.equal((await call(distSession.actor, 'post', '/volunteer/distribute', { householdId: otherHome.id, packets: 1 })).status, 404);
  const stock = (await call(distSession.actor, 'get', '/volunteer/stock')).body;
  assert.deepEqual([stock.issued, stock.distributed, stock.inHand, stock.recent.length], [20, 8, 12, 2]);

  const dash = (await call(distSession.actor, 'get', '/volunteer/overview')).body;
  assert.deepEqual([dash.volunteer.canDistribute, dash.program.name, dash.animals.total, dash.meat.issued, dash.meat.distributed, dash.meat.inHand, dash.meat.programDistributed], [true, 'Udhiyya 2027', 2, 20, 8, 12, 8]);
  const statusDash = (await call(session.actor, 'get', '/volunteer/overview')).body;
  assert.deepEqual([statusDash.animals.pending, statusDash.animals.processing, statusDash.animals.packed], [1, 1, 0]);
  assert.deepEqual((await call(distSession.actor, 'get', '/volunteer/activity')).body.map((row: { type: string }) => row.type), ['HANDOVER', 'HANDOVER']);

  // The admin sees everything and can void a mistake.
  const overview = (await call(admin, 'get', `/programs/${program.id}/distribution`)).body;
  assert.deepEqual([overview.issued, overview.distributed, overview.inHand, overview.householdsServed], [20, 8, 12, 2]);
  assert.equal((await call(rival, 'get', `/programs/${program.id}/distribution`)).status, 403);
  assert.equal((await call(rival, 'post', `/distributions/${overview.rows[0].id}/void`, {})).status, 403);
  assert.equal((await call(admin, 'post', `/distributions/${overview.rows[0].id}/void`, {})).status, 200);
  assert.equal((await call(distSession.actor, 'get', '/volunteer/stock')).body.inHand, 15);

  // Password reset signs the volunteer out; termination ends access immediately.
  const reset = await call(admin, 'post', `/volunteers/${statusVol.body.volunteer.id}/reset-password`, {});
  assert.equal(reset.status, 200);
  assert.notEqual(reset.body.password, password);
  assert.equal((await call(session.actor, 'get', '/volunteer/animals')).status, 401);
  assert.equal((await volunteerLogin(username, password)).status, 401);
  const relogged = await volunteerLogin(username, reset.body.password);
  assert.equal(relogged.status, 200);
  assert.equal((await call(rival, 'post', `/volunteers/${statusVol.body.volunteer.id}/terminate`, {})).status, 403);
  assert.equal((await call(admin, 'post', `/volunteers/${statusVol.body.volunteer.id}/terminate`, {})).status, 200);
  assert.equal((await call(admin, 'post', `/volunteers/${statusVol.body.volunteer.id}/terminate`, {})).status, 409);
  assert.equal((await call(relogged.actor, 'get', '/volunteer/animals')).status, 401);
  assert.equal((await volunteerLogin(username, reset.body.password)).status, 401);
  assert.equal((await call(admin, 'patch', `/volunteers/${statusVol.body.volunteer.id}`, { canDistribute: true })).status, 409);
  const roster = (await call(admin, 'get', `/mahallus/${mahallu.id}/volunteers`)).body;
  assert.equal(roster.find((v: { id: string }) => v.id === statusVol.body.volunteer.id).terminatedAt !== null, true);
});
