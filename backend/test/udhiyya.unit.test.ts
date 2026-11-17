import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as logic from '../src/modules/udhiyya/udhiyya.logic.js';
import * as schema from '../src/modules/udhiyya/udhiyya.schema.js';

test('installments split the price over the months left and late joiners pay more', () => {
  const lock = new Date('2027-05-01T00:00:00Z');
  assert.deepEqual(logic.installmentPlan(new Date('2026-05-01T00:00:00Z'), lock, 6000), { installments: 12, monthlyAmount: 500 });
  assert.deepEqual(logic.installmentPlan(new Date('2026-11-17T00:00:00Z'), lock, 6000), { installments: 5, monthlyAmount: 1200 });
  assert.deepEqual(logic.installmentPlan(new Date('2026-05-01T00:00:00Z'), lock, 7001), { installments: 12, monthlyAmount: 584 });
  assert.deepEqual(logic.installmentPlan(new Date('2027-06-01T00:00:00Z'), lock, 6000), { installments: 1, monthlyAmount: 6000 });
});

test('expected payment follows the schedule and standing reflects it', () => {
  const plan = { installments: 12, monthlyAmount: 500 };
  const start = new Date('2026-05-10T00:00:00Z');
  assert.equal(logic.expectedPaid(start, new Date('2026-05-10T00:00:00Z'), plan, 6000), 500);
  assert.equal(logic.expectedPaid(start, new Date('2026-08-10T00:00:00Z'), plan, 6000), 2000);
  assert.equal(logic.expectedPaid(start, new Date('2026-08-09T00:00:00Z'), plan, 6000), 1500);
  assert.equal(logic.expectedPaid(start, new Date('2030-01-01T00:00:00Z'), plan, 6000), 6000);
  assert.equal(logic.paymentStanding(6000, 6000, 6000), 'PAID');
  assert.equal(logic.paymentStanding(2000, 6000, 2000), 'ON_TRACK');
  assert.equal(logic.paymentStanding(1000, 6000, 2000), 'BEHIND');
});

test('animals needed and the meat split follow the cycle percentages', () => {
  assert.equal(logic.animalsNeeded(15, 7), 3);
  assert.equal(logic.animalsNeeded(7, 7), 1);
  const cycle = { meatKgPerShare: 10, familyPercent: 33, relativesPercent: 33, poorPercent: 34 };
  assert.deepEqual(logic.meatSplit(cycle, 20, 12), { memberGramsPerShare: 6600, poolGrams: 68000, gramsPerBeneficiary: 5666 });
  assert.equal(logic.meatSplit(cycle, 20, 0).gramsPerBeneficiary, 0);
});

test('Udhiyya input validation rejects bad cycles, plans, enrolments and tokens', () => {
  const cycle = { name: 'Udhiyya 1448', targetDate: '2027-05-27', priceLockDate: '2027-05-01' };
  assert.equal(schema.cycleInput.safeParse(cycle).success, true);
  assert.equal(schema.cycleInput.safeParse({ ...cycle, priceLockDate: '2027-06-01' }).success, false);
  assert.equal(schema.cycleInput.safeParse({ ...cycle, poorPercent: 50 }).success, false);
  assert.equal(schema.planInput.safeParse({ name: 'Goat', animalType: 'GOAT', sharePrice: 9000, sharesPerAnimal: 7 }).success, false);
  assert.equal(schema.planInput.safeParse({ name: 'Cow', animalType: 'COW', sharePrice: 9000, sharesPerAnimal: 7 }).success, true);
  const planId = '8f0f5b0c-3a43-4a0a-a9c3-0f6c2d4a9b11';
  assert.equal(schema.enrollInput.safeParse({ planId, shares: 2, holderNames: ['A'] }).success, false);
  assert.equal(schema.enrollInput.safeParse({ planId, shares: 2, holderNames: ['A', 'B'] }).success, true);
  assert.equal(schema.onlinePaymentInput.safeParse({ amount: -5, reference: 'x' }).success, false);
  assert.equal(schema.collectInput.parse({ code: ' abcde23456 ' }).code, 'ABCDE23456');
});
