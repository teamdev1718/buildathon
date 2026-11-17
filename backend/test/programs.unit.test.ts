import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as logic from '../src/modules/programs/programs.logic.js';
import * as schema from '../src/modules/programs/programs.schema.js';

test('goats and sheep are one share, larger animals seven', () => {
  assert.deepEqual(logic.sharesPerAnimal, { GOAT: 1, SHEEP: 1, COW: 7, CAMEL: 7 });
});

test('share price rounds up and animal counts cover every share', () => {
  assert.equal(logic.sharePrice(90000, 7), 12858);
  assert.equal(logic.sharePrice(9000, 1), 9000);
  assert.equal(logic.bookingTotal(3, 90000, 7), 3 * 12858);
  assert.equal(logic.animalsNeeded(0, 7), 0);
  assert.equal(logic.animalsNeeded(7, 7), 1);
  assert.equal(logic.animalsNeeded(8, 7), 2);
  assert.equal(logic.animalsNeeded(3, 1), 3);
});

test('program and booking input validation', () => {
  const program = { name: 'Udhiyya 2027', year: 2027, targetDate: '2027-05-26' };
  assert.equal(schema.programInput.safeParse(program).success, true);
  assert.equal(schema.programInput.safeParse({ ...program, targetDate: 'tomorrow' }).success, false);
  assert.equal(schema.programInput.safeParse({ ...program, extra: 1 }).success, false);
  assert.equal(schema.animalType.safeParse('BUFFALO').success, false);
  assert.equal(schema.animalUpdate.safeParse({ price: -1 }).success, false);
  const id = '8f0f5b0c-3a43-4a0a-a9c3-0f6c2d4a9b11';
  assert.equal(schema.bookingInput.parse({ householdId: id, animalType: 'COW', shares: 2 }).payMode, 'INSTALLMENTS');
  assert.equal(schema.bookingInput.safeParse({ householdId: id, animalType: 'COW', shares: 0 }).success, false);
});
