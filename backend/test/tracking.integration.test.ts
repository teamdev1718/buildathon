import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startHarness } from './harness.js';

const { db, call, makeUser, stop, prefix, base } = await startHarness();
const code = 'K' + prefix.toUpperCase();
after(() => stop(async () => {
  await db.user.deleteMany({ where: { username: { startsWith: code.toLowerCase() } } });
  await db.mahallu.deleteMany({ where: { code } });
}));

type Actor = Awaited<ReturnType<typeof makeUser>>;
async function volunteerLogin(username: string, password: string) {
  const res = await fetch(base + '/auth/volunteer-login', { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }) });
  return { id: '', email: '', token: (await res.json()).accessToken } as Actor;
}
const publicGet = async (path: string) => { const res = await fetch(base + path); return { status: res.status, body: await res.json().catch(() => null) }; };

test('tracking, notifications, receipt confirmation, expenses, public ledger and the admin dashboard', async () => {
  const superAdmin = await makeUser('super', ['ADMIN']);
  const admin = await makeUser('kadmin');
  const alice = await makeUser('kalice');
  const bob = await makeUser('kbob');
  const outsider = await makeUser('koutsider');
  const mahallu = (await call(superAdmin, 'post', '/mahallus', { name: 'Track', district: 'D', code })).body;
  await call(superAdmin, 'post', `/mahallus/${mahallu.id}/admins`, { email: admin.email, enabled: true });
  await call(admin, 'post', `/mahallus/${mahallu.id}/households/import`, { rows: [
    { mahalluNumber: '1', ownerName: 'Alice Secretname', memberCount: 3, address: 'a', phone: '9300000001' },
    { mahalluNumber: '2', ownerName: 'Bob Hiddenname', memberCount: 3, address: 'b', phone: '9300000002' }] });
  await call(alice, 'post', '/me/households/link', { mahalluId: mahallu.id, mahalluNumber: '1', phone: '9300000001' });
  await call(bob, 'post', '/me/households/link', { mahalluId: mahallu.id, mahalluNumber: '2', phone: '9300000002' });
  const homes = (await call(admin, 'get', `/mahallus/${mahallu.id}/households`)).body.rows as { id: string; mahalluNumber: string }[];
  const home = (n: string) => homes.find(row => row.mahalluNumber === n)!.id;
  const program = (await call(admin, 'post', `/mahallus/${mahallu.id}/programs`, { name: 'Udhiyya 2027', year: 2027, targetDate: '2027-05-26', payByDate: '2027-05-01' })).body;
  for (const type of ['COW', 'SHEEP', 'CAMEL']) await call(admin, 'patch', `/programs/${program.id}/animals/${type}`, { enabled: false });
  await call(admin, 'patch', `/programs/${program.id}/animals/GOAT`, { price: 9000 });

  // Drafts have no public books; expenses wait for the program to start.
  assert.equal((await publicGet(`/public/ledgers/${program.id}`)).status, 404);
  assert.equal((await call(admin, 'post', `/programs/${program.id}/expenses`, { title: 'Early', category: 'OTHER', amount: 100, spentOn: '2027-01-01' })).status, 409);
  await call(admin, 'post', `/programs/${program.id}/start`, {});
  const aliceBooking = (await call(alice, 'post', `/programs/${program.id}/bookings`, { householdId: home('1'), animalType: 'GOAT', shares: 1 })).body;
  await call(bob, 'post', `/programs/${program.id}/bookings`, { householdId: home('2'), animalType: 'GOAT', shares: 1 });
  await call(admin, 'post', `/programs/${program.id}/allocate`, {});
  const drawn = (await call(admin, 'post', `/programs/${program.id}/draw`, { startAt: '2027-05-26T04:00:00Z', minutesPerAnimal: 15 })).body;
  const byCode = (c: string) => drawn.animals.find((a: { code: string }) => a.code === c).id as string;
  await call(admin, 'put', `/programs/${program.id}/order`, { animalIds: [byCode('GOT-01'), byCode('GOT-02')] });

  // Volunteers.
  const statusVol = (await call(admin, 'post', `/mahallus/${mahallu.id}/volunteers`, { name: 'Stat', canStatus: true, canDistribute: false })).body;
  const distVol = (await call(admin, 'post', `/mahallus/${mahallu.id}/volunteers`, { name: 'Dist', canStatus: false, canDistribute: true })).body;
  const stat = await volunteerLogin(statusVol.username, statusVol.password);
  const dist = await volunteerLogin(distVol.username, distVol.password);

  // Queue position before anything happens: Bob's animal has one ahead.
  const first = (await call(alice, 'get', '/me/tracking')).body.programs[0];
  const second = (await call(bob, 'get', '/me/tracking')).body.programs[0];
  assert.deepEqual([first.animals[0].code, first.animals[0].ahead, second.animals[0].code, second.animals[0].ahead], ['GOT-01', 0, 'GOT-02', 1]);
  assert.deepEqual([second.queue.total, second.queue.pending, second.queue.upNext.code], [2, 2, 'GOT-01']);
  assert.equal((await call(outsider, 'get', '/me/tracking')).body.programs.length, 0);
  assert.equal((await call(bob, 'get', '/me/inbox')).body.unread, 0);

  // Slaughtering GOT-01 tells Alice, and tells Bob his animal is next, exactly once.
  const animalsOf = (await call(stat, 'get', '/volunteer/animals')).body as { id: string; code: string }[];
  const got1 = animalsOf.find(a => a.code === 'GOT-01')!.id;
  assert.equal((await call(stat, 'put', `/volunteer/animals/${got1}/status`, { status: 'SLAUGHTERED' })).status, 200);
  const bobInbox = (await call(bob, 'get', '/me/inbox')).body;
  assert.deepEqual(bobInbox.items.map((i: { kind: string; title: string }) => [i.kind, i.title]), [['animal.next', 'GOT-02 is next']]);
  assert.equal(bobInbox.unread, 1);
  assert.equal((await call(alice, 'get', '/me/inbox')).body.items[0].title, 'GOT-01 has been slaughtered');
  assert.equal((await call(admin, 'put', `/animals/${got1}/status`, { status: 'SLAUGHTERED' })).status, 200);
  assert.equal((await call(bob, 'get', '/me/inbox')).body.items.length, 1);
  const after = (await call(bob, 'get', '/me/tracking')).body.programs[0];
  assert.deepEqual([after.animals[0].ahead, after.queue.slaughtered, after.queue.upNext.code], [0, 1, 'GOT-02']);
  await call(stat, 'put', `/volunteer/animals/${got1}/status`, { status: 'PROCESSING' });
  await call(stat, 'put', `/volunteer/animals/${got1}/status`, { status: 'PACKED' });
  assert.equal((await call(alice, 'get', '/me/inbox')).body.items[0].title, 'GOT-01 is packed');
  assert.equal((await call(bob, 'post', '/me/inbox/read', { ids: [bobInbox.items[0].id] })).body.unread, 0);
  assert.equal((await call(alice, 'post', '/me/inbox/read', {})).body.unread, 0);

  // Meat reaches Alice's household; only she can confirm it, and only once.
  await call(admin, 'post', `/volunteers/${distVol.volunteer.id}/issue`, { packets: 10 });
  const handed = await call(dist, 'post', '/volunteer/distribute', { householdId: home('1'), packets: 3 });
  assert.equal(handed.status, 201);
  assert.equal((await call(alice, 'get', '/me/inbox')).body.items[0].kind, 'meat.given');
  const handover = (await call(alice, 'get', '/me/tracking')).body.programs[0].handovers[0];
  assert.deepEqual([handover.packets, handover.receivedAt], [3, null]);
  assert.equal((await call(bob, 'post', `/distributions/${handover.id}/confirm`, {})).status, 404);
  assert.equal((await call(alice, 'post', `/distributions/${handover.id}/confirm`, {})).status, 200);
  assert.equal((await call(alice, 'post', `/distributions/${handover.id}/confirm`, {})).status, 200);
  assert.notEqual((await call(alice, 'get', '/me/tracking')).body.programs[0].handovers[0].receivedAt, null);
  assert.equal((await call(bob, 'get', '/me/tracking')).body.programs[0].handovers.length, 0);

  // Money and expenses.
  await call(admin, 'post', `/bookings/${aliceBooking.id}/payments/cash`, { amount: 9000 });
  const rice = await call(admin, 'post', `/programs/${program.id}/expenses`, { title: 'Transport of animals', category: 'TRANSPORT', amount: 2500, spentOn: '2027-05-20', note: 'Pickup truck' });
  assert.equal(rice.status, 201);
  const mistake = (await call(admin, 'post', `/programs/${program.id}/expenses`, { title: 'Entered twice', category: 'OTHER', amount: 700, spentOn: '2027-05-21' })).body;
  assert.equal((await call(alice, 'post', `/programs/${program.id}/expenses`, { title: 'x', category: 'OTHER', amount: 1, spentOn: '2027-05-21' })).status, 403);
  assert.equal((await call(alice, 'post', `/expenses/${rice.body.id}/void`, { reason: 'because' })).status, 403);
  assert.equal((await call(admin, 'patch', `/expenses/${rice.body.id}`, { amount: 3000 })).body.amount, 3000);
  assert.equal((await call(admin, 'post', `/expenses/${mistake.id}/void`, { reason: 'Entered twice by mistake' })).status, 200);
  assert.equal((await call(admin, 'post', `/expenses/${mistake.id}/void`, { reason: 'Entered twice by mistake' })).status, 409);
  assert.equal((await call(admin, 'patch', `/expenses/${mistake.id}`, { amount: 5 })).status, 409);

  // The public ledger needs no sign-in, adds up, shows voided entries, and exposes no household.
  const index = await publicGet('/public/ledgers');
  assert.equal(index.body.some((row: { id: string }) => row.id === program.id), true);
  const ledger = await publicGet(`/public/ledgers/${program.id}`);
  assert.equal(ledger.status, 200);
  assert.deepEqual([ledger.body.collected, ledger.body.spent, ledger.body.balance], [9000, 3000, 6000]);
  assert.deepEqual(ledger.body.byCategory, [{ category: 'TRANSPORT', amount: 3000 }]);
  assert.equal(ledger.body.expenses.find((e: { id: string }) => e.id === mistake.id).voidReason, 'Entered twice by mistake');
  assert.deepEqual([ledger.body.animals.total, ledger.body.animals.packed, ledger.body.meat.packetsHandedOut, ledger.body.meat.householdsServed], [2, 1, 3, 1]);
  const text = JSON.stringify(ledger.body);
  assert(!text.includes('Secretname') && !text.includes('Hiddenname') && !text.includes('9300000001'));
  assert.equal((await publicGet('/public/ledgers/not-an-id')).status, 404);

  // Admin dashboard and the combined feed.
  assert.equal((await call(alice, 'get', `/programs/${program.id}/summary`)).status, 403);
  assert.equal((await call(alice, 'get', `/programs/${program.id}/transactions`)).status, 403);
  const summary = (await call(admin, 'get', `/programs/${program.id}/summary`)).body;
  assert.deepEqual([summary.households, summary.bookedHouseholds, summary.shares, summary.money.collected, summary.money.spent, summary.money.balance],
    [2, 2, 2, 9000, 3000, 6000]);
  assert.deepEqual([summary.animals.total, summary.animals.packed, summary.animals.pending, summary.meat.issued, summary.meat.handedOut, summary.meat.confirmed], [2, 1, 1, 10, 3, 1]);
  assert.equal(summary.money.paid, 1);
  const feed = (await call(admin, 'get', `/programs/${program.id}/transactions`)).body as { type: string; status: string }[];
  assert.deepEqual([...new Set(feed.map(row => row.type))].sort(), ['DISTRIBUTION', 'EXPENSE', 'MEAT_ISSUE', 'PAYMENT']);
  assert.equal(feed.filter(row => row.type === 'EXPENSE' && row.status === 'VOIDED').length, 1);
});
