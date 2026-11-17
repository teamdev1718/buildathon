import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startHarness } from './harness.js';

const { db, call, makeUser, stop, prefix } = await startHarness();
const code = 'L' + prefix.toUpperCase();
after(() => stop(() => db.mahallu.deleteMany({ where: { code } }).then(() => {})));

type Animal = { id: string; code: string; animalType: string; filled: number; capacity: number; drawOrder: number; slotAt: string };

test('allocation: exact animal counts, codes, manual edits, random draw and reordering', async () => {
  const superAdmin = await makeUser('super', ['ADMIN']);
  const admin = await makeUser('aadmin');
  const alice = await makeUser('alice');
  const mahallu = (await call(superAdmin, 'post', '/mahallus', { name: 'Alloc', district: 'D', code })).body;
  await call(superAdmin, 'post', `/mahallus/${mahallu.id}/admins`, { email: admin.email, enabled: true });
  const people = Array.from({ length: 5 }, (_, i) => ({ mahalluNumber: String(i + 1), ownerName: 'Owner ' + (i + 1), memberCount: 3, address: 'x', phone: '90000000' + (10 + i) }));
  await call(admin, 'post', `/mahallus/${mahallu.id}/households/import`, { rows: people });
  await call(alice, 'post', '/me/households/link', { mahalluId: mahallu.id, mahalluNumber: '1', phone: '9000000010' });
  const homes = (await call(admin, 'get', `/mahallus/${mahallu.id}/households`)).body.rows as { id: string; mahalluNumber: string }[];
  const home = (n: string) => homes.find(row => row.mahalluNumber === n)!.id;

  const program = (await call(admin, 'post', `/mahallus/${mahallu.id}/programs`, { name: 'Udhiyya 2027', year: 2027, targetDate: '2027-05-26' })).body;
  await call(admin, 'patch', `/programs/${program.id}/animals/COW`, { price: 70000 });
  await call(admin, 'patch', `/programs/${program.id}/animals/GOAT`, { price: 9000 });
  await call(admin, 'patch', `/programs/${program.id}/animals/SHEEP`, { enabled: false });
  await call(admin, 'patch', `/programs/${program.id}/animals/CAMEL`, { enabled: false });
  assert.equal((await call(admin, 'post', `/programs/${program.id}/allocate`, {})).status, 409);
  await call(admin, 'post', `/programs/${program.id}/start`, {});
  const book = (n: string, animalType: string, shares: number) => call(admin, 'post', `/programs/${program.id}/bookings`, { householdId: home(n), animalType, shares });
  // 4 + 4 + 3 + 3 + 1 = 15 cow shares -> 3 cows; goats 2 + 1 -> 3 goats.
  const cowBookings = [await book('1', 'COW', 4), await book('2', 'COW', 4), await book('3', 'COW', 3), await book('4', 'COW', 3), await book('5', 'COW', 1)];
  await book('1', 'GOAT', 2);
  await book('2', 'GOAT', 1);

  // Only admins allocate, and only when they ask.
  assert.equal((await call(alice, 'post', `/programs/${program.id}/allocate`, {})).status, 403);
  assert.equal((await call(alice, 'get', `/programs/${program.id}/allocation`)).status, 403);
  assert.equal((await call(admin, 'get', `/programs/${program.id}/allocation`)).body.animals.length, 0);
  const done = await call(admin, 'post', `/programs/${program.id}/allocate`, {});
  assert.equal(done.status, 200);
  const view = done.body;
  assert.equal(view.animals.filter((a: Animal) => a.animalType === 'COW').length, 3);
  assert.equal(view.animals.filter((a: Animal) => a.animalType === 'GOAT').length, 3);
  assert.deepEqual(view.animals.map((a: Animal) => a.code).sort(), ['COW-01', 'COW-02', 'COW-03', 'GOT-01', 'GOT-02', 'GOT-03']);
  assert.equal(view.unallocatedShares, 0);
  assert(view.animals.every((a: Animal) => a.filled <= a.capacity));

  // Members see their animal codes once allocated, but no slot before the draw.
  const mine = (await call(alice, 'get', '/me/programs')).body[0].bookings;
  assert.equal(mine.find((b: { animalType: string }) => b.animalType === 'GOAT').animals.length, 2);
  assert.equal(mine[0].animals[0].slotAt, null);

  // Manual edits respect animal capacity, type and ownership.
  const allocationOf = (bookingId: string) => view.bookings.find((b: { id: string }) => b.id === bookingId).allocations[0].animalId as string;
  const [aId, bId, cId, , eId] = cowBookings.map(item => item.body.id as string);
  const cowOfA = allocationOf(aId);
  const put = (bookingId: string, items: object[], actor = admin) => call(actor, 'put', `/bookings/${bookingId}/allocation`, { items });
  assert.equal((await put(bId, [{ animalId: cowOfA, shares: 4 }])).status, 409);
  assert.equal((await put(eId, [{ animalId: cowOfA, shares: 1 }])).status, 409);
  assert.equal((await put(eId, [{ animalId: cowOfA, shares: 5 }])).status, 409);
  const goatId = view.animals.find((a: Animal) => a.animalType === 'GOAT').id as string;
  assert.equal((await put(eId, [{ animalId: goatId, shares: 1 }])).status, 404);
  assert.equal((await put(eId, [], alice)).status, 403);
  assert.equal((await put(cId, [])).body.unallocatedShares, 3);
  const placed = await put(eId, [{ animalId: cowOfA, shares: 1 }]);
  assert.equal(placed.status, 200);
  assert.equal(placed.body.animals.find((a: Animal) => a.id === cowOfA).filled, 5);
  assert.equal(allocationOf(aId), cowOfA);

  // Changing a booking's shares clears its placement so the admin can see what needs attention.
  assert.equal((await call(admin, 'patch', `/bookings/${aId}`, { shares: 2 })).status, 200);
  assert.equal((await call(admin, 'get', `/programs/${program.id}/allocation`)).body.unallocatedShares, 5);

  // Allocate again to rebuild; then draw.
  const rebuilt = await call(admin, 'post', `/programs/${program.id}/allocate`, {});
  assert.equal(rebuilt.body.animals.filter((a: Animal) => a.animalType === 'COW').length, 2);
  assert.equal(rebuilt.body.unallocatedShares, 0);
  assert.equal((await call(admin, 'put', `/programs/${program.id}/order`, { animalIds: [] })).status, 400);
  assert.equal((await call(admin, 'put', `/programs/${program.id}/order`, { animalIds: rebuilt.body.animals.map((a: Animal) => a.id) })).status, 409);
  assert.equal((await call(alice, 'post', `/programs/${program.id}/draw`, { startAt: '2027-05-26T04:00:00Z', minutesPerAnimal: 20 })).status, 403);
  assert.equal((await call(admin, 'post', `/programs/${program.id}/draw`, { startAt: 'soon', minutesPerAnimal: 20 })).status, 400);
  const drawn = await call(admin, 'post', `/programs/${program.id}/draw`, { startAt: '2027-05-26T04:00:00Z', minutesPerAnimal: 20 });
  assert.equal(drawn.status, 200);
  assert.equal(drawn.body.drawn, true);
  const order = drawn.body.animals as Animal[];
  assert.deepEqual(order.map(a => a.drawOrder), [1, 2, 3, 4, 5]);
  assert.equal(order[2].slotAt, '2027-05-26T04:40:00.000Z');

  // Admin edits the order by hand; slots follow.
  const reversed = [...order].reverse().map(a => a.id);
  const edited = await call(admin, 'put', `/programs/${program.id}/order`, { animalIds: reversed });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.animals[0].id, reversed[0]);
  assert.equal(edited.body.animals[4].slotAt, '2027-05-26T05:20:00.000Z');
  assert.equal((await call(admin, 'put', `/programs/${program.id}/order`, { animalIds: reversed.slice(1) })).status, 400);

  // Members now see their code, position and slot.
  const seen = (await call(alice, 'get', '/me/programs')).body[0].bookings;
  assert(seen.every((b: { animals: { drawOrder: number; slotAt: string }[] }) => b.animals.every(a => a.drawOrder !== null && a.slotAt)));

  // A finished program cannot be reallocated.
  await call(admin, 'post', `/programs/${program.id}/end`, {});
  assert.equal((await call(admin, 'post', `/programs/${program.id}/allocate`, {})).status, 409);
});
