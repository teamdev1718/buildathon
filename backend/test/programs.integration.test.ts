import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startHarness } from './harness.js';

const { db, call, makeUser, stop, prefix } = await startHarness();
const codes = ['P' + prefix.toUpperCase() + 'A', 'P' + prefix.toUpperCase() + 'B'];
after(() => stop(() => db.mahallu.deleteMany({ where: { code: { in: codes } } }).then(() => {})));

test('programs: admin sets prices and starts; members book; access stays inside the mahallu', async () => {
  const superAdmin = await makeUser('super', ['ADMIN']);
  const admin = await makeUser('padmin');
  const rival = await makeUser('rival');
  const alice = await makeUser('alice');
  const bob = await makeUser('bob');
  const stranger = await makeUser('stranger');

  const north = (await call(superAdmin, 'post', '/mahallus', { name: 'North', district: 'D', code: codes[0] })).body;
  const south = (await call(superAdmin, 'post', '/mahallus', { name: 'South', district: 'D', code: codes[1] })).body;
  await call(superAdmin, 'post', `/mahallus/${north.id}/admins`, { email: admin.email, enabled: true });
  await call(superAdmin, 'post', `/mahallus/${south.id}/admins`, { email: rival.email, enabled: true });
  await call(admin, 'post', `/mahallus/${north.id}/households/import`, { rows: [
    { mahalluNumber: '1', ownerName: 'Alice', memberCount: 4, address: 'a', phone: '9000000001' },
    { mahalluNumber: '2', ownerName: 'Bob', memberCount: 3, address: 'b', phone: '9000000002' }] });
  await call(alice, 'post', '/me/households/link', { mahalluId: north.id, mahalluNumber: '1', phone: '9000000001' });
  await call(bob, 'post', '/me/households/link', { mahalluId: north.id, mahalluNumber: '2', phone: '9000000002' });
  const houses = (await call(admin, 'get', `/mahallus/${north.id}/households`)).body.rows;
  const aliceHome = houses.find((row: { mahalluNumber: string }) => row.mahalluNumber === '1').id as string;
  const bobHome = houses.find((row: { mahalluNumber: string }) => row.mahalluNumber === '2').id as string;

  // Only the mahallu's own admin manages programs.
  const body = { name: 'Udhiyya 2027', year: 2027, targetDate: '2027-05-26' };
  assert.equal((await call(alice, 'post', `/mahallus/${north.id}/programs`, body)).status, 403);
  assert.equal((await call(rival, 'post', `/mahallus/${north.id}/programs`, body)).status, 403);
  const created = await call(admin, 'post', `/mahallus/${north.id}/programs`, body);
  assert.equal(created.status, 201);
  const id = created.body.id as string;
  assert.deepEqual(created.body.animals.map((a: { animalType: string; sharesPerAnimal: number }) => [a.animalType, a.sharesPerAnimal]),
    [['GOAT', 1], ['SHEEP', 1], ['COW', 7], ['CAMEL', 7]]);
  assert.equal((await call(admin, 'post', `/mahallus/${north.id}/programs`, body)).status, 409);

  // Drafts are hidden from members; a program cannot start without prices.
  assert.equal((await call(alice, 'get', '/programs/' + id)).status, 403);
  assert.equal((await call(admin, 'post', `/programs/${id}/start`, {})).status, 409);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/GOAT`, { price: 9000 })).status, 200);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/COW`, { price: 90000 })).status, 200);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/SHEEP`, { enabled: false })).status, 200);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/CAMEL`, { enabled: false })).status, 200);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/HORSE`, { price: 5 })).status, 404);
  assert.equal((await call(alice, 'patch', `/programs/${id}/animals/COW`, { price: 1 })).status, 403);
  assert.equal((await call(alice, 'post', `/programs/${id}/bookings`, { householdId: aliceHome, animalType: 'GOAT', shares: 1 })).status, 409);
  assert.equal((await call(admin, 'post', `/programs/${id}/start`, {})).status, 200);
  assert.equal((await call(admin, 'post', `/programs/${id}/start`, {})).status, 409);

  // Members see it and book; disabled animals and other people's households are refused.
  const mine = (await call(alice, 'get', '/me/programs')).body;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].animals.find((a: { animalType: string }) => a.animalType === 'COW').sharePrice, 12858);
  assert.equal((await call(stranger, 'get', '/me/programs')).body.length, 0);
  assert.equal((await call(stranger, 'get', '/programs/' + id)).status, 403);
  assert.equal((await call(alice, 'post', `/programs/${id}/bookings`, { householdId: aliceHome, animalType: 'SHEEP', shares: 1 })).status, 409);
  assert.equal((await call(alice, 'post', `/programs/${id}/bookings`, { householdId: bobHome, animalType: 'GOAT', shares: 1 })).status, 403);
  const aliceCow = await call(alice, 'post', `/programs/${id}/bookings`, { householdId: aliceHome, animalType: 'COW', shares: 3, payMode: 'ONE_TIME' });
  assert.equal(aliceCow.status, 201);
  assert.equal(aliceCow.body.amount, 3 * 12858);
  assert.equal((await call(alice, 'post', `/programs/${id}/bookings`, { householdId: aliceHome, animalType: 'COW', shares: 1 })).status, 409);
  await call(bob, 'post', `/programs/${id}/bookings`, { householdId: bobHome, animalType: 'COW', shares: 5 });
  await call(bob, 'post', `/programs/${id}/bookings`, { householdId: bobHome, animalType: 'GOAT', shares: 2 });

  // Prices change at any time; amounts follow and animal counts are exact.
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/COW`, { price: 91000 })).status, 200);
  const totals = (await call(admin, 'get', `/programs/${id}/bookings`)).body;
  const cow = totals.totals.find((row: { animalType: string }) => row.animalType === 'COW');
  assert.deepEqual([cow.shares, cow.animalsNeeded], [8, 2]);
  assert.equal(totals.totals.find((row: { animalType: string }) => row.animalType === 'GOAT').animalsNeeded, 2);
  assert.equal((await call(alice, 'get', `/programs/${id}/bookings`)).status, 403);
  assert.equal((await call(rival, 'get', `/programs/${id}/bookings`)).status, 403);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/COW`, { enabled: false })).status, 409);

  // Changing and cancelling: owners and admins only, only while open.
  const bookingId = aliceCow.body.id as string;
  assert.equal((await call(bob, 'patch', '/bookings/' + bookingId, { shares: 1 })).status, 403);
  assert.equal((await call(alice, 'patch', '/bookings/' + bookingId, { shares: 4 })).body.amount, 4 * 13000);
  assert.equal((await call(admin, 'post', `/programs/${id}/bookings`, { householdId: bobHome, animalType: 'COW', shares: 1 })).status, 409);
  assert.equal((await call(admin, 'delete', '/bookings/' + bookingId)).status, 200);
  assert.equal((await call(alice, 'delete', '/bookings/' + bookingId)).status, 404);

  // Ending closes everything.
  assert.equal((await call(alice, 'post', `/programs/${id}/end`, {})).status, 403);
  assert.equal((await call(admin, 'post', `/programs/${id}/end`, {})).status, 200);
  assert.equal((await call(bob, 'patch', `/programs/${id}/animals/GOAT`, { price: 1 })).status, 403);
  assert.equal((await call(admin, 'patch', `/programs/${id}/animals/GOAT`, { price: 1 })).status, 409);
  assert.equal((await call(alice, 'post', `/programs/${id}/bookings`, { householdId: aliceHome, animalType: 'GOAT', shares: 1 })).status, 409);
  assert.equal((await call(admin, 'post', `/mahallus/${north.id}/programs`, { ...body, name: 'Udhiyya 2028', year: 2028 })).status, 201);
});
