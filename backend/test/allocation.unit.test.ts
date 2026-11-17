import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as logic from '../src/modules/programs/programs.logic.js';

test('allocation uses the minimum number of animals and never overfills one', () => {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let round = 0; round < 300; round++) {
    const capacity = next() < 0.5 ? 1 : 7;
    const bookings = Array.from({ length: 1 + Math.floor(next() * 12) }, (_, index) => ({ id: 'b' + index, shares: 1 + Math.floor(next() * 12) }));
    const { animals, placements } = logic.planAllocation(bookings, capacity);
    const total = bookings.reduce((sum, item) => sum + item.shares, 0);
    assert.equal(animals, Math.ceil(total / capacity));
    const used = Array<number>(animals).fill(0);
    for (const item of placements) used[item.animal] += item.shares;
    assert(used.every(value => value <= capacity));
    for (const booking of bookings) {
      assert.equal(placements.filter(item => item.bookingId === booking.id).reduce((sum, item) => sum + item.shares, 0), booking.shares);
    }
  }
});

test('households keep their shares on one animal whenever it fits', () => {
  const { placements } = logic.planAllocation([{ id: 'a', shares: 4 }, { id: 'b', shares: 3 }, { id: 'c', shares: 4 }, { id: 'd', shares: 3 }], 7);
  assert.equal(placements.length, 4);
  assert.deepEqual(logic.planAllocation([{ id: 'a', shares: 9 }], 7).placements.map(item => item.shares).sort(), [2, 7]);
});

test('codes are readable, the shuffle is a permutation, and slots follow the order', () => {
  assert.equal(logic.animalCode('COW', 3), 'COW-03');
  assert.equal(logic.animalCode('GOAT', 12), 'GOT-12');
  const items = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(logic.shuffle(items, () => 0).sort(), items);
  assert.deepEqual(logic.shuffle(items, limit => limit - 1), items);
  const start = new Date('2027-05-26T04:00:00Z');
  assert.equal(logic.slotAt(start, 20, 1).toISOString(), '2027-05-26T04:00:00.000Z');
  assert.equal(logic.slotAt(start, 20, 4).toISOString(), '2027-05-26T05:00:00.000Z');
});
